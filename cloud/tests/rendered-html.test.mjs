import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("интерфейс содержит три этапа, единые иконки и возврат", async () => {
  const source = await readFile(new URL("../app/AutoDogovorCloud.tsx", import.meta.url), "utf8");
  for (const text of ["Документы", "Данные", "Проверка", "Распознать всё", "Архив ДКП", "Вернуть", "Cloud 1.0.7"]) assert.match(source, new RegExp(text));
  assert.match(source, /lucide-react/);
  assert.match(source, /3000/);
});

test("облачное хранение и OCR остаются на сервере", async () => {
  const [hosting, ocr, schema, migration] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/deals/[id]/recognize/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_cloud.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_cloud_107.sql", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/); assert.match(hosting, /"r2": "FILES"/);
  assert.match(ocr, /OPENROUTER_API_KEY/); assert.doesNotMatch(ocr, /sk-or-/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS deals/); assert.match(schema, /generated_files/);
  assert.match(migration, /deleted_at/); assert.match(migration, /supabase_sync_queue/);
});
