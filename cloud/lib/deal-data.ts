export type DealData = {
  contract_number: string;
  contract_date: string;
  contract_place: string;
  price: string;
  seller_full_name: string;
  seller_passport: string;
  seller_passport_issued: string;
  seller_passport_issue_date: string;
  seller_address: string;
  seller_phone: string;
  buyer_full_name: string;
  buyer_passport: string;
  buyer_passport_issued: string;
  buyer_passport_issue_date: string;
  buyer_address: string;
  buyer_phone: string;
  vehicle_make_model: string;
  vehicle_year: string;
  vehicle_category: string;
  vehicle_vin: string;
  vehicle_body: string;
  vehicle_chassis: string;
  vehicle_color: string;
  vehicle_plate: string;
  vehicle_pts: string;
  vehicle_sts: string;
  notes: string;
  ocr_conflicts?: OcrConflict[];
};

export type OcrConflict = {
  field: keyof DealData;
  message: string;
  sources: string[];
};

export const dealFieldKeys = [
  "contract_number", "contract_date", "contract_place", "price",
  "seller_full_name", "seller_passport", "seller_passport_issued", "seller_passport_issue_date", "seller_address", "seller_phone",
  "buyer_full_name", "buyer_passport", "buyer_passport_issued", "buyer_passport_issue_date", "buyer_address", "buyer_phone",
  "vehicle_make_model", "vehicle_year", "vehicle_category", "vehicle_vin", "vehicle_body", "vehicle_chassis", "vehicle_color",
  "vehicle_plate", "vehicle_pts", "vehicle_sts", "notes",
] as const;

const absenceFields = new Set(["vehicle_vin", "vehicle_body", "vehicle_chassis"]);
const cyrillicPlateMap: Record<string, string> = {
  A: "А", B: "В", E: "Е", K: "К", M: "М", H: "Н", O: "О", P: "Р", C: "С", T: "Т", Y: "У", X: "Х",
};

export function normalizeDate(value: unknown): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const iso = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  const ru = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  const parts = iso ? [iso[1], iso[2], iso[3]] : ru ? [ru[3], ru[2], ru[1]] : null;
  if (!parts) return "";
  const [year, month, day] = parts.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function formatRussianDate(value: unknown): string {
  const iso = normalizeDate(value);
  return iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : String(value ?? "").trim();
}

export function normalizeAbsence(value: unknown): string {
  const original = String(value ?? "").trim();
  if (!original) return "";
  const compact = original
    .toUpperCase()
    .replace(/[UY]/g, "У")
    .replace(/[A-Z]/g, letter => cyrillicPlateMap[letter] || letter)
    .replace(/[^А-ЯЁ]/g, "");
  if (/^ОТСУ?Т?С?Т?В?У?Е?Т$/.test(compact) || compact.startsWith("ОТСУТСТВ") || compact === "ОТСУСТВУЕТ") {
    return "ОТСУТСТВУЕТ";
  }
  return original.toUpperCase();
}

function toCyrillicLookalikes(value: string): string {
  return value.toUpperCase().replace(/[ABEKMHOPCTYX]/g, letter => cyrillicPlateMap[letter] || letter);
}

export function normalizePlate(value: unknown): string {
  const compact = toCyrillicLookalikes(String(value ?? "").replace(/[\s-]/g, ""));
  return /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/.test(compact) ? compact : "";
}

export function normalizePts(value: unknown): string {
  const compact = toCyrillicLookalikes(String(value ?? "").replace(/[^0-9A-Za-zА-Яа-яЁё]/g, ""));
  if (/^\d{15}$/.test(compact)) return compact;
  const paper = compact.match(/^(\d{2})([А-ЯЁ]{2})(\d{6})$/);
  return paper ? `${paper[1]} ${paper[2]} ${paper[3]}` : "";
}

export function normalizeSts(value: unknown): string {
  const compact = String(value ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(compact) ? `${compact.slice(0, 2)} ${compact.slice(2, 4)} ${compact.slice(4)}` : "";
}

export function sanitizeRecognizedFields(input: Record<string, unknown>): Partial<DealData> {
  const result: Partial<DealData> = {};
  for (const key of dealFieldKeys) {
    if (!(key in input)) continue;
    let value = String(input[key] ?? "").trim();
    if (!value) continue;
    if (key === "seller_passport_issue_date" || key === "buyer_passport_issue_date" || key === "contract_date") value = normalizeDate(value);
    if (absenceFields.has(key)) value = normalizeAbsence(value);
    if (key === "vehicle_plate") value = normalizePlate(value);
    if (key === "vehicle_pts") value = normalizePts(value);
    if (key === "vehicle_sts") value = normalizeSts(value);
    if (value) (result as Record<string, unknown>)[key] = value;
  }
  return result;
}

export function removeConflict(conflicts: OcrConflict[] | undefined, field: string): OcrConflict[] {
  return (conflicts || []).filter(item => item.field !== field);
}
