import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cloud interface contains the three-stage workflow", async () => {
  const source = await readFile(new URL("../app/AutoDogovorCloud.tsx", import.meta.url), "utf8");
  assert.match(source, /1 Документы/);
  assert.match(source, /2 Данные/);
  assert.match(source, /3 Проверка/);
  assert.match(source, /Распознать всё/);
  assert.match(source, /Архив ДКП/);
});

test("cloud storage and OCR stay server-side", async () => {
  const [hosting, ocr, schema] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/deals/[id]/recognize/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_cloud.sql", import.meta.url), "utf8"),
  ]);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(ocr, /OPENROUTER_API_KEY/);
  assert.doesNotMatch(ocr, /sk-or-/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS deals/);
  assert.match(schema, /generated_files/);
});
