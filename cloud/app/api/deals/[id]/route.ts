import { bindings, ensureSchema, json, ownerId } from "../../../../lib/cloud";

type DealRow = { id: string; data_json: string; created_at: number; updated_at: number };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const deal = await bindings().DB.prepare("SELECT id, data_json, created_at, updated_at FROM deals WHERE id = ? AND owner_id = ?").bind(id, owner).first<DealRow>();
  if (!deal) return json({ error: "ДКП не найден" }, { status: 404 });
  const docs = await bindings().DB.prepare("SELECT id, document_type, filename, content_type, size, status, created_at FROM documents WHERE deal_id = ? AND owner_id = ? ORDER BY created_at").bind(id, owner).all();
  const files = await bindings().DB.prepare("SELECT id, kind, filename, content_type, size, created_at FROM generated_files WHERE deal_id = ? AND owner_id = ? ORDER BY created_at DESC").bind(id, owner).all();
  return json({ deal: { id, ...JSON.parse(deal.data_json), created_at: deal.created_at, updated_at: deal.updated_at }, documents: docs.results || [], files: files.results || [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const row = await bindings().DB.prepare("SELECT data_json FROM deals WHERE id = ? AND owner_id = ?").bind(id, owner).first<{ data_json: string }>();
  if (!row) return json({ error: "ДКП не найден" }, { status: 404 });
  const patch = (await request.json()) as Record<string, unknown>;
  const data = { ...JSON.parse(row.data_json), ...patch };
  const now = Date.now();
  await bindings().DB.prepare("UPDATE deals SET data_json = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(JSON.stringify(data), now, id, owner).run();
  return json({ deal: { id, ...data, updated_at: now } });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const rows = await bindings().DB.prepare("SELECT object_key FROM documents WHERE deal_id = ? AND owner_id = ? UNION ALL SELECT object_key FROM generated_files WHERE deal_id = ? AND owner_id = ?").bind(id, owner, id, owner).all<{ object_key: string }>();
  for (const row of rows.results || []) await bindings().FILES.delete(row.object_key);
  await bindings().DB.batch([
    bindings().DB.prepare("DELETE FROM documents WHERE deal_id = ? AND owner_id = ?").bind(id, owner),
    bindings().DB.prepare("DELETE FROM generated_files WHERE deal_id = ? AND owner_id = ?").bind(id, owner),
    bindings().DB.prepare("DELETE FROM deals WHERE id = ? AND owner_id = ?").bind(id, owner),
  ]);
  return json({ ok: true });
}
