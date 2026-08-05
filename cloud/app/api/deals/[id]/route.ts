import { bindings, ensureSchema, json, ownerId } from "../../../../lib/cloud";
import { queueAndFlushDeal } from "../../../../lib/supabase";

type DealRow = { id: string; data_json: string; created_at: number; updated_at: number };

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const deal = await bindings().DB.prepare("SELECT id, data_json, created_at, updated_at FROM deals WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, owner).first<DealRow>();
  if (!deal) return json({ error: "ДКП не найден" }, { status: 404 });
  const docs = await bindings().DB.prepare("SELECT id, document_type, filename, content_type, size, status, created_at FROM documents WHERE deal_id = ? AND owner_id = ? ORDER BY created_at").bind(id, owner).all();
  const files = await bindings().DB.prepare("SELECT id, kind, filename, content_type, size, created_at FROM generated_files WHERE deal_id = ? AND owner_id = ? ORDER BY created_at DESC").bind(id, owner).all();
  return json({ deal: { id, ...JSON.parse(deal.data_json), created_at: deal.created_at, updated_at: deal.updated_at }, documents: docs.results || [], files: files.results || [] });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const row = await bindings().DB.prepare("SELECT data_json, created_at FROM deals WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, owner).first<{ data_json: string; created_at: number }>();
  if (!row) return json({ error: "ДКП не найден" }, { status: 404 });
  const patch = (await request.json()) as Record<string, unknown>;
  const data = { ...JSON.parse(row.data_json), ...patch };
  const now = Date.now();
  await bindings().DB.prepare("UPDATE deals SET data_json = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(JSON.stringify(data), now, id, owner).run();
  const sync = await queueAndFlushDeal(id, owner, now);
  return json({ deal: { id, ...data, updated_at: now }, supabase_sync: sync });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const owner = await ownerId();
  const deal = await bindings().DB.prepare("SELECT data_json, created_at FROM deals WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, owner).first<{ data_json: string; created_at: number }>();
  if (!deal) return json({ error: "ДКП не найден" }, { status: 404 });
  const deletedAt = Date.now();
  await bindings().DB.prepare("UPDATE deals SET deleted_at = ?, updated_at = ? WHERE id = ? AND owner_id = ?").bind(deletedAt, deletedAt, id, owner).run();
  const sync = await queueAndFlushDeal(id, owner, deletedAt);
  return json({ ok: true, deleted_at: deletedAt, supabase_sync: sync });
}
