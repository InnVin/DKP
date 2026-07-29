import * as SQLite from "expo-sqlite";

import {
  DealData,
  DealDocument,
  DealField,
  DealRecord,
  DocumentType,
  FieldCandidate,
  FieldMeta,
  GeneratedFile,
  SyncStatus,
  emptyDealData,
} from "@/types/deal";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

function now() {
  return new Date().toISOString();
}

async function database() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("autodogovor.db");
  }
  return databasePromise;
}

export async function initializeDatabase() {
  const db = await database();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data_json TEXT NOT NULL,
      field_meta_json TEXT NOT NULL DEFAULT '{}',
      conflicts_json TEXT NOT NULL DEFAULT '{}',
      sync_status TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      ocr_status TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS generated_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      name TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local',
      remote_path TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS deals_updated_idx ON deals(updated_at DESC);
    CREATE INDEX IF NOT EXISTS documents_deal_idx ON documents(deal_id);
    CREATE INDEX IF NOT EXISTS generated_deal_idx ON generated_files(deal_id);
  `);
}

type DealRow = {
  id: number;
  data_json: string;
  field_meta_json: string;
  conflicts_json: string;
  sync_status: SyncStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapDeal(row: DealRow): DealRecord {
  return {
    id: row.id,
    data: { ...emptyDealData(), ...JSON.parse(row.data_json) },
    fieldMeta: JSON.parse(row.field_meta_json),
    conflicts: JSON.parse(row.conflicts_json),
    syncStatus: row.sync_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export async function nextContractNumber() {
  const db = await database();
  const rows = await db.getAllAsync<{ data_json: string }>(
    "SELECT data_json FROM deals WHERE deleted_at IS NULL",
  );
  const max = rows.reduce((result, row) => {
    const value = Number(JSON.parse(row.data_json).contract_number || 0);
    return Number.isFinite(value) ? Math.max(result, value) : result;
  }, 0);
  return String(max + 1);
}

export async function createDeal() {
  const db = await database();
  const stamp = now();
  const data = emptyDealData();
  data.contract_number = await nextContractNumber();
  const result = await db.runAsync(
    `INSERT INTO deals
      (data_json, field_meta_json, conflicts_json, sync_status, created_at, updated_at)
      VALUES (?, '{}', '{}', 'local', ?, ?)`,
    JSON.stringify(data),
    stamp,
    stamp,
  );
  return Number(result.lastInsertRowId);
}

export async function getDeal(id: number) {
  const db = await database();
  const row = await db.getFirstAsync<DealRow>("SELECT * FROM deals WHERE id = ?", id);
  return row ? mapDeal(row) : null;
}

export async function listDeals(query = "", includeDeleted = false) {
  const db = await database();
  const rows = await db.getAllAsync<DealRow>(
    `SELECT * FROM deals
     WHERE (? = 1 OR deleted_at IS NULL)
       AND (? = '' OR lower(data_json) LIKE '%' || lower(?) || '%')
     ORDER BY updated_at DESC`,
    includeDeleted ? 1 : 0,
    query.trim(),
    query.trim(),
  );
  return rows.map(mapDeal);
}

export async function listDeletedDeals(query = "") {
  const db = await database();
  const rows = await db.getAllAsync<DealRow>(
    `SELECT * FROM deals
     WHERE deleted_at IS NOT NULL
       AND (? = '' OR lower(data_json) LIKE '%' || lower(?) || '%')
     ORDER BY deleted_at DESC`,
    query.trim(),
    query.trim(),
  );
  return rows.map(mapDeal);
}

export async function saveDeal(
  id: number,
  data: DealData,
  fieldMeta: Partial<Record<DealField, FieldMeta>> = {},
  conflicts: Partial<Record<DealField, FieldCandidate[]>> = {},
) {
  const db = await database();
  await db.runAsync(
    `UPDATE deals
     SET data_json = ?, field_meta_json = ?, conflicts_json = ?, updated_at = ?
     WHERE id = ?`,
    JSON.stringify(data),
    JSON.stringify(fieldMeta),
    JSON.stringify(conflicts),
    now(),
    id,
  );
}

export async function setDealSyncStatus(id: number, status: SyncStatus) {
  const db = await database();
  await db.runAsync("UPDATE deals SET sync_status = ?, updated_at = ? WHERE id = ?", status, now(), id);
}

export async function moveDealToTrash(id: number) {
  const db = await database();
  await db.runAsync("UPDATE deals SET deleted_at = ?, updated_at = ? WHERE id = ?", now(), now(), id);
}

export async function restoreDeal(id: number) {
  const db = await database();
  await db.runAsync("UPDATE deals SET deleted_at = NULL, updated_at = ? WHERE id = ?", now(), id);
}

export async function deleteDealPermanently(id: number) {
  const db = await database();
  await db.runAsync("DELETE FROM deals WHERE id = ?", id);
}

export async function addDocument(
  dealId: number,
  documentType: DocumentType,
  localUri: string,
  originalName: string,
  mimeType = "image/jpeg",
) {
  const db = await database();
  const result = await db.runAsync(
    `INSERT INTO documents
      (deal_id, document_type, local_uri, original_name, mime_type, ocr_status, created_at)
      VALUES (?, ?, ?, ?, ?, 'local', ?)`,
    dealId,
    documentType,
    localUri,
    originalName,
    mimeType,
    now(),
  );
  return Number(result.lastInsertRowId);
}

type DocumentRow = {
  id: number;
  deal_id: number;
  document_type: DocumentType;
  local_uri: string;
  original_name: string;
  mime_type: string;
  ocr_status: DealDocument["ocrStatus"];
  created_at: string;
};

export async function listDocuments(dealId: number): Promise<DealDocument[]> {
  const db = await database();
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents WHERE deal_id = ? ORDER BY id",
    dealId,
  );
  return rows.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    documentType: row.document_type,
    localUri: row.local_uri,
    originalName: row.original_name,
    mimeType: row.mime_type,
    ocrStatus: row.ocr_status,
    createdAt: row.created_at,
  }));
}

export async function updateDocumentStatus(id: number, status: DealDocument["ocrStatus"]) {
  const db = await database();
  await db.runAsync("UPDATE documents SET ocr_status = ? WHERE id = ?", status, id);
}

export async function removeDocument(id: number) {
  const db = await database();
  await db.runAsync("DELETE FROM documents WHERE id = ?", id);
}

export async function replaceGeneratedFiles(dealId: number, files: Omit<GeneratedFile, "id" | "dealId" | "createdAt">[]) {
  const db = await database();
  await db.runAsync("DELETE FROM generated_files WHERE deal_id = ?", dealId);
  for (const file of files) {
    await db.runAsync(
      `INSERT INTO generated_files
        (deal_id, kind, local_uri, name, sync_status, remote_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      dealId,
      file.kind,
      file.localUri,
      file.name,
      file.syncStatus,
      file.remotePath,
      now(),
    );
  }
}

type GeneratedRow = {
  id: number;
  deal_id: number;
  kind: GeneratedFile["kind"];
  local_uri: string;
  name: string;
  sync_status: SyncStatus;
  remote_path: string;
  created_at: string;
};

export async function listGeneratedFiles(dealId: number): Promise<GeneratedFile[]> {
  const db = await database();
  const rows = await db.getAllAsync<GeneratedRow>(
    "SELECT * FROM generated_files WHERE deal_id = ? ORDER BY id",
    dealId,
  );
  return rows.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    kind: row.kind,
    localUri: row.local_uri,
    name: row.name,
    syncStatus: row.sync_status,
    remotePath: row.remote_path,
    createdAt: row.created_at,
  }));
}

export async function listAllGeneratedFiles(): Promise<GeneratedFile[]> {
  const db = await database();
  const rows = await db.getAllAsync<GeneratedRow>(
    `SELECT generated_files.*
     FROM generated_files
     INNER JOIN deals ON deals.id = generated_files.deal_id
     WHERE deals.deleted_at IS NULL
     ORDER BY generated_files.created_at DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    dealId: row.deal_id,
    kind: row.kind,
    localUri: row.local_uri,
    name: row.name,
    syncStatus: row.sync_status,
    remotePath: row.remote_path,
    createdAt: row.created_at,
  }));
}

export async function setGeneratedSyncStatus(id: number, status: SyncStatus, remotePath = "") {
  const db = await database();
  await db.runAsync(
    "UPDATE generated_files SET sync_status = ?, remote_path = ? WHERE id = ?",
    status,
    remotePath,
    id,
  );
}
