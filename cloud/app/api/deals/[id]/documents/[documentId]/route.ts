import { bindings, ensureSchema, json, ownerId } from "../../../../../../lib/cloud";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  await ensureSchema();
  const { id, documentId } = await params;
  const owner = await ownerId();
  const row = await bindings().DB.prepare("SELECT object_key FROM documents WHERE id = ? AND deal_id = ? AND owner_id = ?").bind(documentId, id, owner).first<{ object_key: string }>();
  if (!row) return json({ error: "Файл не найден" }, { status: 404 });
  await bindings().FILES.delete(row.object_key);
  await bindings().DB.prepare("DELETE FROM documents WHERE id = ? AND deal_id = ? AND owner_id = ?").bind(documentId, id, owner).run();
  return json({ ok: true });
}
