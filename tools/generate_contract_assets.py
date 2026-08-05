from __future__ import annotations

import json
from pathlib import Path
import shutil
import sys

import xlrd
from reportlab.lib.pagesizes import A4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.excel_service import CELL_MAP, TEMPLATE_PATH, _cell_coordinates, _fill_legacy_template, _render_pdf_jpg, _render_xls_pdf
OUTPUT = ROOT / "cloud" / "public" / "templates"
TEMP = ROOT / "tmp" / "contract-assets"
OUTPUT.mkdir(parents=True, exist_ok=True)
TEMP.mkdir(parents=True, exist_ok=True)

blank_xls = TEMP / "blank.xls"
blank_pdf = TEMP / "blank.pdf"
blank_jpeg = TEMP / "blank.jpeg"
_fill_legacy_template(blank_xls, {})
_render_xls_pdf(blank_xls, blank_pdf)
_render_pdf_jpg(blank_pdf, blank_jpeg)
shutil.copy2(blank_jpeg, OUTPUT / "baza-contract-bg.jpeg")

workbook = xlrd.open_workbook(str(TEMPLATE_PATH), formatting_info=True)
sheet = workbook.sheet_by_index(0)
page_width, page_height = A4
margin_x, margin_y = 24.0, 22.0
columns = [(sheet.colinfo_map.get(column).width / 256 if sheet.colinfo_map.get(column) else 8.43) for column in range(10)]
rows = [(sheet.rowinfo_map.get(row).height / 20 if sheet.rowinfo_map.get(row) else 15) for row in range(47)]
width_scale = (page_width - margin_x * 2) / sum(columns)
height_scale = (page_height - margin_y * 2) / sum(rows)
x = [margin_x]
for width in columns: x.append(x[-1] + width * width_scale)
y = [page_height - margin_y]
for height in rows: y.append(y[-1] - height * height_scale)
merges = {(row_start, column_start): (row_end - 1, column_end - 1) for row_start, row_end, column_start, column_end in sheet.merged_cells}
px_x, px_y = 2480 / page_width, 3508 / page_height
cloud_keys = {
    "seller_passport_issued_by": "seller_passport_issued", "buyer_passport_issued_by": "buyer_passport_issued",
    "vehicle_type": "vehicle_category", "vin": "vehicle_vin", "body_number": "vehicle_body", "chassis_number": "vehicle_chassis",
    "color": "vehicle_color", "pts_series_number": "vehicle_pts", "sts_series_number": "vehicle_sts", "registration_plate": "vehicle_plate",
}
layout = {}
for address, key in CELL_MAP.items():
    row, column = _cell_coordinates(address)
    end_row, end_column = merges.get((row, column), (row, column))
    cell = sheet.cell(row, column)
    xf = workbook.xf_list[cell.xf_index]
    font = workbook.font_list[xf.font_index]
    layout[address] = {
        "key": cloud_keys.get(key, key), "x": round(x[column] * px_x), "y": round((page_height - y[row]) * px_y),
        "width": round((x[end_column + 1] - x[column]) * px_x), "height": round((y[row] - y[end_row + 1]) * px_y),
        "fontSize": round(max(24, font.height / 20 * 300 / 72 * .98)), "bold": bool(font.bold),
        "align": {2: "center", 3: "right"}.get(xf.alignment.hor_align, "left"),
    }
(OUTPUT / "baza-contract-layout.json").write_text(json.dumps(layout, ensure_ascii=False, indent=2), encoding="utf-8")
print("OK")
