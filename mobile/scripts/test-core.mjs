import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeField,
  normalizeRecognizedFields,
} from "../src/lib/field-normalization.ts";
import {
  contractFileBase,
  contractHtml,
} from "../src/lib/contract-template.ts";
import {
  isTrustedHybridNavigation,
  normalizeHybridServerUrl,
} from "../src/lib/hybrid-server.ts";

const baseDeal = {
  contract_number: "12",
  contract_date: "2026-07-29",
  contract_place: "Якутск",
  price: "850000",
  seller_full_name: "Иванов Иван Иванович",
  seller_birth_date: "01.01.1980",
  seller_phone: "",
  seller_passport: "9810 123456",
  seller_passport_issue_date: "01.02.2000",
  seller_passport_issued_by: "МВД России",
  seller_address: "г. Якутск",
  buyer_full_name: "Петров Пётр Петрович",
  buyer_birth_date: "02.02.1982",
  buyer_phone: "",
  buyer_passport: "9811 654321",
  buyer_passport_issue_date: "03.03.2003",
  buyer_passport_issued_by: "МВД России",
  buyer_address: "г. Якутск",
  vehicle_make_model: "TOYOTA COROLLA",
  vehicle_type: "B/M1",
  vehicle_year: "2015",
  vin: "JTDBR32E720123456",
  body_number: "",
  chassis_number: "ОТСУТСТВУЕТ",
  color: "Белый",
  registration_plate: "А123ВС14",
  pts_series_number: "14АА 123456",
  sts_series_number: "1414 654321",
  seller_notes: "",
  buyer_notes: "",
  vehicle_notes: "",
};

test("нормализует паспорт и даты", () => {
  assert.equal(normalizeField("seller_passport", "98 10-123456"), "9810 123456");
  assert.equal(normalizeField("contract_date", "29/07/2026"), "29.07.2026");
});

test("не допускает I, O и Q в VIN", () => {
  assert.equal(normalizeField("vin", "JTIOQ123456789012"), "JT123456789012");
});

test("переводит допустимые буквы госномера в кириллицу", () => {
  assert.equal(normalizeField("registration_plate", "A123BC14"), "А123ВС14");
});

test("нормализует набор распознанных полей", () => {
  assert.deepEqual(normalizeRecognizedFields({ vehicle_year: " 2015 ", color: "БЕЛЫЙ" }), {
    vehicle_year: "2015",
    color: "Белый",
  });
});

test("создаёт безопасное имя и HTML договора", () => {
  const file = contractFileBase(baseDeal);
  assert.match(file, /^ДКП_№12_2026-07-29_TOYOTA_COROLLA$/);
  const html = contractHtml(baseDeal);
  assert.match(html, /ДОГОВОР КУПЛИ-ПРОДАЖИ/);
  assert.match(html, /JTDBR32E720123456/);
  assert.doesNotMatch(html, /undefined/);
});

test("разрешает безопасный адрес гибридного сервера", () => {
  assert.equal(normalizeHybridServerUrl("https://dkp.example.ru/"), "https://dkp.example.ru");
  assert.equal(normalizeHybridServerUrl("http://192.168.1.15:8000/"), "http://192.168.1.15:8000");
  assert.throws(
    () => normalizeHybridServerUrl("http://public.example.ru"),
    /HTTPS/,
  );
});

test("блокирует переход WebView на другой источник", () => {
  const server = "https://dkp.example.ru";
  assert.equal(isTrustedHybridNavigation(`${server}/api/health`, server), true);
  assert.equal(isTrustedHybridNavigation("https://example.org/phishing", server), false);
});
