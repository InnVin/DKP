import { bindings, ensureSchema, json, ownerId } from "../../../../../lib/cloud";

type DocRow = { id: string; object_key: string; content_type: string };

function base64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

function parseModel(value: unknown): Record<string, string> {
  const text = typeof value === "string" ? value : Array.isArray(value) ? value.map(item => typeof item?.text === "string" ? item.text : "").join("") : "";
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Сервис распознавания вернул неверный формат");
  const raw = JSON.parse(text.slice(start, end + 1));
  return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, typeof item === "string" ? item.trim() : ""]));
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const key = bindings().OPENROUTER_API_KEY;
  if (!key) return json({ error: "Ключ облачного OCR пока не настроен" }, { status: 503 });
  const deal = await bindings().DB.prepare("SELECT data_json FROM deals WHERE id = ? AND owner_id = ?").bind(id, owner).first<{ data_json: string }>();
  if (!deal) return json({ error: "ДКП не найден" }, { status: 404 });
  const docs = await bindings().DB.prepare("SELECT id, object_key, content_type FROM documents WHERE deal_id = ? AND owner_id = ? ORDER BY created_at").bind(id, owner).all<DocRow>();
  if (!docs.results?.length) return json({ error: "Сначала загрузите фотографии" }, { status: 400 });

  const content: Array<Record<string, unknown>> = [{ type: "text", text: `Извлеки данные из российских документов для ДКП автомобиля. Верни только JSON со строковыми значениями. Ключи: seller_full_name, seller_passport, seller_passport_issued, seller_passport_issue_date, seller_address, buyer_full_name, buyer_passport, buyer_passport_issued, buyer_passport_issue_date, buyer_address, vehicle_make_model, vehicle_year, vehicle_category, vehicle_vin, vehicle_body, vehicle_chassis, vehicle_color, vehicle_plate, vehicle_pts, vehicle_sts. Не выдумывай отсутствующие значения.` }];
  for (const doc of docs.results) {
    const object = await bindings().FILES.get(doc.object_key);
    if (!object) continue;
    const bytes = new Uint8Array(await object.arrayBuffer());
    content.push({ type: "image_url", image_url: { url: `data:${doc.content_type};base64,${base64(bytes)}` } });
  }
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://innvinjapan-avtodogovor.innvinjapan.chatgpt.site", "X-Title": "АвтоДоговор Cloud" },
    body: JSON.stringify({ model: "qwen/qwen3-vl-32b-instruct", temperature: 0, messages: [{ role: "user", content }] }),
  });
  if (!response.ok) return json({ error: `OCR временно недоступен (${response.status})` }, { status: 502 });
  const result = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
  let recognized: Record<string, string>;
  try { recognized = parseModel(result.choices?.[0]?.message?.content); } catch (error) { return json({ error: error instanceof Error ? error.message : "Не удалось разобрать OCR" }, { status: 502 }); }
  const current = JSON.parse(deal.data_json);
  const merged = { ...current, ...Object.fromEntries(Object.entries(recognized).filter(([, value]) => value)) };
  const now = Date.now();
  await bindings().DB.batch([
    bindings().DB.prepare("UPDATE deals SET data_json = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(JSON.stringify(merged), now, id, owner),
    bindings().DB.prepare("UPDATE documents SET status = 'recognized' WHERE deal_id = ? AND owner_id = ?").bind(id, owner),
  ]);
  return json({ deal: { id, ...merged }, recognized: Object.keys(recognized).filter(keyName => recognized[keyName]) });
}
