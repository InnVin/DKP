import { bindings, ensureSchema, json, ownerId } from "../../../../lib/cloud";
import { dealFingerprint, parseLegacyDeals } from "../../../../lib/excel-import";
import { flushSupabaseQueue } from "../../../../lib/supabase";

type ExistingRow = { data_json: string };

export async function POST(request: Request) {
  await ensureSchema();
  const owner = await ownerId();
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Выберите Excel-файл" }, { status: 400 });
  if (!/\.(xls|xlsx)$/i.test(file.name)) return json({ error: "Поддерживаются только файлы XLS и XLSX" }, { status: 400 });
  if (file.size > 8_000_000) return json({ error: "Excel-файл превышает 8 МБ" }, { status: 413 });

  let importedDeals;
  try { importedDeals = parseLegacyDeals(await file.arrayBuffer(), file.name); }
  catch (error) { return json({ error: error instanceof Error ? error.message : "Не удалось прочитать Excel-файл" }, { status: 400 }); }

  const existing = await bindings().DB.prepare("SELECT data_json FROM deals WHERE owner_id = ?").bind(owner).all<ExistingRow>();
  const sources = new Set<string>();
  const fingerprints = new Set<string>();
  for (const row of existing.results || []) {
    const deal = JSON.parse(row.data_json) as Record<string, unknown>;
    if (deal._import_source) sources.add(String(deal._import_source));
    fingerprints.add(dealFingerprint(deal));
  }

  const unique = importedDeals.filter(deal => {
    const fingerprint = dealFingerprint(deal);
    if (sources.has(deal._import_source) || fingerprints.has(fingerprint)) return false;
    sources.add(deal._import_source); fingerprints.add(fingerprint); return true;
  });
  const db = bindings().DB;
  const statements = unique.flatMap(deal => {
    const id = crypto.randomUUID();
    const createdAt = deal._import_created_at;
    const data = { ...deal } as Record<string, unknown>; delete data._import_created_at;
    return [
      db.prepare("INSERT INTO deals (id, owner_id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").bind(id, owner, JSON.stringify(data), createdAt, createdAt),
      db.prepare("INSERT OR REPLACE INTO supabase_sync_queue (deal_id, owner_id, attempts, updated_at) VALUES (?, ?, 0, ?)").bind(id, owner, createdAt),
    ];
  });
  for (let index = 0; index < statements.length; index += 80) await db.batch(statements.slice(index, index + 80));
  const sync = unique.length ? await flushSupabaseQueue(owner, 12) : { synced: 0, remaining: 0 };
  return json({ total: importedDeals.length, imported: unique.length, skipped: importedDeals.length - unique.length, supabase_sync: sync });
}
