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
    deal.seller_full_name, deal.seller_passport, deal.seller_passport_issued, formatRussianDate(deal.seller_passport_issue_date), deal.seller_address,
    deal.buyer_full_name, deal.buyer_passport, deal.buyer_passport_issued, formatRussianDate(deal.buyer_passport_issue_date), deal.buyer_address,
    deal.vehicle_make_model, deal.vehicle_category, yearValue(deal.vehicle_year), deal.vehicle_vin, deal.vehicle_body, deal.vehicle_chassis, deal.vehicle_color,
    deal.vehicle_pts, deal.vehicle_sts, deal.vehicle_plate, deal.price, formatRussianDate(deal.contract_date),
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

type CellStyle = {
  font?: Record<string, unknown>;
  alignment?: Record<string, unknown>;
  [key: string]: unknown;
};

function styleCell(sheet: XLSX.WorkSheet, address: string, changes: CellStyle) {
  const cell = (sheet[address] || { t: "s", v: "" }) as XLSX.CellObject;
  const current = cell.s && typeof cell.s === "object" ? cell.s as CellStyle : {};
  cell.s = {
    ...current,
    ...changes,
    font: { ...(current.font || {}), ...(changes.font || {}) },
    alignment: { ...(current.alignment || {}), ...(changes.alignment || {}) },
  } as XLSX.CellStyle;
  sheet[address] = cell;
}

function clearContractRow(sheet: XLSX.WorkSheet, row: number) {
  for (let column = 0; column < 10; column += 1) {
    const address = XLSX.utils.encode_cell({ r: row - 1, c: column });
    const cell = { ...(sheet[address] || {}), t: "s", v: "", w: "" } as XLSX.CellObject;
    delete cell.f;
    sheet[address] = cell;
  }
}

function mergedWidth(sheet: XLSX.WorkSheet, row: number, column: number) {
  const merge = (sheet["!merges"] || []).find(range => range.s.r === row && range.s.c === column);
  const lastColumn = merge?.e.c ?? column;
  let width = 0;
  for (let index = column; index <= lastColumn; index += 1) width += sheet["!cols"]?.[index]?.wch || 10;
  return Math.max(8, width);
}

function isMergedContinuation(sheet: XLSX.WorkSheet, row: number, column: number) {
  return (sheet["!merges"] || []).some(range => row >= range.s.r && row <= range.e.r && column >= range.s.c && column <= range.e.c && (row !== range.s.r || column !== range.s.c));
}

function fitContractRows(sheet: XLSX.WorkSheet) {
  const rows = [...(sheet["!rows"] || [])];
  for (let row = 0; row < 47; row += 1) {
    let requiredLines = 1;
    for (let column = 0; column < 10; column += 1) {
      if (isMergedContinuation(sheet, row, column)) continue;
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      const value = String(cell?.v ?? "");
      if (!value) continue;
      const capacity = Math.max(8, Math.floor(mergedWidth(sheet, row, column) * 1.35));
      const lines = value.split(/\r?\n/).reduce((total, line) => total + Math.max(1, Math.ceil(line.length / capacity)), 0);
      requiredLines = Math.max(requiredLines, lines);
    }
    const existing = rows[row]?.hpt || (rows[row]?.hpx ? rows[row]!.hpx! * .75 : 15);
    rows[row] = { ...(rows[row] || {}), hpt: Math.min(105, Math.max(existing, requiredLines * 14.5 + 2)) };
  }
  for (const row of [13, 19]) rows[row - 1] = { ...(rows[row - 1] || {}), hpt: 15 };
  sheet["!rows"] = rows;
}

function applyContractFormatting(sheet: XLSX.WorkSheet) {
  clearContractRow(sheet, 13);
  clearContractRow(sheet, 19);
  for (let row = 0; row < 47; row += 1) for (let column = 0; column < 10; column += 1) {
    styleCell(sheet, XLSX.utils.encode_cell({ r: row, c: column }), {
      font: { name: "Times New Roman" },
      alignment: { wrapText: true },
    });
  }
  for (const row of [2, 4, 5]) for (let column = 0; column < 10; column += 1) {
    styleCell(sheet, XLSX.utils.encode_cell({ r: row - 1, c: column }), { alignment: { horizontal: "center" } });
  }
  for (const address of ["H10", "H16", "D24", "H24"]) styleCell(sheet, address, { alignment: { horizontal: "left" } });
  for (const address of ["A1", "G10", "G16", "G34"]) styleCell(sheet, address, { alignment: { horizontal: "right" } });
  for (const address of ["B9", "B15", "D34", "G43", "G46"]) styleCell(sheet, address, { font: { bold: true } });
  fitContractRows(sheet);
  sheet["!ref"] = "A1:J47";
  if (sheet["!cols"]) sheet["!cols"] = sheet["!cols"]!.slice(0, 10);
  sheet["!margins"] = { left: .25, right: .25, top: .3, bottom: .3, header: 0, footer: 0 };
  sheet["!printArea"] = "A1:J47";
  sheet["!pageSetup"] = { ...(sheet["!pageSetup"] || {}), orientation: "portrait", paperSize: 9, fitToWidth: 1, fitToHeight: 1 };
}

function configureContractSheet(workbook: XLSX.WorkBook, active: DealWithSelector[]) {
  const sheet = workbook.Sheets["ДКП"];
  if (!sheet) throw new Error("В шаблоне отсутствует лист ДКП");
  const selected = active[0];
  const row = selected ? databaseRow(selected, false) : [];
  const lastDatabaseRow = Math.max(2, active.length + 1);
  sheet.I1 = styledCell(sheet.I1, selected?.__selector || "", 9);
  for (const [address, column] of Object.entries(formulaColumns)) {
    setFormula(sheet, address, `IFERROR(VLOOKUP($I$1,'База'!$A$1:$AE$${lastDatabaseRow},${column},0),"")`, formulaCachedValue(row, column));
  }
  setFormula(sheet, "G43", "B9", formulaCachedValue(row, 2));
  setFormula(sheet, "G46", "B15", formulaCachedValue(row, 7));
  applyContractFormatting(sheet);
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

function injectContractStyles(stylesXml: string) {
  let regularFontId = 1;
  let boldFontId = 2;
  const contractDateFormatId = 172;
  let xml = stylesXml.replace(/<numFmts count="(\d+)">([\s\S]*?)<\/numFmts>/, (_match, count, body) => {
    const cleaned = String(body).replace(new RegExp(`<numFmt numFmtId="${contractDateFormatId}"[^>]*/>`), "");
    return `<numFmts count="${Number(count) + 1}">${cleaned}<numFmt numFmtId="${contractDateFormatId}" formatCode="dd.mm.yyyy"/></numFmts>`;
  });
  xml = xml.replace(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/, (_match, count, body) => {
    regularFontId = Number(count);
    boldFontId = regularFontId + 1;
    const regular = '<font><name val="Times New Roman"/><family val="1"/><sz val="12"/></font>';
    const bold = '<font><b/><name val="Times New Roman"/><family val="1"/><sz val="12"/></font>';
    return `<fonts count="${Number(count) + 2}">${body}${regular}${bold}</fonts>`;
  });
  const ids = { wrap: 0, center: 0, left: 0, right: 0, bold: 0, dateLeft: 0, dateCenter: 0 };
  xml = xml.replace(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/, (_match, count, body) => {
    const first = Number(count);
    Object.assign(ids, { wrap: first, center: first + 1, left: first + 2, right: first + 3, bold: first + 4, dateLeft: first + 5, dateCenter: first + 6 });
    const xf = (fontId: number, alignment: string, numFmtId = 0) => `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"${numFmtId ? ' applyNumberFormat="1"' : ""}><alignment wrapText="1"${alignment}/></xf>`;
    const additions = [
      xf(regularFontId, ""), xf(regularFontId, ' horizontal="center"'), xf(regularFontId, ' horizontal="left"'),
      xf(regularFontId, ' horizontal="right"'), xf(boldFontId, ""), xf(regularFontId, ' horizontal="left"', contractDateFormatId),
      xf(regularFontId, ' horizontal="center"', contractDateFormatId),
    ].join("");
    return `<cellXfs count="${first + 7}">${body}${additions}</cellXfs>`;
  });
  return { xml, ids };
}

function cellStyleId(address: string, ids: ReturnType<typeof injectContractStyles>["ids"]) {
  const row = Number(address.match(/\d+$/)?.[0] || 0);
  if (["B9", "B15", "D34", "G43", "G46"].includes(address)) return ids.bold;
  if (["H10", "H16"].includes(address)) return ids.dateLeft;
  if (address === "J4") return ids.dateCenter;
  if (["D24", "H24"].includes(address)) return ids.left;
  if (["A1", "G10", "G16", "G34"].includes(address)) return ids.right;
  if ([2, 4, 5].includes(row)) return ids.center;
  return ids.wrap;
}

function setXmlCellStyle(xml: string, address: string, styleId: number) {
  const pattern = new RegExp(`<c\\b([^>]*\\br="${address}"[^>]*)>`, "g");
  if (pattern.test(xml)) return xml.replace(pattern, (_match, attributes) => `<c${String(attributes).replace(/\s+s="\d+"/g, "")} s="${styleId}">`);
  const row = address.match(/\d+$/)?.[0];
  if (!row) return xml;
  return xml.replace(new RegExp(`(<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?)(</row>)`), `$1<c r="${address}" s="${styleId}"/>$2`);
}

function applyContractStylesXml(xml: string, ids: ReturnType<typeof injectContractStyles>["ids"]) {
  xml = xml.replace(/<col\b([^>]*\bmin="(\d+)"[^>]*)\/>/g, (match, attributes, minimum) => Number(minimum) <= 10 ? `<col${String(attributes).replace(/\s+style="\d+"/g, "")} style="${ids.wrap}"/>` : match);
  xml = xml.replace(/<c\b([^>]*\br="([A-J]\d+)"[^>]*)>/g, (_match, attributes, address) => `<c${String(attributes).replace(/\s+s="\d+"/g, "")} s="${cellStyleId(address, ids)}">`);
  for (const address of ["H24", "G10", "G16", "G34"]) xml = setXmlCellStyle(xml, address, cellStyleId(address, ids));
  return xml;
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
  const styled = injectContractStyles(strFromU8(archive["xl/styles.xml"]));
  archive["xl/styles.xml"] = strToU8(styled.xml);
  let xml = applyContractStylesXml(strFromU8(source), styled.ids).replace(/<dataValidations\b[\s\S]*?<\/dataValidations>/g, "");
  xml = xml.replace(/<pageMargins\b[^>]*\/>/g, "").replace(/<pageSetup\b[^>]*\/>/g, "");
  if (!xml.includes("<sheetPr")) xml = xml.replace(/(<worksheet\b[^>]*>)/, '$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
  const validation = '<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="I1"><formula1>ContractSelectors</formula1></dataValidation></dataValidations>';
  const printSettings = '<pageMargins left="0.25" right="0.25" top="0.3" bottom="0.3" header="0" footer="0"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="1"/>';
  const marker = ["<hyperlinks", "<drawing", "<legacyDrawing", "</worksheet>"].find(item => xml.includes(item)) || "</worksheet>";
  xml = xml.replace(marker, `${validation}${printSettings}${marker}`);
  archive[sheetPath] = strToU8(xml);
  const result = zipSync(archive, { level: 6 });
  return result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer;
}

export function writeDatabaseXlsx(workbook: XLSX.WorkBook) {
  return injectSelectorValidation(writeXlsx(workbook));
}
