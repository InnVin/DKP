from __future__ import annotations

import re
from typing import Any

from .ai_ocr import FIELD_NAMES
from .ocr import normalize_fields

PLATE_LATIN_TO_CYRILLIC = str.maketrans({
    "A": "А", "B": "В", "E": "Е", "K": "К", "M": "М", "H": "Н",
    "O": "О", "P": "Р", "C": "С", "T": "Т", "Y": "У", "X": "Х",
})
DATE_RE = re.compile(r"\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b")


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip(" .,;:\n\t")


def _date(value: str) -> str:
    match = DATE_RE.search(value)
    return match.group(0).replace("/", ".").replace("-", ".") if match else ""


def _passport(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) >= 10:
        return f"{digits[:4]} {digits[4:10]}"
    return ""


def _doc_series(value: str) -> str:
    compact = re.sub(r"[^0-9А-ЯA-Z]", "", value.upper())
    digits = re.sub(r"\D", "", compact)
    if len(digits) >= 10:
        return f"{digits[:4]} {digits[4:10]}"
    if 8 <= len(compact) <= 18 and len(re.findall(r"\d", compact)) >= 6:
        return f"{compact[:4]} {compact[4:10]}" if len(compact) >= 10 else compact
    return ""


def _plate(value: str) -> str:
    compact = re.sub(r"\s+", "", value.upper()).translate(PLATE_LATIN_TO_CYRILLIC)
    compact = re.sub(r"[^АВЕКМНОРСТУХ0-9]", "", compact)
    match = re.search(r"[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}", compact)
    return match.group(0) if match else ""


def _issued_by(value: str) -> str:
    value = _clean(value.replace("...", " ").replace("…", " "))
    value = re.sub(r"\b\d{3}\b", " ", value)
    value = re.sub(r"\b\d{3}[-–]\d{3}\b", " ", value)
    value = re.sub(r"\b(?:дата\s+выдачи|код\s+подразделения|личный\s+код|личная\s+подпись)\b", " ", value, flags=re.IGNORECASE)
    value = DATE_RE.sub(" ", value)
    return _clean(value)


def _address(value: str) -> str:
    value = _clean(value.replace("...", " ").replace("…", " "))
    value = DATE_RE.sub(" ", value)
    value = re.sub(
        r"\b(?:уфмс|овм|гибдд|код\s+подразделения|заверил|снят\s+с|дата\s+выдачи|паспорт\s+выдан)\b.*",
        " ",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b.*", " ", value, flags=re.IGNORECASE)
    return _clean(value)


def _vin_or_body(value: str) -> tuple[str, str]:
    compact = re.sub(r"[^A-HJ-NPR-Z0-9]", "", value.upper())
    if len(compact) == 17:
        return compact, ""
    body = re.sub(r"[^A-ZА-Я0-9-]", "", value.upper())
    return "", body if len(body.replace("-", "")) >= 5 else ""


def _name(value: str) -> str:
    value = _clean(value)
    value = re.sub(r"\b(?:ЛИЧ|ПОЛ|МУЖ|ЖЕН|866)\b", " ", value, flags=re.IGNORECASE)
    return _clean(value).title()


def postprocess_fields(fields: dict[str, Any], document_hint: str = "auto") -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for key, raw in fields.items():
        if key not in FIELD_NAMES:
            continue
        value = _clean(raw)
        if not value:
            continue
        if key.endswith("_passport"):
            value = _passport(value)
        elif key.endswith("_birth_date") or key.endswith("_passport_issue_date") or key == "contract_date":
            value = _date(value)
        elif key.endswith("_passport_issued_by"):
            value = _issued_by(value)
        elif key.endswith("_address"):
            value = _address(value)
        elif key.endswith("_full_name"):
            value = _name(value)
        elif key == "registration_plate":
            value = _plate(value)
        elif key in {"pts_series_number", "sts_series_number"}:
            value = _doc_series(value)
        elif key == "vin":
            vin, body = _vin_or_body(value)
            value = vin
            if body and "body_number" not in cleaned:
                cleaned["body_number"] = body
        elif key in {"body_number", "chassis_number"}:
            value = re.sub(r"[^A-ZА-Я0-9-]", "", value.upper())
        elif key == "color":
            value = value.title()
        elif key == "vehicle_make_model":
            value = re.sub(r"\b(?:МАРКА|МОДЕЛЬ|ТС)\b", " ", value, flags=re.IGNORECASE)
            value = _clean(value).upper()
        if value:
            cleaned[key] = value

    for prefix in ("seller", "buyer"):
        birth = cleaned.get(f"{prefix}_birth_date")
        issue = cleaned.get(f"{prefix}_passport_issue_date")
        if birth and issue and birth == issue:
            cleaned.pop(f"{prefix}_birth_date", None)

    return normalize_fields(cleaned)
