import { bindings, ensureSchema, ownerId } from "@/lib/cloud";
import { buildDatabaseWorkbook, readXls, writeXls } from "@/lib/excel";

export async function GET(request: Request) {
  await ensureSchema();
  const owner = await ownerId();
  const rows = await bindings().DB.prepare("SELECT data_json, created_at, updated_at, deleted_at FROM deals WHERE owner_id = ? ORDER BY updated_at DESC").bind(owner).all<{ data_json: string; created_at: number; updated_at: number; deleted_at: number | null }>();
  const deals = (rows.results || []).map(row => ({ ...JSON.parse(row.data_json), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at }));
  const source = await fetch(new URL("/templates/BAZA.xls", request.url));
  if (!source.ok) return Response.json({ error: "Шаблон BAZA.xls недоступен" }, { status: 500 });
  const workbook = buildDatabaseWorkbook(readXls(await source.arrayBuffer()), deals.filter(item => !item.deleted_at), deals.filter(item => item.deleted_at));
  return new Response(writeXls(workbook), { headers: { "Content-Type": "application/vnd.ms-excel", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("АвтоДоговор_База.xls")}` } });
}
