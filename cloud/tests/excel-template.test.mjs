import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildDatabaseWorkbook, fillContractWorkbook, readXls, writeXlsx } from "../lib/excel.ts";

test("BAZA.xls сохраняет карту ячеек и печатную область", async () => {
  const source = await fs.readFile(path.resolve("..", "MyFiles", "BAZA.xls"));
  const workbook = fillContractWorkbook(readXls(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)), {
    contract_place: "Якутск", contract_date: "2026-08-05", seller_full_name: "ПРОДАВЕЦ ТЕСТ",
    seller_passport: "9815 837951", seller_passport_issue_date: "2015-09-17", buyer_full_name: "ПОКУПАТЕЛЬ ТЕСТ",
    buyer_passport_issue_date: "2006-10-03", vehicle_make_model: "TOYOTA LAND CRUISER 200", vehicle_pts: "25 ОК 951091",
    vehicle_sts: "99 66 601015", vehicle_plate: "В831ЕТ14",
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  assert.equal(sheet.A4.v, "Якутск"); assert.equal(sheet.J4.v, "05.08.2026");
  assert.equal(sheet.H10.v, "17.09.2015"); assert.equal(sheet.H16.v, "03.10.2006");
  assert.equal(sheet.D29.v, "25 ОК 951091"); assert.equal(sheet.D30.v, "99 66 601015"); assert.equal(sheet.D31.v, "В831ЕТ14");
  assert.equal(sheet["!printArea"], "A1:J47"); assert.equal(sheet["!pageSetup"].fitToWidth, 1); assert.equal(sheet["!pageSetup"].fitToHeight, 1);
  for (const row of [13, 19]) for (const column of "ABCDEFGHIJ") assert.equal(sheet[`${column}${row}`]?.v || "", "");
  const result = writeXlsx(workbook);
  assert.ok(result.byteLength > 8_000);
  assert.deepEqual([...new Uint8Array(result).subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const reopened = readXls(result);
  assert.equal(reopened.Sheets[reopened.SheetNames[0]].D22.v, "TOYOTA LAND CRUISER 200");
});

test("единая книга содержит четыре правильных листа", async () => {
  const source = await fs.readFile(path.resolve("..", "MyFiles", "BAZA.xls"));
  const template = readXls(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
  const workbook = buildDatabaseWorkbook(template, [{ contract_number: "7", seller_full_name: "Продавец" }], [{ contract_number: "6", deleted_at: 1785910000000 }]);
  assert.deepEqual(workbook.SheetNames, ["ДКП", "База", "Удалённые", "Пуст"]);
  assert.equal(workbook.Sheets["ДКП"].B9.v, "Продавец");
  assert.equal(workbook.Sheets["Пуст"].B9.v || "", "");
  assert.equal(workbook.Sheets["База"].A2.v, "7");
  assert.equal(workbook.Sheets["Удалённые"].A2.v, "6");
});
