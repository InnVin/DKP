from __future__ import annotations

import json
import re
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from .database import OUTPUT_DIR, ROOT

TEMPLATE_PATH = ROOT / "MyFiles" / "BAZA.xls"
FILL_SCRIPT = ROOT / "tools" / "fill_baza.ps1"
POWERSHELL_32 = Path(r"C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe")


def _safe_name(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*]+', " ", value).strip()
    return re.sub(r"\s+", "_", value)[:60] or "договор"


def _output_path(deal_id: int, payload: dict[str, Any], suffix: str) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    person = payload.get("buyer_full_name") or payload.get("seller_full_name") or f"сделка_{deal_id}"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return OUTPUT_DIR / f"ДКП_{_safe_name(str(person))}_{stamp}{suffix}"


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
    ws["A1"] = "ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ"
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
            ("Тип ТС", "vehicle_type"),
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
            ws.cell(row, 3, str(payload.get(key, ""))).font = Font(name="Times New Roman")
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
    ws.cell(row, 1, "Продавец: _______________________")
    ws.cell(row, 5, "Покупатель: _____________________")
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1
    wb.save(path)


def _fill_baza_copy(template: Path, path: Path, payload: dict[str, Any]) -> int:
    if not POWERSHELL_32.exists():
        raise RuntimeError("Не найден 32-битный Windows PowerShell для работы со старым .xls")
    if not FILL_SCRIPT.exists():
        raise RuntimeError("Не найден служебный сценарий заполнения BAZA.xls")

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".json",
        encoding="utf-8",
        delete=False,
        dir=OUTPUT_DIR,
    ) as file:
        json.dump(_prepare_baza_payload(payload), file, ensure_ascii=False)
        json_path = Path(file.name)

    try:
        result = subprocess.run(
            [
                str(POWERSHELL_32),
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(FILL_SCRIPT),
                "-TemplatePath",
                str(template),
                "-OutputPath",
                str(path),
                "-JsonPath",
                str(json_path),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Ошибка заполнения BAZA.xls")
        record_id = result.stdout.strip().splitlines()[-1]
        return int(record_id)
    finally:
        json_path.unlink(missing_ok=True)


def create_contract(deal_id: int, payload: dict[str, Any]) -> tuple[Path, str]:
    if TEMPLATE_PATH.exists():
        target = _output_path(deal_id, payload, ".xls")
        record_id = _fill_baza_copy(TEMPLATE_PATH, target, payload)
        return target, f"BAZA.xls, запись № {record_id}"

    target = _output_path(deal_id, payload, ".xlsx")
    _write_default_workbook(target, payload)
    return target, "Резервный шаблон .xlsx"
