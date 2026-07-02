from __future__ import annotations

import re
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

try:
    import pytesseract
except ImportError:
    pytesseract = None

ROOT = Path(__file__).resolve().parents[1]
WINDOWS_OCR_SCRIPT = ROOT / "tools" / "windows_ocr.ps1"
POWERSHELL = Path(r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe")
PLATE_LATIN_TO_CYRILLIC = str.maketrans({
    "A": "А",
    "B": "В",
    "E": "Е",
    "K": "К",
    "M": "М",
    "H": "Н",
    "O": "О",
    "P": "Р",
    "C": "С",
    "T": "Т",
    "Y": "У",
    "X": "Х",
})


def _prepare_image(path: Path) -> Image.Image:
    image = Image.open(path)
    image = ImageOps.exif_transpose(image).convert("L")
    max_side = max(image.size)
    if max_side < 1800:
        factor = 1800 / max_side
        image = image.resize((int(image.width * factor), int(image.height * factor)))
    image = ImageEnhance.Contrast(image).enhance(1.7)
    return image.filter(ImageFilter.SHARPEN)


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" .,:;")


def _format_series_number(value: str) -> str:
    compact = re.sub(r"[^0-9А-ЯA-Z]", "", value.upper())
    digits = re.sub(r"\D", "", compact)
    if len(digits) >= 10:
        return f"{digits[:4]} {digits[4:10]}"
    if len(compact) >= 10:
        return f"{compact[:4]} {compact[4:10]}"
    return compact


def _normalize_plate(value: str) -> str:
    compact = re.sub(r"\s+", "", value.upper()).translate(PLATE_LATIN_TO_CYRILLIC)
    compact = re.sub(r"[^АВЕКМНОРСТУХ0-9]", "", compact)
    match = re.search(r"[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}", compact)
    return match.group(0) if match else ""


def _valid_field(key: str, value: str) -> str:
    value = _clean(value)
    if not value:
        return ""
    upper = value.upper()
    label_words = (
        "ИДЕНТИФИКАЦИОННЫЙ",
        "ГОД ВЫПУСКА",
        "ДВИГАТЕЛ",
        "ШАССИ",
        "ПРОБЕГ",
        "СВИДЕТЕЛЬСТВ",
        "МОЩНОСТЬ",
        "РАБОЧИЙ ОБЪЕМ",
    )
    if key == "vehicle_make_model":
        if len(value) > 60 or any(word in upper for word in label_words):
            return ""
        if len(re.findall(r"[A-ZА-ЯЁ]", upper)) < 3:
            return ""
    elif key == "registration_plate":
        return _normalize_plate(value)
    elif key == "vin":
        compact = re.sub(r"[^A-HJ-NPR-Z0-9]", "", upper)
        return compact if len(compact) == 17 else ""
    elif key in {"seller_passport", "buyer_passport"}:
        formatted = _format_series_number(value)
        return formatted if re.fullmatch(r"\d{4}\s\d{6}", formatted) else ""
    elif key in {"sts_series_number", "pts_series_number"}:
        compact = re.sub(r"[^А-ЯA-Z0-9]", "", upper)
        if not (8 <= len(compact) <= 18) or len(re.findall(r"\d", compact)) < 6:
            return ""
        return _format_series_number(value)
    elif key == "color":
        colors = (
            "БЕЛЫЙ", "ЧЕРНЫЙ", "ЧЁРНЫЙ", "СЕРЫЙ", "СЕРЕБРИСТЫЙ", "КРАСНЫЙ",
            "СИНИЙ", "ГОЛУБОЙ", "ЗЕЛЕНЫЙ", "ЗЕЛЁНЫЙ", "ЖЕЛТЫЙ", "ЖЁЛТЫЙ",
            "КОРИЧНЕВЫЙ", "БЕЖЕВЫЙ", "ЗОЛОТИСТЫЙ", "ФИОЛЕТОВЫЙ", "ОРАНЖЕВЫЙ",
        )
        found = next((color for color in colors if re.search(rf"\b{color}\b", upper)), "")
        return found.title()
    elif key == "vehicle_year":
        match = re.search(r"\b(19\d{2}|20\d{2})\b", value)
        return match.group(1) if match else ""
    elif key in {"body_number", "chassis_number"}:
        compact = re.sub(r"[^A-ZА-Я0-9-]", "", upper)
        return compact if len(compact.replace("-", "")) >= 5 else ""
    return value


def normalize_fields(fields: dict[str, Any]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in fields.items():
        if value is None:
            continue
        cleaned = _valid_field(key, str(value))
        if cleaned:
            normalized[key] = cleaned
    return normalized


def _find(pattern: str, text: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    return _clean(match.group(1)) if match else ""


def classify_document(text: str) -> str:
    normalized = text.upper().replace("Ё", "Е")
    if "ДОГОВОР" in normalized and "КУПЛ" in normalized and "ТРАНСПОРТ" in normalized:
        return "old_contract"
    if "ПАСПОРТ ТРАНСПОРТНОГО СРЕДСТВА" in normalized:
        return "pts"
    if "СВИДЕТЕЛЬСТВО О РЕГИСТРАЦИИ" in normalized or "РЕГИСТРАЦИОННЫЙ ЗНАК" in normalized:
        return "sts"
    if "РОССИЙСКАЯ ФЕДЕРАЦИЯ" in normalized or "МЕСТО ЖИТЕЛЬСТВА" in normalized or "PNRUS" in normalized:
        return "passport"
    return "other"


def _normalize_date(value: str) -> str:
    value = re.sub(r"[, ]+", ".", value.strip())
    return value.replace("/", ".").replace("-", ".")


def _extract_passport(text: str, prefix: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    normalized = text.upper().replace("Ё", "Е")
    passport = _find(r"(?:ПАСПОРТ|СЕРИ[ЯИ])\D{0,20}(\d{2}\s?\d{2}\s?\d{6})", normalized)
    if not passport:
        vertical = re.search(
            r"\[ВЕРТИКАЛЬНЫЙ НОМЕР ПАСПОРТА\][\s\S]*?(?:\d{2}\s+)?(\d{2})\s+(\d{2})\s+(\d{6})",
            normalized,
        )
        if vertical:
            passport = f"{vertical.group(1)}{vertical.group(2)} {vertical.group(3)}"
    compact = re.sub(r"[^A-ZА-Я0-9<]", "", normalized.upper())
    if not passport:
        mrz = re.search(r"(\d{3})(\d{6})(\d)RUS(\d{6})\d[MFМЖ].{0,15}?(\d)", compact)
        if mrz:
            passport = f"{mrz.group(1)}{mrz.group(5)} {mrz.group(2)}"
            birth = mrz.group(4)
            century = "19" if int(birth[:2]) > 30 else "20"
            fields[f"{prefix}_birth_date"] = f"{birth[4:6]}.{birth[2:4]}.{century}{birth[:2]}"
    if passport:
        fields[f"{prefix}_passport"] = re.sub(r"\s+", " ", passport)

    birth_date = _find(r"(?:ДАТА\s+РОЖДЕНИЯ|РОЖДЕНИЯ)\D{0,15}(\d{2}[./-]\d{2}[./-]\d{4})", normalized)
    issue_date = _find(r"(?:ДАТА\s+ВЫДАЧИ|ВЫДАН)\D{0,80}(\d{2}[./-]\d{2}[./-]\d{4})", normalized)
    issued_by = _find(r"(?:ПАСПОРТ\s+ВЫДАН|ВЫДАН)\s*[:№]?\s*(.+?)(?=\d{2}[./-]\d{2}[./-]\d{4}|КОД\s+ПОДРАЗДЕЛЕНИЯ|$)", normalized)
    address = _find(r"(?:МЕСТО\s+ЖИТЕЛЬСТВА|ЗАРЕГИСТРИРОВАН)\s*[:№]?\s*(.+)", normalized)

    name_parts = []
    for label in ("ФАМИЛИЯ", "ИМЯ", "ОТЧЕСТВО"):
        value = _find(rf"{label}\s*[:№]?\s*([А-ЯЁ-]{{2,}}(?:\s+[А-ЯЁ-]{{2,}})?)", normalized)
        if value:
            name_parts.append(value)
    if len(name_parts) >= 2:
        fields[f"{prefix}_full_name"] = " ".join(name_parts[:3]).title()
    elif not fields.get(f"{prefix}_full_name"):
        candidates = re.findall(
            r"\b([А-ЯЁ]{3,})\s+([А-ЯЁ]{3,})\s+([А-ЯЁ]{3,}(?:ИЧ|НА|ОГЛЫ|КЫЗЫ)?)\b",
            normalized,
        )
        excluded = {"РОССИЙСКАЯ", "ФЕДЕРАЦИЯ", "МЕСТО", "ЖИТЕЛЬСТВА", "РЕСПУБЛИКЕ", "РАЙОНЕ"}
        for candidate in candidates:
            if not any(part in excluded for part in candidate):
                fields[f"{prefix}_full_name"] = " ".join(candidate).title()
                break
    if birth_date and not fields.get(f"{prefix}_birth_date"):
        fields[f"{prefix}_birth_date"] = _normalize_date(birth_date)
    if issue_date:
        fields[f"{prefix}_passport_issue_date"] = _normalize_date(issue_date)
    if issued_by:
        fields[f"{prefix}_passport_issued_by"] = issued_by[:180]
    if address:
        fields[f"{prefix}_address"] = address[:220]
    return fields


def _extract_old_contract(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    normalized = text.replace("Ё", "Е")
    buyer_block = re.search(
        r"(?:ПОКУПАТЕЛ[ЬЯ]|ИМЕНУЕМ\w*\s+В\s+ДАЛЬНЕЙШЕМ\s*[«\"]?ПОКУПАТЕЛ)[\s\S]{0,700}?(?=1\.|ПРОДАВЕЦ\s+ПЕРЕДАЕТ|МАРКА)",
        normalized,
        re.IGNORECASE,
    )
    if buyer_block:
        block = buyer_block.group(0)
        name = _find(r"(?:ГР\.|ПОКУПАТЕЛ[ЬЯ]\s*:?)\s*([А-ЯЁ][А-ЯЁа-яё-]+(?:\s+[А-ЯЁ][А-ЯЁа-яё-]+){2})", block)
        passport = _find(r"(?:ПАСПОРТ\w*\s+СЕРИ[ЯИ])\s*(\d{2}\s?\d{2})\s*№?\s*(\d{6})", block)
        if name:
            fields["seller_full_name"] = name
        if passport:
            fields["seller_passport"] = passport

    mappings = [
        ("vehicle_make_model", r"(?:МАРКА[,\s]+МОДЕЛЬ(?:\s+ТС)?)\s*[:№]?\s*(.+)"),
        ("vin", r"(?:VIN|ИДЕНТИФИКАЦИОННЫЙ\s+НОМЕР)\s*[:№]?\s*([A-HJ-NPR-Z0-9-]{10,20})"),
        ("vehicle_year", r"(?:ГОД\s+ВЫПУСКА|ГОД\s+ИЗГОТОВЛЕНИЯ)\s*[:№]?\s*(\d{4})"),
        ("body_number", r"(?:№\s*КУЗОВА|КУЗОВ)\s*[:№]?\s*([A-ZА-Я0-9-]+)"),
        ("chassis_number", r"(?:№\s*ШАССИ|ШАССИ|РАМЫ)\s*[:№]?\s*([A-ZА-Я0-9-]+)"),
        ("color", r"(?:ЦВЕТ)\s*[:№]?\s*([А-ЯЁA-Z -]+)"),
        ("registration_plate", r"(?:ГОСУДАРСТВЕННЫЙ\s+РЕГИСТРАЦИОННЫЙ\s+ЗНАК|ГОСНОМЕР)\s*[:№]?\s*([А-ЯA-Z0-9 ]{6,12})"),
        ("sts_series_number", r"(?:СВИДЕТЕЛЬСТВО\s+О\s+РЕГИСТРАЦИИ\s+ТС|СТС|СОР)\s*[:№]?\s*([А-ЯA-Z0-9 ]{6,16})"),
        ("pts_series_number", r"(?:ПАСПОРТ\s+ТРАНСПОРТНОГО\s+СРЕДСТВА|ПТС)\s*(?:СЕРИ[ЯИ])?\s*[:№]?\s*([А-ЯA-Z0-9 ]{6,20})"),
    ]
    for key, pattern in mappings:
        value = _find(pattern, normalized)
        if value:
            fields[key] = value[:100]
    return fields


def extract_fields(text: str, document_type: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    normalized = text.replace("Ё", "Е")

    vin = _find(r"\bVIN\s*[:№]?\s*([A-HJ-NPR-Z0-9]{17})\b", normalized)
    if not vin:
        vin_match = re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", normalized, flags=re.IGNORECASE)
        vin = vin_match.group(0).upper() if vin_match else ""
    if vin:
        fields["vin"] = vin.upper()

    plate = re.search(r"\b[АВЕКМНОРСТУХABEKMHOPCTYX]\s?\d{3}\s?[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\s?\d{2,3}\b", normalized, re.IGNORECASE)
    if plate:
        fields["registration_plate"] = re.sub(r"\s+", "", plate.group(0)).upper()

    if document_type in {"sts", "pts"}:
        make_model = _find(r"(?:марка\s*,?\s*модель|марка\s+и\s+модель)\s*[:№]?\s*(.+)", normalized)
        year = _find(r"(?:год\s+выпуска|год\s+изготовления)\s*[:№]?\s*(\d{4})", normalized)
        color = _find(r"(?:цвет\s+кузова|цвет)\s*[:№]?\s*(.+)", normalized)
        body = _find(r"(?:кузов|номер\s+кузова)\s*[:№]?\s*([A-ZА-Я0-9-]+)", normalized)
        if make_model:
            fields["vehicle_make_model"] = make_model[:80]
        if year:
            fields["vehicle_year"] = year
        if color:
            fields["color"] = color[:50]
        if body:
            fields["body_number"] = body.upper()

    series_number = _find(r"(?:серия\s+и\s+номер|паспорт\s+транспортного\s+средства|свидетельство)\s*[:№]?\s*([A-ZА-Я0-9 ]{6,20})", normalized)
    if series_number:
        key = "pts_series_number" if document_type == "pts" else "sts_series_number"
        fields[key] = series_number

    if document_type in {"seller_passport", "buyer_passport"}:
        prefix = "seller" if document_type.startswith("seller") else "buyer"
        fields.update(_extract_passport(normalized, prefix))
    elif document_type == "old_contract":
        fields.update(_extract_old_contract(normalized))

    return {key: cleaned for key, value in fields.items() if (cleaned := _valid_field(key, value))}


def _windows_recognize(path: Path) -> tuple[str, list[dict[str, Any]]]:
    if not POWERSHELL.exists() or not WINDOWS_OCR_SCRIPT.exists():
        raise RuntimeError("Встроенный OCR Windows недоступен")
    result = subprocess.run(
        [
            str(POWERSHELL),
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(WINDOWS_OCR_SCRIPT),
            "-Path",
            str(path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "Ошибка Windows OCR")
    payload = json.loads(result.stdout.strip())
    pages = payload.get("pages", [])
    text = "\n\n".join(f"[Страница {page.get('page')}]\n{page.get('text', '')}" for page in pages)
    return text, pages


def _recognize_image_variants(path: Path, document_type: str) -> tuple[str, list[dict[str, Any]]]:
    texts: list[str] = []
    pages: list[dict[str, Any]] = []
    original_text, original_pages = _windows_recognize(path)
    texts.append(original_text)
    pages.extend(original_pages)

    with tempfile.TemporaryDirectory(prefix="autodogovor_ocr_") as folder:
        image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        gray = ImageOps.grayscale(image)
        gray = ImageOps.autocontrast(gray, cutoff=1)
        gray = ImageEnhance.Contrast(gray).enhance(1.7)
        max_side = max(gray.size)
        if max_side < 2200:
            factor = 2200 / max_side
            gray = gray.resize((int(gray.width * factor), int(gray.height * factor)))
        gray = gray.filter(ImageFilter.SHARPEN)
        enhanced_path = Path(folder) / "enhanced.png"
        gray.save(enhanced_path)
        enhanced_text, _ = _windows_recognize(enhanced_path)
        texts.append(enhanced_text)

        if document_type in {"seller_passport", "buyer_passport", "auto"} and image.height > image.width:
            crop = image.crop(
                (
                    int(image.width * 0.74),
                    int(image.height * 0.04),
                    image.width,
                    int(image.height * 0.92),
                )
            ).rotate(90, expand=True)
            crop = ImageEnhance.Contrast(ImageOps.grayscale(crop)).enhance(2)
            crop = crop.resize((crop.width * 3, crop.height * 3))
            number_path = Path(folder) / "passport_number.png"
            crop.save(number_path)
            number_text, _ = _windows_recognize(number_path)
            texts.append(f"[Вертикальный номер паспорта]\n{number_text}")

    return "\n\n".join(texts), pages


def recognize(path: Path, document_type: str) -> dict[str, Any]:
    try:
        if path.suffix.lower() == ".pdf":
            text, pages = _windows_recognize(path)
        else:
            text, pages = _recognize_image_variants(path, document_type)
        detected_type = classify_document(text)
        effective_type = document_type
        if document_type in {"auto", "other"} and detected_type != "passport":
            effective_type = detected_type
        if document_type == "auto" and detected_type == "passport":
            effective_type = "seller_passport"
    except Exception as exc:
        if pytesseract is None:
            return {
                "status": "error",
                "fields": {},
                "text": "",
                "note": f"Локальное распознавание не выполнено: {exc}",
            }
        try:
            image = _prepare_image(path)
            text = pytesseract.image_to_string(image, lang="rus+eng", config="--psm 6")
            pages = [{"page": 1, "text": text}]
            detected_type = classify_document(text)
            effective_type = document_type if document_type != "auto" else detected_type
        except Exception as fallback_exc:
            return {
                "status": "error",
                "fields": {},
                "text": "",
                "note": f"Локальное распознавание не выполнено: {fallback_exc}",
            }
    fields = extract_fields(text, effective_type)
    note = ""
    if text.strip() and not fields:
        note = f"[{effective_type}] Текст прочитан, но значения полей требуют ручной проверки."
    return {
        "status": "ok",
        "fields": fields,
        "text": text,
        "note": note,
        "detected_type": detected_type,
        "effective_type": effective_type,
        "pages": len(pages),
    }
