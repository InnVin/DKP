import { bindings, ensureSchema, ownerId } from "@/lib/cloud";
import { buildDatabaseWorkbook, readWorkbook, writeDatabaseXlsx } from "@/lib/excel";

export async function GET(request: Request) {
  await ensureSchema();
  const owner = await ownerId();
  const rows = await bindings().DB.prepare("SELECT id, data_json, created_at, updated_at, deleted_at FROM deals WHERE owner_id = ? ORDER BY created_at ASC, id ASC").bind(owner).all<{ id: string; data_json: string; created_at: number; updated_at: number; deleted_at: number | null }>();
  const deals = (rows.results || []).map(row => ({ id: row.id, ...JSON.parse(row.data_json), created_at: row.created_at, updated_at: row.updated_at, deleted_at: row.deleted_at }));
  const source = await bindings().ASSETS.fetch(new Request(new URL("/templates/MyTemplate.xls", request.url)));
  if (!source.ok) return Response.json({ error: "Шаблон единой Excel-базы недоступен" }, { status: 500 });
  const workbook = buildDatabaseWorkbook(readWorkbook(await source.arrayBuffer()), deals.filter(item => !item.deleted_at), deals.filter(item => item.deleted_at));
  return new Response(writeDatabaseXlsx(workbook), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("АвтоДоговор_Единая_База.xlsx")}` } });
}
