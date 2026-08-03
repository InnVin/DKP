CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_deals_owner_updated ON deals(owner_id, updated_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, document_type TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_deal_owner ON documents(deal_id, owner_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS generated_files (id TEXT PRIMARY KEY, deal_id TEXT NOT NULL, owner_id TEXT NOT NULL, kind TEXT NOT NULL, object_key TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_generated_deal_owner ON generated_files(deal_id, owner_id);
