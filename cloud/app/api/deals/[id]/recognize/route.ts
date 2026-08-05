import { bindings, ensureSchema, json, ownerId } from "../../../../../lib/cloud";
import { type DealData, type OcrConflict, sanitizeRecognizedFields } from "../../../../../lib/deal-data";
import { parseModelJson } from "../../../../../lib/model-json";
import { queueAndFlushDeal } from "../../../../../lib/supabase";

type DocRow = { id: string; object_key: string; content_type: string; document_type: string; filename: string };
type ModelDocument = { index?: number; kind?: string; fields?: Record<string, unknown> };
type ModelPayload = { documents?: ModelDocument[] } & Record<string, unknown>;

const vehicleIdentityFields = ["vehicle_make_model", "vehicle_year", "vehicle_vin", "vehicle_body", "vehicle_chassis"] as const;
const vehicleAllFields = [
  "vehicle_make_model", "vehicle_year", "vehicle_category", "vehicle_vin", "vehicle_body", "vehicle_chassis", "vehicle_color",
] as const;

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function identitySignature(fields: Partial<DealData>) {
  const vin = String(fields.vehicle_vin || "").replace(/[^A-ZА-Я0-9]/gi, "").toUpperCase();
  if (vin && vin !== "ОТСУТСТВУЕТ") return `VIN:${vin}`;
  const body = String(fields.vehicle_body || "").replace(/[^A-ZА-Я0-9]/gi, "").toUpperCase();
  if (body && body !== "ОТСУТСТВУЕТ") return `BODY:${body}`;
  const model = String(fields.vehicle_make_model || "").replace(/\s+/g, " ").trim().toUpperCase();
  return model ? `MODEL:${model}:${fields.vehicle_year || ""}` : "";
}

function mergeResults(payload: ModelPayload, docs: DocRow[]) {
  const modelDocuments = Array.isArray(payload.documents) ? payload.documents : [];
  if (!modelDocuments.length) {
    return { fields: {}, conflicts: [] as OcrConflict[] };
  }

  const parsed = modelDocuments.map((item, modelIndex) => {
    const index = Number.isInteger(item.index) ? Number(item.index) : modelIndex + 1;
    const source = docs[index - 1];
    return {
      source,
      kind: String(item.kind || "").toLowerCase(),
      fields: sanitizeRecognizedFields(item.fields || {}),
    };
  }).filter(item => item.source);

  const merged: Partial<DealData> = {};
  for (const item of parsed) {
    if (item.source.document_type === "seller_passport") {
      for (const [key, value] of Object.entries(item.fields)) if (key.startsWith("seller_")) (merged as Record<string, unknown>)[key] = value;
    }
    if (item.source.document_type === "buyer_passport") {
      for (const [key, value] of Object.entries(item.fields)) if (key.startsWith("buyer_")) (merged as Record<string, unknown>)[key] = value;
    }
  }

  const vehicleDocs = parsed.filter(item => item.source.document_type === "vehicle" || item.kind === "pts" || item.kind === "sts");
  const primary = vehicleDocs.find(item => item.kind === "pts") || vehicleDocs[0];
  if (primary) for (const key of vehicleAllFields) if (primary.fields[key]) (merged as Record<string, unknown>)[key] = primary.fields[key];

  const ptsDocument = vehicleDocs.find(item => item.kind === "pts" && item.fields.vehicle_pts);
  const stsDocument = vehicleDocs.find(item => item.kind === "sts");
  const ptsFromSts = vehicleDocs.find(item => item.kind === "sts" && item.fields.vehicle_pts);
  if (ptsDocument?.fields.vehicle_pts) merged.vehicle_pts = ptsDocument.fields.vehicle_pts;
  else if (ptsFromSts?.fields.vehicle_pts) merged.vehicle_pts = ptsFromSts.fields.vehicle_pts;
  if (stsDocument?.fields.vehicle_sts) merged.vehicle_sts = stsDocument.fields.vehicle_sts;
  if (stsDocument?.fields.vehicle_plate) merged.vehicle_plate = stsDocument.fields.vehicle_plate;

  const signatures = vehicleDocs.map(item => ({ item, signature: identitySignature(item.fields) })).filter(item => item.signature);
  const conflicting = signatures.length > 1 && new Set(signatures.map(item => item.signature)).size > 1;
  const conflicts: OcrConflict[] = [];
  if (conflicting) {
    const sources = signatures.map(item => item.item.source.filename);
    const keys = new Set<string>([...vehicleIdentityFields, "vehicle_pts", "vehicle_sts", "vehicle_plate"]);
    for (const field of keys) {
      if ((merged as Record<string, unknown>)[field]) {
        conflicts.push({
          field: field as keyof DealData,
          message: "Загруженные ПТС и СТС относятся к разным автомобилям. Проверьте это значение.",
          sources,
        });
      }
    }
  }
  return { fields: merged, conflicts };
}

const prompt = `Извлеки данные из российских документов для договора купли-продажи автомобиля.
Верни ТОЛЬКО JSON вида {"documents":[{"index":1,"kind":"seller_passport|buyer_passport|pts|sts|old_contract|other","fields":{...}}]}.
Используй только строковые значения. Допустимые поля: seller_full_name, seller_passport, seller_passport_issued, seller_passport_issue_date, seller_address, buyer_full_name, buyer_passport, buyer_passport_issued, buyer_passport_issue_date, buyer_address, vehicle_make_model, vehicle_year, vehicle_category, vehicle_vin, vehicle_body, vehicle_chassis, vehicle_color, vehicle_plate, vehicle_pts, vehicle_sts.
Правила:
1. Дату выдачи паспорта бери только со страницы паспорта с надписью «Паспорт выдан» и датой выдачи. Формат даты ДД.ММ.ГГГГ.
2. vehicle_pts: только номер в верхней части лицевой стороны ПТС либо значение строки «Паспорт ТС №» на розовом СТС.
3. vehicle_sts: только собственная серия и номер свидетельства СТС/СОР — обычно красные 4+6 цифр снизу или сбоку розового бланка. Никогда не копируй туда «Паспорт ТС №».
4. vehicle_plate: только государственный регистрационный знак формата буква-3 цифры-2 буквы-регион. Никогда не используй номер ПТС или СТС.
5. Не смешивай значения между изображениями. У каждого объекта documents должен быть индекс соответствующей фотографии.
6. Не выдумывай отсутствующие данные. Для VIN/кузова/шасси сохраняй напечатанное слово об отсутствии — сервер приведёт его к «ОТСУТСТВУЕТ».`;

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const key = bindings().OPENROUTER_API_KEY;
  if (!key) return json({ error: "Ключ облачного OCR пока не настроен" }, { status: 503 });
  const deal = await bindings().DB.prepare("SELECT data_json, created_at FROM deals WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, owner).first<{ data_json: string; created_at: number }>();
  if (!deal) return json({ error: "ДКП не найден" }, { status: 404 });
  const docsResult = await bindings().DB.prepare("SELECT id, object_key, content_type, document_type, filename FROM documents WHERE deal_id = ? AND owner_id = ? ORDER BY created_at").bind(id, owner).all<DocRow>();
  const docs = docsResult.results || [];
  if (!docs.length) return json({ error: "Сначала загрузите фотографии" }, { status: 400 });

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (let index = 0; index < docs.length; index += 1) {
    const doc = docs[index];
    const object = await bindings().FILES.get(doc.object_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());
    content.push({ type: "text", text: `Документ ${index + 1}. Категория загрузки: ${doc.document_type}. Имя файла: ${doc.filename}` });
    content.push({ type: "image_url", image_url: { url: `data:${doc.content_type};base64,${base64(bytes)}` } });
  }
  let modelPayload: ModelPayload | undefined;
  let parseError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryContent = attempt === 0 ? content : [
      ...content,
      { type: "text", text: "Предыдущий ответ содержал синтаксическую ошибку. Повтори распознавание и верни только один корректный JSON-объект без Markdown." },
    ];
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://dkp-app.innvinjapan.chatgpt.site", "X-Title": "АвтоДоговор Cloud" },
      body: JSON.stringify({ model: "qwen/qwen3-vl-32b-instruct", temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "user", content: retryContent }] }),
    });
    if (!response.ok) return json({ error: `OCR временно недоступен (${response.status})` }, { status: 502 });
    const result = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      modelPayload = parseModelJson<ModelPayload>(result.choices?.[0]?.message?.content);
      parseError = undefined;
      break;
    } catch (error) {
      parseError = error;
    }
  }
  if (!modelPayload) return json({ error: parseError instanceof Error ? parseError.message : "Не удалось разобрать OCR" }, { status: 502 });
  const recognized = mergeResults(modelPayload, docs);
  const current = JSON.parse(deal.data_json);
  const merged = { ...current, ...recognized.fields, ocr_conflicts: recognized.conflicts };
  const now = Date.now();
  await bindings().DB.batch([
    bindings().DB.prepare("UPDATE deals SET data_json = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(JSON.stringify(merged), now, id, owner),
    bindings().DB.prepare("UPDATE documents SET status = 'recognized' WHERE deal_id = ? AND owner_id = ?").bind(id, owner),
  ]);
  const sync = await queueAndFlushDeal(id, owner, now);
  return json({ deal: { id, ...merged }, recognized: Object.keys(recognized.fields), conflicts: recognized.conflicts, supabase_sync: sync });
}

export const __test = { mergeResults, identitySignature };
