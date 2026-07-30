from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from PIL import Image, ImageDraw, ImageFont
import xlrd
from xlutils.copy import copy as copy_xls

from . import database

ROOT = database.ROOT
TEMPLATE_PATH = ROOT / "MyFiles" / "BAZA.xls"
FONT_REGULAR = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")


def _safe_name(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]+', " ", value).strip()
    return re.sub(r"\s+", "_", value)[:60] or "договор"


def _output_path(deal_id: int, payload: dict[str, Any], suffix: str) -> Path:
    folder = database.generated_dir(deal_id)
    person = payload.get("buyer_full_name") or payload.get("seller_full_name") or f"сделка_{deal_id}"
    return folder / f"ДКП_{_safe_name(str(person))}{suffix}"


def _format_ru_date(value: Any) -> Any:
    text = str(value or "").strip()
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%d.%m.%Y")
    except ValueError:
        return value


def _prepare_baza_payload(payload: dict[str, Any]) -> dict[str, Any]:
    prepared = dict(payload)
    for key in ("contract_date", "seller_passport_issue_date", "buyer_passport_issue_date"):
        prepared[key] = _format_ru_date(prepared.get(key, ""))
    return prepared


def _image_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REGULAR
    return ImageFont.truetype(str(path), size=size)


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words = str(text or "").split()
    if not words:
        return [""]
    lines: list[str] = []
    line = words[0]
    for word in words[1:]:
        candidate = f"{line} {word}"
        if draw.textlength(candidate, font=font) <= width:
            line = candidate
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def _draw_wrapped(
    draw: ImageDraw.ImageDraw,
    text: str,
    x: int,
    y: int,
    width: int,
    font: ImageFont.FreeTypeFont,
    *,
    line_height: int,
) -> int:
    for line in _wrap_text(draw, text, font, width):
        draw.text((x, y), line, fill="#111111", font=font)
        y += line_height
    return y


def _render_contract_outputs(
    pdf_path: Path,
    jpg_path: Path,
    payload: dict[str, Any],
) -> None:
    data = _prepare_baza_payload(payload)
    image = Image.new("RGB", (1240, 1754), "white")
    draw = ImageDraw.Draw(image)
    regular = _image_font(20)
    small = _image_font(18)
    bold = _image_font(20, bold=True)
    title = _image_font(27, bold=True)
    left, right = 72, 1168
    width = right - left
    y = 55

    heading = "Д О Г О В О Р"
    draw.text(((1240 - draw.textlength(heading, font=title)) / 2, y), heading, fill="#111111", font=title)
    y += 36
    subtitle = "КУПЛИ - ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА"
    draw.text(((1240 - draw.textlength(subtitle, font=bold)) / 2, y), subtitle, fill="#111111", font=bold)
    y += 48
    draw.text((left, y), str(data.get("contract_place", "")), fill="#111111", font=regular)
    date_text = str(data.get("contract_date", ""))
    draw.text((right - draw.textlength(date_text, font=regular), y), date_text, fill="#111111", font=regular)
    y += 38

    def section(text: str) -> None:
        nonlocal y
        draw.text((left, y), text, fill="#111111", font=bold)
        y += 31

    def field(label: str, value: Any) -> None:
        nonlocal y
        label_width = 330
        lines = _wrap_text(draw, str(value or ""), regular, width - label_width)
        row_height = max(31, len(lines) * 25 + 6)
        draw.text((left + 10, y + 4), label, fill="#111111", font=bold)
        line_y = y + 4
        for line in lines:
            draw.text((left + label_width, line_y), line, fill="#111111", font=regular)
            line_y += 25
        draw.line((left, y + row_height, right, y + row_height), fill="#c6c6c6", width=1)
        y += row_height

    section("1. Стороны договора.")
    draw.text((left, y), "Продавец:", fill="#111111", font=bold)
    y += 29
    field("Гр.", data.get("seller_full_name"))
    field("Паспорт:", f"{data.get('seller_passport', '')} от {data.get('seller_passport_issue_date', '')}".strip())
    field("Выдан:", data.get("seller_passport_issued_by"))
    field("Адрес:", data.get("seller_address"))
    y += 6
    draw.text((left, y), "Покупатель:", fill="#111111", font=bold)
    y += 29
    field("Гр.", data.get("buyer_full_name"))
    field("Паспорт:", f"{data.get('buyer_passport', '')} от {data.get('buyer_passport_issue_date', '')}".strip())
    field("Выдан:", data.get("buyer_passport_issued_by"))
    field("Адрес:", data.get("buyer_address"))
    y += 10

    section("2. Предмет договора.")
    y = _draw_wrapped(
        draw,
        "2.1. Продавец обязуется передать в собственность покупателя, а покупатель обязуется принять и оплатить следующее транспортное средство (далее ТС):",
        left,
        y,
        width,
        small,
        line_height=23,
    ) + 5
    for label, key in (
        ("Марка, модель", "vehicle_make_model"),
        ("Тип транспортного средства", "vehicle_type"),
        ("Год изготовления ТС", "vehicle_year"),
        ("Идент. № (VIN)", "vin"),
        ("№ кузова:", "body_number"),
        ("№ шасси (рамы):", "chassis_number"),
        ("Цвет", "color"),
        ("Паспорт ТС", "pts_series_number"),
        ("СТС СОР", "sts_series_number"),
        ("Госномер", "registration_plate"),
    ):
        field(label, data.get(key))

    section("3. Стоимость ТС и порядок оплаты.")
    y = _draw_wrapped(
        draw,
        f"3.1. Стоимость {data.get('price', '')} рублей. 3.2. Покупатель оплачивает стоимость автомобиля наличными и/или безналичными денежными средствами в момент подписания настоящего договора. 3.3. Продавец передает ТС в момент подписания настоящего договора.",
        left,
        y,
        width,
        small,
        line_height=22,
    ) + 7
    section("4. Заключительные положения")
    y = _draw_wrapped(
        draw,
        "4.1. Договор вступает в силу с момента его подписания сторонами. 4.2. Настоящий договор также является Актом приема-передачи ТС и составлен в трех экземплярах, имеющих одинаковую юридическую силу. 4.3. Договор может быть изменен Дополнительным соглашением по согласию сторон. 4.4. Стороны не имеют претензий друг к другу.",
        left,
        y,
        width,
        small,
        line_height=22,
    )
    signature_y = min(1680, max(y + 34, 1600))
    half = width // 2 - 30
    draw.line((left, signature_y, left + half, signature_y), fill="#222222", width=1)
    draw.line((right - half, signature_y, right, signature_y), fill="#222222", width=1)
    draw.text((left, signature_y + 7), f"Продавец: {data.get('seller_full_name', '')}", fill="#111111", font=small)
    draw.text((right - half, signature_y + 7), f"Покупатель: {data.get('buyer_full_name', '')}", fill="#111111", font=small)
    image.save(jpg_path, "JPEG", quality=94, optimize=True)
    image.save(pdf_path, "PDF", resolution=150.0)


def _write_default_workbook(path: Path, payload: dict[str, Any]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Договор"
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_margins.left = 0.35
    ws.page_margins.right = 0.35
    ws.page_margins.top = 0.4
    ws.page_margins.bottom = 0.4
    ws.print_area = "A1:H48"

    widths = [4, 18, 18, 18, 18, 18, 18, 4]
    for index, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width

    ws.merge_cells("A1:H2")
    contract_number = str(payload.get("contract_number", "")).strip()
    ws["A1"] = f"ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № {contract_number}" if contract_number else "ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ"
    ws["A1"].font = Font(name="Times New Roman", size=15, bold=True)
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A3:D3")
    ws.merge_cells("E3:H3")
    ws["A3"] = f"г. {payload.get('contract_place', '')}"
    ws["E3"] = payload.get("contract_date", "")
    ws["E3"].alignment = Alignment(horizontal="right")

    sections = [
        ("ПРОДАВЕЦ", [
            ("ФИО", "seller_full_name"),
            ("Дата рождения", "seller_birth_date"),
            ("Паспорт", "seller_passport"),
            ("Выдан", "seller_passport_issued_by"),
            ("Дата выдачи", "seller_passport_issue_date"),
            ("Адрес", "seller_address"),
            ("Телефон", "seller_phone"),
        ]),
        ("ПОКУПАТЕЛЬ", [
            ("ФИО", "buyer_full_name"),
            ("Дата рождения", "buyer_birth_date"),
            ("Паспорт", "buyer_passport"),
            ("Выдан", "buyer_passport_issued_by"),
            ("Дата выдачи", "buyer_passport_issue_date"),
            ("Адрес", "buyer_address"),
            ("Телефон", "buyer_phone"),
        ]),
        ("АВТОМОБИЛЬ", [
            ("Марка, модель", "vehicle_make_model"),
            ("Категория ТС", "vehicle_type"),
            ("Год выпуска", "vehicle_year"),
            ("VIN", "vin"),
            ("Кузов", "body_number"),
            ("Шасси", "chassis_number"),
            ("Цвет", "color"),
            ("Госномер", "registration_plate"),
            ("ПТС", "pts_series_number"),
            ("СТС", "sts_series_number"),
        ]),
    ]

    row = 5
    thin = Side(style="thin", color="808080")
    for title, items in sections:
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
        cell = ws.cell(row, 1, title)
        cell.font = Font(name="Times New Roman", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="315B7D")
        cell.alignment = Alignment(horizontal="center")
        row += 1
        for label, key in items:
            ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=2)
            ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=8)
            ws.cell(row, 1, label).font = Font(name="Times New Roman", bold=True)
            ws.cell(row, 3, str(payload.get(key, ""))).font = Font(name="Times New Roman", size=10)
            for col in range(1, 9):
                ws.cell(row, col).border = Border(bottom=thin)
            row += 1
        row += 1

    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=8)
    ws.cell(row, 1, f"Стоимость автомобиля: {payload.get('price', '')} руб.")
    ws.cell(row, 1).font = Font(name="Times New Roman", bold=True)
    row += 2
    ws.merge_cells(start_row=row, start_column=1, end_row=row + 2, end_column=8)
    ws.cell(
        row,
        1,
        "Продавец передал, а Покупатель принял автомобиль и документы на него. "
        "Стороны подтверждают правильность указанных данных и отсутствие взаимных претензий.",
    )
    ws.cell(row, 1).alignment = Alignment(wrap_text=True, vertical="top")
    ws.cell(row, 1).font = Font(name="Times New Roman")
    row += 4
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
    ws.merge_cells(start_row=row, start_column=5, end_row=row, end_column=8)
    seller_name = str(payload.get("seller_full_name", "")).strip()
    buyer_name = str(payload.get("buyer_full_name", "")).strip()
    ws.cell(row, 1, f"Продавец: __________ / {seller_name}")
    ws.cell(row, 5, f"Покупатель: ________ / {buyer_name}")
    ws.cell(row, 1).font = Font(name="Times New Roman", size=10)
    ws.cell(row, 5).font = Font(name="Times New Roman", size=10)
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    wb.save(path)


def _fill_baza_copy(
    template: Path,
    xls_path: Path,
    pdf_path: Path,
    jpg_path: Path,
    payload: dict[str, Any],
) -> None:
    xls_path.parent.mkdir(parents=True, exist_ok=True)
    data = _prepare_baza_payload(payload)
    source = xlrd.open_workbook(str(template), formatting_info=True)
    writable = copy_xls(source)
    sheet = writable.get_sheet(source.sheet_names().index("Пуст"))
    cells = {
        (3, 0): data.get("contract_place"),
        (3, 9): data.get("contract_date"),
        (8, 1): data.get("seller_full_name"),
        (9, 3): data.get("seller_passport"),
        (9, 7): data.get("seller_passport_issue_date"),
        (10, 3): data.get("seller_passport_issued_by"),
        (11, 3): data.get("seller_address"),
        (14, 1): data.get("buyer_full_name"),
        (15, 3): data.get("buyer_passport"),
        (15, 7): data.get("buyer_passport_issue_date"),
        (16, 3): data.get("buyer_passport_issued_by"),
        (17, 3): data.get("buyer_address"),
        (21, 3): data.get("vehicle_make_model"),
        (22, 3): data.get("vehicle_type"),
        (23, 3): data.get("vehicle_year"),
        (24, 3): data.get("vin"),
        (25, 3): data.get("body_number"),
        (26, 3): data.get("chassis_number"),
        (27, 3): data.get("color"),
        (28, 3): data.get("pts_series_number"),
        (29, 3): data.get("sts_series_number"),
        (30, 3): data.get("registration_plate"),
        (33, 3): data.get("price"),
        (42, 6): data.get("seller_full_name"),
        (45, 6): data.get("buyer_full_name"),
    }
    for (row, column), value in cells.items():
        if value is not None and str(value).strip():
            sheet.write(row, column, str(value))
    writable.save(str(xls_path))
    _render_contract_outputs(pdf_path, jpg_path, payload)


def create_contract(deal_id: int, payload: dict[str, Any]) -> list[dict[str, str]]:
    if TEMPLATE_PATH.exists():
        xls_path = _output_path(deal_id, payload, ".xls")
        pdf_path = _output_path(deal_id, payload, ".pdf")
        jpg_path = _output_path(deal_id, payload, ".jpg")
        _fill_baza_copy(TEMPLATE_PATH, xls_path, pdf_path, jpg_path, payload)
        return [
            {
                "kind": "xls",
                "name": xls_path.name,
                "stored_path": str(xls_path),
                "media_type": "application/vnd.ms-excel",
            },
            {
                "kind": "pdf",
                "name": pdf_path.name,
                "stored_path": str(pdf_path),
                "media_type": "application/pdf",
            },
            {
                "kind": "jpg",
                "name": jpg_path.name,
                "stored_path": str(jpg_path),
                "media_type": "image/jpeg",
            },
        ]

    target = _output_path(deal_id, payload, ".xlsx")
    _write_default_workbook(target, payload)
    return [
        {
            "kind": "xlsx",
            "name": target.name,
            "stored_path": str(target),
            "media_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
    ]
