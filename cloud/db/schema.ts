import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const deals = sqliteTable("deals", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  dataJson: text("data_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_deals_owner_updated").on(table.ownerId, table.updatedAt)]);

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  ownerId: text("owner_id").notNull(),
  documentType: text("document_type").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_documents_deal_owner").on(table.dealId, table.ownerId)]);

export const generatedFiles = sqliteTable("generated_files", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").notNull(),
  ownerId: text("owner_id").notNull(),
  kind: text("kind").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("idx_generated_deal_owner").on(table.dealId, table.ownerId)]);
