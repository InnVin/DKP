import test from "node:test";
import assert from "node:assert/strict";
import { parseModelJson } from "../lib/model-json.ts";

test("OCR JSON извлекается из Markdown", () => {
  assert.deepEqual(parseModelJson("```json\n{\"documents\":[]}\n```"), { documents: [] });
});

test("OCR JSON восстанавливает пропущенную запятую между элементами массива", () => {
  const broken = '{"documents":[{"index":1,"fields":{"seller_full_name":"Иванов"}} {"index":2,"fields":{"buyer_full_name":"Петров"}}]}';
  const result = parseModelJson(broken);
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[1].fields.buyer_full_name, "Петров");
});

test("OCR JSON удаляет лишнюю запятую", () => {
  assert.equal(parseModelJson('{"documents":[{"index":1,"fields":{}},]}').documents.length, 1);
});
