import * as XLSX from "xlsx";
import { normalizeAbsence, normalizeDate } from "./deal-data.ts";

export type ImportedDeal = Record<string, unknown> & {
  _import_source: string;
  _import_created_at: number;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function date(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const raw = text(value);
  return normalizeDate(raw.slice(0, 10));
}

function timestamp(value: unknown, fallback: number) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function absence(value: unknown) {
  const raw = text(value);
  return raw ? normalizeAbsence(raw) : "";
}

export function dealFingerprint(deal: Record<string, unknown>) {
  return ["contract_number", "seller_full_name", "buyer_full_name", "vehicle_vin", "vehicle_plate"]
    .map(key => text(deal[key]).toUpperCase().replace(/\s+/g, " "))
    .join("|");
}

export function parseLegacyDeals(bytes: ArrayBuffer, sourceName = "МойШаблон.xls", now = Date.now()) {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: true, cellFormula: true });
  const sheet = workbook.Sheets["База"];
  if (!sheet) throw new Error("В Excel-файле отсутствует лист «База»");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  if (rows.length < 2) return [];
  return rows.slice(1, 2001).flatMap((row, index) => {
    const meaningful = row.slice(1, 23).some(value => text(value));
    if (!meaningful) return [];
    const excelRow = index + 2;
    const createdAt = timestamp(row[23], timestamp(row[22], now + index));
    const deal: ImportedDeal = {
      contract_number: text(row[0]),
      contract_date: date(row[22]),
      contract_place: "Якутск",
      price: text(row[21]),
      seller_full_name: text(row[1]),
      seller_passport: text(row[2]),
      seller_passport_issued: text(row[3]),
      seller_passport_issue_date: date(row[4]),
      seller_address: text(row[5]),
      seller_phone: "",
      buyer_full_name: text(row[6]),
      buyer_passport: text(row[7]),
      buyer_passport_issued: text(row[8]),
      buyer_passport_issue_date: date(row[9]),
      buyer_address: text(row[10]),
      buyer_phone: "",
      vehicle_make_model: text(row[11]),
      vehicle_category: text(row[12]),
      vehicle_year: text(row[13]),
      vehicle_vin: absence(row[14]),
      vehicle_body: absence(row[15]),
      vehicle_chassis: absence(row[16]),
      vehicle_color: text(row[17]),
      vehicle_pts: text(row[18]),
      vehicle_sts: text(row[19]),
      vehicle_plate: text(row[20]),
      notes: `Импортировано из ${sourceName}`,
      ocr_conflicts: [],
      _import_source: `${sourceName}:База:${excelRow}`,
      _import_created_at: createdAt,
    };
    return [deal];
  });
}
