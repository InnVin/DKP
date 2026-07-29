import { File } from "expo-file-system";
import * as Network from "expo-network";

import { secureSettings } from "@/lib/secure-settings";
import {
  DealDocument,
  DealField,
  DocumentType,
  FieldCandidate,
  FieldMeta,
  criticalOcrFields,
} from "@/types/deal";
import { normalizeRecognizedFields } from "@/lib/field-normalization";

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "qwen/qwen3-vl-32b-instruct";

const allFields: DealField[] = [
  "contract_number",
  "contract_date",
  "contract_place",
  "price",
  "seller_full_name",
  "seller_birth_date",
  "seller_phone",
  "seller_passport",
  "seller_passport_issue_date",
  "seller_passport_issued_by",
  "seller_address",
  "buyer_full_name",
  "buyer_birth_date",
  "buyer_phone",
  "buyer_passport",
  "buyer_passport_issue_date",
  "buyer_passport_issued_by",
  "buyer_address",
  "vehicle_make_model",
  "vehicle_type",
  "vehicle_year",
  "vin",
  "body_number",
  "chassis_number",
  "color",
  "registration_plate",
  "pts_series_number",
  "sts_series_number",
];

const fieldsByType: Record<DocumentType, DealField[]> = {
  seller_passport: allFields.filter((field) => field.startsWith("seller_")),
  buyer_passport: allFields.filter((field) => field.startsWith("buyer_")),
  vehicle_docs: allFields.filter(
    (field) => !field.startsWith("seller_") && !field.startsWith("buyer_") && !field.startsWith("contract_") && field !== "price",
  ),
  old_contract: allFields,
  other: [],
};

interface ModelField {
  value?: string;
  confidence?: number;
  page?: number;
  evidence?: string;
  candidates?: FieldCandidate[];
}

interface ModelResult {
  fields?: Partial<Record<DealField, ModelField>>;
  warnings?: string[];
}

export interface OcrResult {
  fields: Partial<Record<DealField, string>>;
  fieldMeta: Partial<Record<DealField, FieldMeta>>;
  conflicts: Partial<Record<DealField, FieldCandidate[]>>;
  warnings: string[];
}

function extractJson(value: string) {
  const cleaned = value.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Сервис распознавания вернул неверный формат.");
  return JSON.parse(cleaned.slice(start, end + 1)) as ModelResult;
}

function recognitionPrompt(type: DocumentType, fields: DealField[]) {
  const role =
    type === "seller_passport"
      ? "паспорт продавца"
      : type === "buyer_passport"
        ? "паспорт покупателя"
        : type === "vehicle_docs"
          ? "ПТС и/или СТС автомобиля"
          : "старый договор купли-продажи";
  return [
    "Ты переносишь данные из российских документов в договор купли-продажи автомобиля.",
    `На изображениях: ${role}. Считай все страницы единым комплектом.`,
    "Ничего не додумывай. Неразборчивое поле не возвращай.",
    "VIN содержит ровно 17 латинских символов без I, O, Q. Номер кузова не выдавай за VIN.",
    'Паспорт РФ возвращай как "СССС НННННН", даты как "ДД.ММ.ГГГГ".',
    "Для каждого поля верни value, confidence от 0 до 1, page, evidence и candidates со всех страниц.",
    "Если похожие символы читаются по-разному, сохрани оба варианта в candidates.",
    `Разрешённые поля: ${fields.join(", ")}.`,
    'Верни строго JSON: {"fields":{"field":{"value":"","confidence":0.0,"page":1,"evidence":"","candidates":[]}},"warnings":[]}',
  ].join("\n");
}

async function imagePart(document: DealDocument) {
  const base64 = await new File(document.localUri).base64();
  return {
    type: "image_url",
    image_url: { url: `data:${document.mimeType || "image/jpeg"};base64,${base64}` },
  };
}

export async function recognizeDocuments(
  documents: DealDocument[],
  type: DocumentType,
  targetFields?: DealField[],
): Promise<OcrResult> {
  const key = await secureSettings.getOpenRouterKey();
  if (!key) throw new Error("Сначала сохраните ключ OpenRouter в настройках.");
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected) throw new Error("Нет подключения к интернету. Распознавание поставлено в очередь.");
  const allowed = targetFields?.length ? targetFields : fieldsByType[type];
  if (!allowed.length) throw new Error("Этот тип документа не предназначен для распознавания.");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "AutoDogovor Mobile",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: recognitionPrompt(type, allowed) },
            ...(await Promise.all(documents.map(imagePart))),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenRouter: ${response.status}. ${detail.slice(0, 240)}`);
  }
  const payload = await response.json();
  const content = String(payload?.choices?.[0]?.message?.content ?? "");
  const parsed = extractJson(content);
  const rawValues: Partial<Record<DealField, unknown>> = {};
  const fieldMeta: Partial<Record<DealField, FieldMeta>> = {};
  const conflicts: Partial<Record<DealField, FieldCandidate[]>> = {};

  for (const field of allowed) {
    const item = parsed.fields?.[field];
    if (!item?.value) continue;
    const confidence = Math.max(0, Math.min(1, Number(item.confidence ?? 0)));
    const candidates = (item.candidates ?? [])
      .filter((candidate) => candidate?.value)
      .map((candidate) => ({
        value: String(candidate.value).trim(),
        confidence: Math.max(0, Math.min(1, Number(candidate.confidence ?? 0))),
        page: candidate.page,
        evidence: String(candidate.evidence ?? "").slice(0, 180),
      }));
    const distinct = [...new Map(candidates.map((candidate) => [candidate.value.toUpperCase(), candidate])).values()];
    if (criticalOcrFields.has(field) && distinct.length > 1) {
      conflicts[field] = distinct;
      continue;
    }
    rawValues[field] = item.value;
    fieldMeta[field] = {
      confidence,
      page: item.page,
      evidence: String(item.evidence ?? "").slice(0, 180),
      source: "openrouter",
    };
  }

  return {
    fields: normalizeRecognizedFields(rawValues),
    fieldMeta,
    conflicts,
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
  };
}
