import { bindings } from "./cloud";

export type SupabaseDeal = {
  id: string;
  ownerId: string;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
};

function configuration() {
  const { SUPABASE_CONTRACT_SYNC_URL, SUPABASE_CONTRACT_SYNC_SECRET } = bindings();
  if (!SUPABASE_CONTRACT_SYNC_URL || !SUPABASE_CONTRACT_SYNC_SECRET) return null;
  return { url: SUPABASE_CONTRACT_SYNC_URL, secret: SUPABASE_CONTRACT_SYNC_SECRET };
}

async function syncDealToSupabase(deal: SupabaseDeal): Promise<boolean> {
  const config = configuration();
  if (!config) {
    console.warn("Supabase contract sync is not configured");
    return false;
  }
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-autodogovor-sync-secret": config.secret,
      },
      body: JSON.stringify({
        id: deal.id,
        owner_id: deal.ownerId,
        data: deal.data,
        created_at: deal.createdAt,
        updated_at: deal.updatedAt,
        deleted_at: deal.deletedAt ?? null,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Supabase sync failed (${response.status}): ${details.slice(0, 240)}`);
    }
    return true;
  } catch (error) {
    console.error("Unable to sync contract to Supabase", error);
    return false;
  }
}

export async function enqueueDealSync(dealId: string, ownerId: string, updatedAt: number) {
  await bindings().DB.prepare(`
    INSERT INTO supabase_sync_queue (deal_id, owner_id, attempts, updated_at)
    VALUES (?, ?, 0, ?)
    ON CONFLICT(deal_id) DO UPDATE SET owner_id = excluded.owner_id, updated_at = excluded.updated_at
  `).bind(dealId, ownerId, updatedAt).run();
}

type QueueRow = {
  deal_id: string;
  owner_id: string;
  attempts: number;
  data_json: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export async function flushSupabaseQueue(ownerId: string, limit = 12) {
  const db = bindings().DB;
  const result = await db.prepare(`
    SELECT q.deal_id, q.owner_id, q.attempts, d.data_json, d.created_at, d.updated_at, d.deleted_at
    FROM supabase_sync_queue q JOIN deals d ON d.id = q.deal_id
    WHERE q.owner_id = ? ORDER BY q.updated_at LIMIT ?
  `).bind(ownerId, limit).all<QueueRow>();
  let synced = 0;
  for (const row of result.results || []) {
    const ok = await syncDealToSupabase({
      id: row.deal_id,
      ownerId: row.owner_id,
      data: JSON.parse(row.data_json),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
    if (ok) {
      await db.batch([
        db.prepare("UPDATE deals SET supabase_synced_at = ? WHERE id = ? AND updated_at = ?").bind(row.updated_at, row.deal_id, row.updated_at),
        db.prepare("DELETE FROM supabase_sync_queue WHERE deal_id = ? AND updated_at <= ?").bind(row.deal_id, row.updated_at),
      ]);
      synced += 1;
    } else {
      await db.prepare("UPDATE supabase_sync_queue SET attempts = attempts + 1 WHERE deal_id = ?").bind(row.deal_id).run();
    }
  }
  const remaining = await db.prepare("SELECT COUNT(*) AS count FROM supabase_sync_queue WHERE owner_id = ?").bind(ownerId).first<{ count: number }>();
  return { synced, remaining: Number(remaining?.count || 0) };
}

export async function queueAndFlushDeal(dealId: string, ownerId: string, updatedAt: number) {
  await enqueueDealSync(dealId, ownerId, updatedAt);
  return flushSupabaseQueue(ownerId);
}
