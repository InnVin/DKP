import { bindings, emptyDeal, ensureSchema, json, ownerId } from "../../../lib/cloud";

type DealRow = { id: string; data_json: string; created_at: number; updated_at: number };

function view(row: DealRow) {
  return { id: row.id, ...JSON.parse(row.data_json), created_at: row.created_at, updated_at: row.updated_at };
}

export async function GET() {
  await ensureSchema();
  const owner = await ownerId();
  const result = await bindings().DB.prepare("SELECT id, data_json, created_at, updated_at FROM deals WHERE owner_id = ? ORDER BY updated_at DESC").bind(owner).all<DealRow>();
  return json({ deals: (result.results || []).map(view) });
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
  return json({ deal: { id, ...data, created_at: now, updated_at: now } }, { status: 201 });
}
