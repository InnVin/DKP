ALTER TABLE deals ADD COLUMN deleted_at INTEGER;
--> statement-breakpoint
ALTER TABLE deals ADD COLUMN supabase_synced_at INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_deals_owner_active ON deals(owner_id, deleted_at, updated_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS supabase_sync_queue (
  deal_id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_supabase_sync_queue_owner ON supabase_sync_queue(owner_id, updated_at);
--> statement-breakpoint
INSERT OR IGNORE INTO supabase_sync_queue (deal_id, owner_id, attempts, updated_at)
SELECT id, owner_id, 0, updated_at FROM deals;
