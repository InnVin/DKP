import { env } from "cloudflare:workers";
import { headers } from "next/headers";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  OPENROUTER_API_KEY?: string;
  SUPABASE_CONTRACT_SYNC_URL?: string;
  SUPABASE_CONTRACT_SYNC_SECRET?: string;
};

export function bindings(): Bindings {
  return env as unknown as Bindings;
}

export async function ownerId(): Promise<string> {
  return (await headers()).get("oai-authenticated-user-id") || "local-preview";
}

export async function ensureSchema() {
  const db = bindings().DB;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER, supabase_synced_at INTEGER NOT NULL DEFAULT 0)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_deals_owner_updated ON deals(owner_id, updated_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, document_type TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_documents_deal_owner ON documents(deal_id, owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS generated_files (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_generated_deal_owner ON generated_files(deal_id, owner_id)"),
  ]);

  const columns = await db.prepare("PRAGMA table_info(deals)").all<{ name: string }>();
  const names = new Set((columns.results || []).map(column => column.name));
  if (!names.has("deleted_at")) await db.prepare("ALTER TABLE deals ADD COLUMN deleted_at INTEGER").run();
  if (!names.has("supabase_synced_at")) await db.prepare("ALTER TABLE deals ADD COLUMN supabase_synced_at INTEGER NOT NULL DEFAULT 0").run();
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_deals_owner_active ON deals(owner_id, deleted_at, updated_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS supabase_sync_queue (deal_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_supabase_sync_queue_owner ON supabase_sync_queue(owner_id, updated_at)"),
  ]);
  await db.prepare(`
    INSERT OR IGNORE INTO supabase_sync_queue (deal_id, owner_id, attempts, updated_at)
    SELECT id, owner_id, 0, updated_at FROM deals WHERE supabase_synced_at < updated_at
  `).run();
}

export const emptyDeal = () => ({
  contract_number: "", contract_date: new Date().toISOString().slice(0, 10), contract_place: "Якутск", price: "",
  seller_full_name: "", seller_passport: "", seller_passport_issued: "", seller_passport_issue_date: "", seller_address: "", seller_phone: "",
  buyer_full_name: "", buyer_passport: "", buyer_passport_issued: "", buyer_passport_issue_date: "", buyer_address: "", buyer_phone: "",
  vehicle_make_model: "", vehicle_year: "", vehicle_category: "", vehicle_vin: "", vehicle_body: "", vehicle_chassis: "", vehicle_color: "", vehicle_plate: "", vehicle_pts: "", vehicle_sts: "",
  notes: "",
});

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init.headers || {}) } });
}
