import type { DealField } from "@/types/deal";

const plateLetters: Record<string, string> = {
  A: "А",
  B: "В",
  E: "Е",
  K: "К",
  M: "М",
  H: "Н",
  O: "О",
  P: "Р",
  C: "С",
  T: "Т",
  Y: "У",
  X: "Х",
};

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:\s]+|[.,;:\s]+$/g, "");

const digits = (value: string) => value.replace(/\D/g, "");

function normalizeDate(value: string) {
  const match = value.match(/\b(\d{2})[./-](\d{2})[./-](\d{4})\b/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value;
}

function normalizePassport(value: string) {
  const compact = digits(value);
  return compact.length >= 10 ? `${compact.slice(0, 4)} ${compact.slice(4, 10)}` : value;
}

function transliteratePlate(value: string) {
  return value
    .toUpperCase()
    .split("")
    .map((char) => plateLetters[char] ?? char)
    .join("");
}

export function normalizeField(field: DealField, input: unknown) {
  let value = clean(input);
  if (!value) return "";

  if (field.endsWith("_passport")) return normalizePassport(value);
  if (
    field.endsWith("_birth_date") ||
    field.endsWith("_passport_issue_date") ||
    field === "contract_date"
  ) {
    return normalizeDate(value);
  }
  if (field === "vin") {
    return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
  }
  if (field === "body_number" || field === "chassis_number") {
    return value.toUpperCase().replace(/[^A-ZА-Я0-9-]/g, "");
  }
  if (field === "registration_plate") {
    return transliteratePlate(value).replace(/[^АВЕКМНОРСТУХ0-9]/g, "");
  }
  if (field === "pts_series_number" || field === "sts_series_number") {
    const compact = transliteratePlate(value).replace(/[^А-Я0-9]/g, "");
    return compact.length >= 10 ? `${compact.slice(0, 4)} ${compact.slice(4)}` : value.toUpperCase();
  }
  if (field.endsWith("_full_name")) {
    return value
      .toLocaleLowerCase("ru")
      .replace(/(^|\s|-)[а-яё]/g, (letter) => letter.toLocaleUpperCase("ru"));
  }
  if (field === "vehicle_make_model") return value.toUpperCase();
  if (field === "color") {
    return value.charAt(0).toLocaleUpperCase("ru") + value.slice(1).toLocaleLowerCase("ru");
  }
  return value;
}

export function normalizeRecognizedFields(fields: Partial<Record<DealField, unknown>>) {
  return Object.fromEntries(
    Object.entries(fields)
      .map(([field, value]) => [field, normalizeField(field as DealField, value)])
      .filter(([, value]) => Boolean(value)),
  ) as Partial<Record<DealField, string>>;
}
