import { bindings, ensureSchema, ownerId } from "@/lib/cloud";
import { fillContractWorkbook, readXls, writeXlsx } from "@/lib/excel";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await context.params;
  const owner = await ownerId();
  const row = await bindings().DB.prepare("SELECT data_json FROM deals WHERE id = ? AND owner_id = ? AND deleted_at IS NULL").bind(id, owner).first<{ data_json: string }>();
  if (!row) return Response.json({ error: "Договор не найден" }, { status: 404 });
  const source = await bindings().ASSETS.fetch(new Request(new URL("/templates/BAZA.xls", request.url)));
  if (!source.ok) return Response.json({ error: "Шаблон BAZA.xls недоступен" }, { status: 500 });
  const deal = JSON.parse(row.data_json);
  const bytes = writeXlsx(fillContractWorkbook(readXls(await source.arrayBuffer()), deal));
  const number = String(deal.contract_number || "без_номера").replace(/[^а-яёa-z0-9_-]+/gi, "_");
  return new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`ДКП_${number}.xlsx`)}` } });
}
