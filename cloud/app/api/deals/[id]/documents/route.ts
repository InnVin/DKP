import { bindings, ensureSchema, json, ownerId } from "../../../../../lib/cloud";

const allowed = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"], ["application/pdf", ".pdf"],
]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const rows = await bindings().DB.prepare("SELECT id, document_type, filename, content_type, size, status, created_at FROM documents WHERE deal_id = ? AND owner_id = ? ORDER BY created_at").bind(id, owner).all();
  return json({ documents: rows.results || [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const exists = await bindings().DB.prepare("SELECT 1 ok FROM deals WHERE id = ? AND owner_id = ?").bind(id, owner).first();
  if (!exists) return json({ error: "ДКП не найден" }, { status: 404 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "Не удалось прочитать фотографии. Попробуйте выбрать их ещё раз." }, { status: 400 });
  }
  const type = String(form.get("document_type") || "other").replace(/[^a-z_]/g, "");
  const files = form.getAll("photos").filter((item): item is File => item instanceof File);
  if (!files.length) return json({ error: "Выберите фотографии" }, { status: 400 });
  const created = [];
  for (const file of files) {
    const ext = allowed.get(file.type);
    if (!ext) return json({ error: `Формат ${file.type || "неизвестен"} не поддерживается` }, { status: 415 });
    if (file.size > 2 * 1024 * 1024) return json({ error: "Фотография слишком большая. Максимальный размер после уменьшения — 2 МБ." }, { status: 413 });
    const docId = crypto.randomUUID();
    const key = `${owner}/deals/${id}/documents/${docId}${ext}`;
    await bindings().FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { owner, deal: id, original: file.name } });
    const now = Date.now();
    await bindings().DB.prepare("INSERT INTO documents (id, deal_id, owner_id, document_type, object_key, filename, content_type, size, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)").bind(docId, id, owner, type || "other", key, file.name.slice(0, 180), file.type, file.size, now).run();
    created.push({ id: docId, document_type: type || "other", filename: file.name, content_type: file.type, size: file.size, status: "uploaded", created_at: now });
  }
  return json({ documents: created }, { status: 201 });
}
