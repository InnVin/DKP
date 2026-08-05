import assert from "node:assert/strict";
import test from "node:test";
import { formatRussianDate, normalizeAbsence, normalizeDate, normalizePlate, normalizePts, normalizeSts, sanitizeRecognizedFields } from "../lib/deal-data.ts";

test("нормализует даты паспорта для сайта и документа", () => {
  assert.equal(normalizeDate("17.09.2015"), "2015-09-17");
  assert.equal(normalizeDate("03.10.2006"), "2006-10-03");
  assert.equal(formatRussianDate("2006-10-03"), "03.10.2006");
  assert.equal(normalizeDate("31.02.2020"), "");
});

test("исправляет OCR-варианты отсутствующего номера", () => {
  for (const input of ["ОТСУТСТВУЕТ", "ОТСУСТВУЕТ", "ОТСUТСТВУЕТ", "ОТСYТСТВУЕТ"]) {
    assert.equal(normalizeAbsence(input), "ОТСУТСТВУЕТ");
  }
  const safe = sanitizeRecognizedFields({ vehicle_body: "ОТСUТСТВУЕТ", notes: "ОТСУСТВУЕТ" });
  assert.equal(safe.vehicle_body, "ОТСУТСТВУЕТ");
  assert.equal(safe.notes, "ОТСУСТВУЕТ");
});

test("не смешивает ПТС, СТС и госномер", () => {
  assert.equal(normalizePts("25 ОК 951091"), "25 ОК 951091");
  assert.equal(normalizeSts("99 66 601015"), "99 66 601015");
  assert.equal(normalizePlate("В831ЕТ14"), "В831ЕТ14");
  assert.equal(normalizePlate("25 ОК 951091"), "");
  assert.equal(normalizePlate("99 66 601015"), "");
  assert.equal(normalizeSts("25 ОК 951091"), "");
});
