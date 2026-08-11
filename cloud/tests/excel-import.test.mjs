import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";
import { parseLegacyDeals } from "../lib/excel-import.ts";

test("импортирует только заполненные строки листа База", async () => {
  const source = await fs.readFile("public/templates/MyTemplate.xls");
  const deals = parseLegacyDeals(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
  assert.equal(deals.length, 18);
  assert.equal(deals[0].contract_number, "426");
  assert.equal(deals[0].seller_full_name, "Часовников Дмитрий Юрьевич");
  assert.equal(deals[0].seller_passport_issue_date, "2006-06-05");
  assert.equal(deals[0].contract_date, "2026-04-07");
  assert.equal(deals.at(-1).contract_number, "444");
  assert.equal(deals.at(-1)._import_source, "МойШаблон.xls:База:19");
  assert.ok(deals.every(deal => deal.contract_number && deal.seller_full_name));
});
