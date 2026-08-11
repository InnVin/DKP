import * as XLSX from "xlsx";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
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

export function writeXlsx(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true, compression: true }) as ArrayBuffer;
}

export function readWorkbook(bytes: ArrayBuffer) {
  return XLSX.read(bytes, { type: "array", cellStyles: true, cellDates: true, cellFormula: true });
}

export function readXls(bytes: ArrayBuffer) {
  const workbook = readWorkbook(bytes);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  for (const row of [13, 19]) for (let column = 0; column < 10; column += 1) {
    const address = XLSX.utils.encode_cell({ r: row - 1, c: column });
    if (sheet[address]) sheet[address] = { ...sheet[address], t: "s", v: "", w: "" };
  }
  return workbook;
}

const databaseHeaders = [
  "ID", "ФИО продавца", "Паспорт", "выдан", "от", "Прописка",
  "ПОКУПАТЕЛЬ", "Паспорт", "выдан", "от", "Прописка",
  "Марка, модель", "Тип", "Год", "VIN", "№ кузова", "Шасси", "Цвет", "ПТС", "СОР СТС", "Госномер", "Сумма", "Дата",
  "Создан", "Место договора", "Телефон продавца", "Телефон покупателя", "Заметки", "Изменён", "Статус", "Удалён",
];

const formulaColumns: Record<string, number> = {
  A4: 25, J4: 23,
  B9: 2, D10: 3, H10: 5, D11: 4, D12: 6, J10: 26,
  B15: 7, D16: 8, H16: 10, D17: 9, D18: 11, J16: 27,
  D22: 12, D23: 13, D24: 14, D25: 15, D26: 16, D27: 17, D28: 18, D29: 19, D30: 20, D31: 21, D34: 22,
};

type DealWithSelector = Deal & { __selector: string };

function cloneSheet(sheet: XLSX.WorkSheet) {
  return JSON.parse(JSON.stringify(sheet)) as XLSX.WorkSheet;
}

function selectorBase(deal: Deal) {
  return String(deal.contract_number ?? "").trim();
}

function selectorSuffix(deal: Deal, index: number) {
  const id = String(deal.id ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return id || String(index + 1).padStart(4, "0");
}

export function assignContractSelectors(deals: Deal[]) {
  const totals = new Map<string, number>();
  for (const deal of deals) {
    const base = selectorBase(deal);
    if (base) totals.set(base, (totals.get(base) || 0) + 1);
  }
  return deals.map((deal, index) => {
    const base = selectorBase(deal);
    const suffix = selectorSuffix(deal, index);
    const selector = !base ? `БЕЗ НОМЕРА-${suffix}` : (totals.get(base) || 0) > 1 ? `${base}-${suffix}` : base;
    return { ...deal, __selector: selector } as DealWithSelector;
  });
}

function dateValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  const match = String(value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return String(value ?? "").trim();
}

function yearValue(value: unknown) {
  const year = Number(String(value ?? "").trim());
  return Number.isInteger(year) && year > 1800 && year < 3000 ? year : String(value ?? "").trim();
}

function databaseRow(deal: DealWithSelector, deleted: boolean) {
  return [
    deal.__selector,
    deal.seller_full_name, deal.seller_passport, deal.seller_passport_issued, dateValue(deal.seller_passport_issue_date), deal.seller_address,
    deal.buyer_full_name, deal.buyer_passport, deal.buyer_passport_issued, dateValue(deal.buyer_passport_issue_date), deal.buyer_address,
    deal.vehicle_make_model, deal.vehicle_category, yearValue(deal.vehicle_year), deal.vehicle_vin, deal.vehicle_body, deal.vehicle_chassis, deal.vehicle_color,
    deal.vehicle_pts, deal.vehicle_sts, deal.vehicle_plate, deal.price, dateValue(deal.contract_date),
    dateValue(deal.created_at), deal.contract_place, deal.seller_phone, deal.buyer_phone, deal.notes, dateValue(deal.updated_at),
    deleted ? "Удалён" : "Действующий", deleted ? dateValue(deal.deleted_at) : "",
  ].map(value => value ?? "");
}

function styledCell(previous: XLSX.CellObject | undefined, value: unknown, column: number) {
  const cell = { ...(previous || {}) } as XLSX.CellObject;
  delete cell.f;
  delete cell.w;
  if (value instanceof Date) {
    cell.t = "d"; cell.v = value; cell.z = column === 23 || column === 5 || column === 10 ? "dd.mm.yyyy" : "dd.mm.yyyy hh:mm";
  } else if (typeof value === "number") {
    cell.t = "n"; cell.v = value;
  } else {
    cell.t = "s"; cell.v = String(value ?? "");
  }
  return cell;
}

function populateDatabaseSheet(sheet: XLSX.WorkSheet, deals: DealWithSelector[], deleted: boolean) {
  const headerStyles = databaseHeaders.map((_, column) => sheet[XLSX.utils.encode_cell({ r: 0, c: Math.min(column, 23) })]);
  const rowStyles = databaseHeaders.map((_, column) => sheet[XLSX.utils.encode_cell({ r: 1, c: Math.min(column, 23) })]);
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const decoded = XLSX.utils.decode_cell(address);
    if (decoded.r > 0) delete sheet[address];
  }
  databaseHeaders.forEach((header, column) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: column });
    sheet[address] = styledCell(headerStyles[column], header, column + 1);
  });
  deals.forEach((deal, rowIndex) => databaseRow(deal, deleted).forEach((value, column) => {
    const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: column });
    sheet[address] = styledCell(rowStyles[column], value, column + 1);
  }));
  const lastRow = Math.max(2, deals.length + 1);
  sheet["!ref"] = `A1:AE${lastRow}`;
  sheet["!autofilter"] = { ref: `A1:AE${lastRow}` };
  sheet["!freeze"] = { xSplit: 1, ySplit: 1 };
  const columns = [...(sheet["!cols"] || [])];
  const widths = [14, 30, 17, 34, 13, 40, 30, 17, 34, 13, 40, 28, 12, 9, 22, 22, 22, 16, 18, 18, 16, 14, 13, 19, 18, 18, 18, 34, 19, 15, 19];
  widths.forEach((width, index) => { columns[index] = { ...(columns[index] || {}), wch: width }; });
  sheet["!cols"] = columns;
  if (sheet["!rows"]) sheet["!rows"] = sheet["!rows"]!.slice(0, lastRow);
}

function formulaCachedValue(row: unknown[], column: number) {
  return row[column - 1] ?? "";
}

function setFormula(sheet: XLSX.WorkSheet, address: string, formula: string, cached: unknown) {
  const previous = sheet[address] || { t: "s", v: "" };
  const valueCell = styledCell(previous, cached, XLSX.utils.decode_col(address.replace(/\d+$/, "")) + 1);
  if (cached instanceof Date) valueCell.z = "dd.mm.yyyy";
  sheet[address] = { ...valueCell, f: formula };
}

function configureContractSheet(workbook: XLSX.WorkBook, active: DealWithSelector[]) {
  const sheet = workbook.Sheets["ДКП"];
  if (!sheet) throw new Error("В шаблоне отсутствует лист ДКП");
  const selected = active[0];
  const row = selected ? databaseRow(selected, false) : [];
  sheet.I1 = styledCell(sheet.I1, selected?.__selector || "", 9);
  for (const [address, column] of Object.entries(formulaColumns)) {
    setFormula(sheet, address, `IFERROR(VLOOKUP($I$1,'База'!$A$1:$AE$65536,${column},0),"")`, formulaCachedValue(row, column));
  }
  setFormula(sheet, "G43", "B9", formulaCachedValue(row, 2));
  setFormula(sheet, "G46", "B15", formulaCachedValue(row, 7));
  sheet["!printArea"] = "A1:J47";
  sheet["!pageSetup"] = { ...(sheet["!pageSetup"] || {}), orientation: "portrait", paperSize: 9, fitToWidth: 1, fitToHeight: 1 };
}

function fixBlankSheet(sheet: XLSX.WorkSheet | undefined) {
  if (!sheet) return;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address];
    if (cell?.f?.includes("#REF!")) sheet[address] = styledCell(cell, "", XLSX.utils.decode_col(address.replace(/\d+$/, "")) + 1);
  }
  sheet["!printArea"] = "A1:J47";
  sheet["!pageSetup"] = { ...(sheet["!pageSetup"] || {}), orientation: "portrait", paperSize: 9, fitToWidth: 1, fitToHeight: 1 };
}

function ensureWorkbookNames(workbook: XLSX.WorkBook, selectorLastRow: number) {
  const names = (workbook.Workbook?.Names || []).filter(item => item.Name !== "ContractSelectors" && item.Name !== "_xlnm.Print_Area");
  names.push(
    { Name: "ContractSelectors", Ref: `'База'!$A$2:$A$${Math.max(2, selectorLastRow)}` },
    { Name: "_xlnm.Print_Area", Ref: `'ДКП'!$A$1:$J$47`, Sheet: 0 },
    { Name: "_xlnm.Print_Area", Ref: `'Пуст'!$A$1:$J$47`, Sheet: 3 },
  );
  workbook.Workbook = { ...(workbook.Workbook || {}), Names: names, CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true } };
}

export function buildDatabaseWorkbook(template: XLSX.WorkBook, activeDeals: Deal[], deletedDeals: Deal[]) {
  const baseTemplate = template.Sheets["База"];
  if (!baseTemplate || !template.Sheets["Пуст"]) throw new Error("Шаблон должен содержать листы ДКП, База и Пуст");
  const active = assignContractSelectors(activeDeals);
  const deleted = assignContractSelectors(deletedDeals);
  const deletedSheet = cloneSheet(baseTemplate);
  populateDatabaseSheet(baseTemplate, active, false);
  populateDatabaseSheet(deletedSheet, deleted, true);
  template.Sheets["Удалённые"] = deletedSheet;
  template.SheetNames = ["ДКП", "База", "Удалённые", "Пуст"];
  configureContractSheet(template, active);
  fixBlankSheet(template.Sheets["Пуст"]);
  ensureWorkbookNames(template, active.length + 1);
  return template;
}

function injectSelectorValidation(bytes: ArrayBuffer) {
  const archive = unzipSync(new Uint8Array(bytes));
  const sheetPath = "xl/worksheets/sheet1.xml";
  const source = archive[sheetPath];
  if (!source) return bytes;
  let xml = strFromU8(source).replace(/<dataValidations\b[\s\S]*?<\/dataValidations>/g, "");
  const validation = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="I1"><formula1>ContractSelectors</formula1></dataValidation></dataValidations>';
  const marker = ["<hyperlinks", "<printOptions", "<pageMargins", "<pageSetup", "<drawing", "</worksheet>"].find(item => xml.includes(item)) || "</worksheet>";
  xml = xml.replace(marker, `${validation}${marker}`);
  archive[sheetPath] = strToU8(xml);
  const result = zipSync(archive, { level: 6 });
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer;
}

export function writeDatabaseXlsx(workbook: XLSX.WorkBook) {
  return injectSelectorValidation(writeXlsx(workbook));
}
