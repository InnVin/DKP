import { env } from "cloudflare:workers";
import { headers } from "next/headers";

export type Bindings = {
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
    db.prepare("CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_deals_owner_updated ON deals(owner_id, updated_at DESC)"),
    db.prepare("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, document_type TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_documents_deal_owner ON documents(deal_id, owner_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS generated_files (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_generated_deal_owner ON generated_files(deal_id, owner_id)"),
  ]);
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
