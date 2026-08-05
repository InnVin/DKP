import * as XLSX from "xlsx";
import { formatRussianDate } from "./deal-data.ts";

type Deal = Record<string, unknown>;

const cellMap: Record<string, string> = {
  A4: "contract_place", J4: "contract_date",
  B9: "seller_full_name", D10: "seller_passport", H10: "seller_passport_issue_date", D11: "seller_passport_issued", D12: "seller_address", J10: "seller_phone",
  B15: "buyer_full_name", D16: "buyer_passport", H16: "buyer_passport_issue_date", D17: "buyer_passport_issued", D18: "buyer_address", J16: "buyer_phone",
  D22: "vehicle_make_model", D23: "vehicle_category", D24: "vehicle_year", D25: "vehicle_vin", D26: "vehicle_body", D27: "vehicle_chassis", D28: "vehicle_color", D29: "vehicle_pts", D30: "vehicle_sts", D31: "vehicle_plate", D34: "price",
  G43: "seller_full_name", G46: "buyer_full_name",
};

const dateKeys = new Set(["contract_date", "seller_passport_issue_date", "buyer_passport_issue_date"]);
const text = (deal: Deal, key: string) => dateKeys.has(key) ? formatRussianDate(deal[key]) : String(deal[key] ?? "").trim();

function setCell(sheet: XLSX.WorkSheet, address: string, value: string) {
  const previous = sheet[address] || { t: "s" };
  sheet[address] = { ...previous, t: "s", v: value, w: value };
}

export function fillContractWorkbook(workbook: XLSX.WorkBook, deal: Deal) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const [address, key] of Object.entries(cellMap)) setCell(sheet, address, text(deal, key));
  sheet["!printArea"] = "A1:J47";
  sheet["!margins"] = { left: .2, right: .2, top: .25, bottom: .25, header: 0, footer: 0 };
  sheet["!pageSetup"] = { orientation: "portrait", paperSize: 9, fitToWidth: 1, fitToHeight: 1 };
  return workbook;
}

export function writeXls(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { type: "array", bookType: "xls", cellStyles: true, compression: true }) as ArrayBuffer;
}

export function readXls(bytes: ArrayBuffer) {
  const workbook = XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const row of [13, 19]) for (let column = 0; column < 10; column += 1) {
    const address = XLSX.utils.encode_cell({ r: row - 1, c: column });
    if (sheet[address]) sheet[address] = { ...sheet[address], t: "s", v: "", w: "" };
  }
  return workbook;
}

const baseHeaders = ["№", "Дата", "Продавец", "Паспорт продавца", "Дата выдачи", "Кем выдан", "Адрес продавца", "Телефон продавца", "Покупатель", "Паспорт покупателя", "Дата выдачи", "Кем выдан", "Адрес покупателя", "Телефон покупателя", "Автомобиль", "Год", "VIN", "Кузов", "Шасси", "Цвет", "ПТС", "СТС", "Госномер", "Цена", "Место договора", "Заметки", "Создан", "Изменён", "Статус", "Удалён"];
const rowKeys = ["contract_number", "contract_date", "seller_full_name", "seller_passport", "seller_passport_issue_date", "seller_passport_issued", "seller_address", "seller_phone", "buyer_full_name", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued", "buyer_address", "buyer_phone", "vehicle_make_model", "vehicle_year", "vehicle_vin", "vehicle_body", "vehicle_chassis", "vehicle_color", "vehicle_pts", "vehicle_sts", "vehicle_plate", "price", "contract_place", "notes", "created_at", "updated_at"];
const databaseDateKeys = new Set([...dateKeys, "created_at", "updated_at", "deleted_at"]);
function databaseDate(value: unknown) {
  if (typeof value === "number") return new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Yakutsk" }).format(new Date(value));
  return formatRussianDate(value);
}

function databaseSheet(deals: Deal[], deleted: boolean) {
  const rows = deals.map(deal => [
    ...rowKeys.map(key => databaseDateKeys.has(key) ? databaseDate(deal[key]) : String(deal[key] ?? "")),
    deleted ? "Удалён" : "Действующий",
    deleted ? databaseDate(deal.deleted_at) : "",
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([baseHeaders, ...rows]);
  sheet["!autofilter"] = { ref: `A1:AD${Math.max(2, rows.length + 1)}` };
  sheet["!freeze"] = { xSplit: 2, ySplit: 1 };
  sheet["!cols"] = baseHeaders.map((header, index) => ({ wch: index === 0 ? 10 : Math.min(34, Math.max(13, header.length + 4)) }));
  return sheet;
}

export function buildDatabaseWorkbook(template: XLSX.WorkBook, active: Deal[], deleted: Deal[]) {
  const contractSheet = template.Sheets[template.SheetNames[0]];
  const blank = XLSX.read(XLSX.write(template, { type: "array", bookType: "xls", cellStyles: true }), { type: "array", cellStyles: true });
  const workbook: XLSX.WorkBook = { SheetNames: [], Sheets: {} };
  workbook.SheetNames.push("ДКП"); workbook.Sheets["ДКП"] = contractSheet;
  if (active[0]) fillContractWorkbook(workbook, active[0]);
  workbook.SheetNames.push("База"); workbook.Sheets["База"] = databaseSheet(active, false);
  workbook.SheetNames.push("Удалённые"); workbook.Sheets["Удалённые"] = databaseSheet(deleted, true);
  workbook.SheetNames.push("Пуст"); workbook.Sheets["Пуст"] = blank.Sheets[blank.SheetNames[0]];
  return workbook;
}
