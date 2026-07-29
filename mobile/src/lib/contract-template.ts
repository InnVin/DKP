import type { DealData } from "@/types/deal";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function displayDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

function value(data: DealData, field: keyof DealData) {
  return escapeHtml(data[field] || "________________");
}

export function contractFileBase(data: DealData) {
  const vehicle = (data.vehicle_make_model || "автомобиль")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 36);
  return `ДКП_№${data.contract_number || "без_номера"}_${data.contract_date || "без_даты"}_${vehicle}`;
}

export function contractHtml(data: DealData) {
  const date = escapeHtml(displayDate(data.contract_date));
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #111; font-family: "Times New Roman", serif; font-size: 10.5pt; line-height: 1.22; }
  h1 { margin: 0 0 3mm; text-align: center; font-size: 15pt; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 4mm; }
  h2 { margin: 3mm 0 1.5mm; padding: 1.5mm 2mm; background: #e9eef2; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1.15mm 1.5mm; border-bottom: .2mm solid #9ca6ad; vertical-align: top; }
  td:first-child { width: 32%; font-weight: bold; }
  p { margin: 2mm 0; text-align: justify; }
  .signatures { display: flex; gap: 14mm; margin-top: 8mm; }
  .signature { flex: 1; border-top: .25mm solid #222; padding-top: 1mm; text-align: center; }
</style>
</head>
<body>
  <h1>ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № ${value(data, "contract_number")}</h1>
  <div class="meta"><span>г. ${value(data, "contract_place")}</span><span>${date || "________________"}</span></div>
  <p>
    Продавец и Покупатель заключили настоящий договор о нижеследующем: Продавец передаёт
    в собственность Покупателя, а Покупатель принимает и оплачивает указанный ниже автомобиль.
  </p>

  <h2>1. Продавец</h2>
  <table>
    <tr><td>ФИО</td><td>${value(data, "seller_full_name")}</td></tr>
    <tr><td>Дата рождения</td><td>${value(data, "seller_birth_date")}</td></tr>
    <tr><td>Паспорт</td><td>${value(data, "seller_passport")}, выдан ${value(data, "seller_passport_issued_by")}, ${value(data, "seller_passport_issue_date")}</td></tr>
    <tr><td>Адрес</td><td>${value(data, "seller_address")}</td></tr>
    <tr><td>Телефон</td><td>${value(data, "seller_phone")}</td></tr>
  </table>

  <h2>2. Покупатель</h2>
  <table>
    <tr><td>ФИО</td><td>${value(data, "buyer_full_name")}</td></tr>
    <tr><td>Дата рождения</td><td>${value(data, "buyer_birth_date")}</td></tr>
    <tr><td>Паспорт</td><td>${value(data, "buyer_passport")}, выдан ${value(data, "buyer_passport_issued_by")}, ${value(data, "buyer_passport_issue_date")}</td></tr>
    <tr><td>Адрес</td><td>${value(data, "buyer_address")}</td></tr>
    <tr><td>Телефон</td><td>${value(data, "buyer_phone")}</td></tr>
  </table>

  <h2>3. Автомобиль</h2>
  <table>
    <tr><td>Марка, модель</td><td>${value(data, "vehicle_make_model")}</td></tr>
    <tr><td>Категория / год</td><td>${value(data, "vehicle_type")} / ${value(data, "vehicle_year")}</td></tr>
    <tr><td>VIN</td><td>${value(data, "vin")}</td></tr>
    <tr><td>Кузов / шасси</td><td>${value(data, "body_number")} / ${value(data, "chassis_number")}</td></tr>
    <tr><td>Цвет / госномер</td><td>${value(data, "color")} / ${value(data, "registration_plate")}</td></tr>
    <tr><td>ПТС / СТС</td><td>${value(data, "pts_series_number")} / ${value(data, "sts_series_number")}</td></tr>
  </table>

  <h2>4. Стоимость и условия</h2>
  <p>Стоимость автомобиля составляет <strong>${value(data, "price")} рублей</strong>.</p>
  <p>
    Продавец подтверждает, что автомобиль не продан, не заложен, не находится под арестом,
    не является предметом спора и свободен от прав третьих лиц. Стороны проверили сведения
    и получили по одному экземпляру договора.
  </p>
  <div class="signatures">
    <div class="signature">Продавец / ${value(data, "seller_full_name")}</div>
    <div class="signature">Покупатель / ${value(data, "buyer_full_name")}</div>
  </div>
</body>
</html>`;
}
