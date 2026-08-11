import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import path from "node:path";
import test from "node:test";
import { buildDatabaseWorkbook, fillContractWorkbook, readWorkbook, readXls, writeDatabaseXlsx, writeXlsx } from "../lib/excel.ts";

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

test("единая книга сохраняет связь База → ДКП и отделяет удалённые", async () => {
  const source = await fs.readFile(path.resolve("public", "templates", "MyTemplate.xls"));
  const template = readWorkbook(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
  const active = [
    { id: "aaaaaaaa-1111", contract_number: "7", contract_place: "Якутск", contract_date: "2026-08-05", seller_full_name: "Продавец 1", seller_passport_issue_date: "2015-09-17", seller_phone: "+79990000001", buyer_full_name: "Покупатель 1", buyer_phone: "+79990000002", vehicle_make_model: "TOYOTA 1", vehicle_year: "2008", created_at: 1785910000000, updated_at: 1785911000000 },
    { id: "bbbbbbbb-2222", contract_number: "7", seller_full_name: "Продавец 2", vehicle_make_model: "TOYOTA 2", vehicle_year: "2009", created_at: 1785920000000, updated_at: 1785921000000 },
    { id: "cccccccc-3333", contract_number: "", seller_full_name: "Без номера", created_at: 1785930000000, updated_at: 1785931000000 },
  ];
  const workbook = buildDatabaseWorkbook(template, active, [{ id: "dddddddd-4444", contract_number: "6", deleted_at: 1785940000000 }]);
  assert.deepEqual(workbook.SheetNames, ["ДКП", "База", "Удалённые", "Пуст"]);
  assert.equal(workbook.Sheets["База"]["!ref"], "A1:AE4");
  assert.equal(workbook.Sheets["База"].A2.v, "7-AAAAAAAA");
  assert.equal(workbook.Sheets["База"].A3.v, "7-BBBBBBBB");
  assert.equal(workbook.Sheets["База"].A4.v, "БЕЗ НОМЕРА-CCCCCCCC");
  assert.equal(workbook.Sheets["База"].B2.v, "Продавец 1");
  assert.equal(workbook.Sheets["База"].Z2.v, "+79990000001");
  assert.equal(workbook.Sheets["База"].AA2.v, "+79990000002");
  assert.equal(workbook.Sheets["Удалённые"].A2.v, "6");
  assert.equal(workbook.Sheets["ДКП"].I1.v, "7-AAAAAAAA");
  assert.match(workbook.Sheets["ДКП"].B9.f, /VLOOKUP\(\$I\$1,'База'/);
  assert.match(workbook.Sheets["ДКП"].D24.f, /,14,0\)/);
  assert.match(workbook.Sheets["ДКП"].J10.f, /,26,0\)/);
  assert.equal(workbook.Sheets["ДКП"].H10.z, "dd.mm.yyyy");
  assert.equal(workbook.Sheets["ДКП"]["!printArea"], "A1:J47");
  for (const sheet of workbook.SheetNames) for (const cell of Object.values(workbook.Sheets[sheet])) {
    if (cell && typeof cell === "object" && "f" in cell) assert.doesNotMatch(cell.f, /#REF!/);
  }
  const bytes = writeDatabaseXlsx(workbook);
  assert.deepEqual([...new Uint8Array(bytes).subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const archive = unzipSync(new Uint8Array(bytes));
  assert.match(strFromU8(archive["xl/worksheets/sheet1.xml"]), /dataValidation[^>]+sqref="I1"/);
  const reopened = readWorkbook(bytes);
  assert.deepEqual(reopened.SheetNames, ["ДКП", "База", "Удалённые", "Пуст"]);
  assert.equal(reopened.Sheets["База"].A2.v, "7-AAAAAAAA");
});
