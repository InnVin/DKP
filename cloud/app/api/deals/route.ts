import { bindings, emptyDeal, ensureSchema, json, ownerId } from "../../../lib/cloud";
import { flushSupabaseQueue, queueAndFlushDeal } from "../../../lib/supabase";

type DealRow = { id: string; data_json: string; created_at: number; updated_at: number; deleted_at: number | null };

function view(row: DealRow) {
  return { id: row.id, ...JSON.parse(row.data_json), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at };
}

export async function GET() {
  await ensureSchema();
  const owner = await ownerId();
  const result = await bindings().DB.prepare("SELECT id, data_json, created_at, updated_at, deleted_at FROM deals WHERE owner_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC").bind(owner).all<DealRow>();
  const rows = result.results || [];
  const sync = await flushSupabaseQueue(owner);
  return json({ deals: rows.map(view), supabase_sync: sync });
}

export async function POST(request: Request) {
  await ensureSchema();
  const owner = await ownerId();
  const now = Date.now();
  const id = crypto.randomUUID();
  let supplied: Record<string, unknown> = {};
  try { supplied = await request.json(); } catch {}
  const data = { ...emptyDeal(), ...supplied };
  await bindings().DB.prepare("INSERT INTO deals (id, owner_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(id, owner, JSON.stringify(data), now, now).run();
  const sync = await queueAndFlushDeal(id, owner, now);
  return json({ deal: { id, ...data, created_at: now, updated_at: now }, supabase_sync: sync }, { status: 201 });
}
