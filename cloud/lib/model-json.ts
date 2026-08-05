function modelText(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map(item => {
    if (!item || typeof item !== "object") return "";
    const text = (item as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }).join("");
}

function repairJson(text: string) {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/}\s*{/g, "},{")
    .replace(/]\s*\[/g, "],[");
}

export function parseModelJson<T extends Record<string, unknown>>(value: unknown): T {
  const text = modelText(value).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Сервис распознавания вернул неверный формат");
  const source = text.slice(start, end + 1);
  try {
    return JSON.parse(source) as T;
  } catch {
    try {
      return JSON.parse(repairJson(source)) as T;
    } catch {
      throw new Error("Сервис распознавания вернул повреждённые данные. Запрос повторён, но ответ снова некорректен");
    }
  }
}
