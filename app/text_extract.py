from __future__ import annotations

import re
from typing import Any

from .ai_ocr import FIELD_NAMES


def extract_fields_from_text(text: str, source: str = "ocr_text", document_hint: str = "auto") -> dict[str, Any]:
    normalized = re.sub(r"[ \t]+", " ", text.replace("\r", "\n"))
    lines = [line.strip(" .,;:\t") for line in normalized.split("\n") if line.strip()]
    fields: dict[str, str] = {}
    field_meta: dict[str, dict[str, Any]] = {}

    def add(name: str, value: str, confidence: float, evidence: str) -> None:
        value = value.strip(" .,;:\n\t")
        if not value or name not in FIELD_NAMES or name in fields:
            return
        fields[name] = value
        field_meta[name] = {
            "confidence": max(0.0, min(1.0, confidence)),
            "page": 1,
            "evidence": evidence[:200],
            "source": source,
        }

    is_seller_passport = document_hint == "seller_passport"
    is_buyer_passport = document_hint == "buyer_passport"
    is_passport = is_seller_passport or is_buyer_passport
    is_vehicle_doc = document_hint in {"pts", "sts", "old_contract", "auto"}
    can_read_person = is_passport or document_hint in {"old_contract", "auto"}
    prefix = "buyer" if is_buyer_passport else "seller"

    def clean_ru_line(value: str) -> str:
        value = value.replace("—", "").strip(" .,;:\t")
        return re.sub(r"\s+", " ", value)

    def looks_like_service_line(value: str) -> bool:
        upper = value.upper()
        return bool(
            re.search(r"\d{2}[.\-/]\d{2}[.\-/]\d{4}", value)
            or re.search(r"\d{3}[-–]\d{3}", value)
            or any(word in upper for word in ["КОД ПОДРАЗДЕЛЕНИЯ", "ДАТА", "ПОДПИСЬ", "ЗАВЕРИВ"])
        )

    def is_name_part(value: str) -> bool:
        value = clean_ru_line(value)
        return bool(re.fullmatch(r"[А-ЯЁ]{3,}(?:-[А-ЯЁ]{3,})?", value))

    def next_name_before_label(label: str) -> str:
        label_upper = label.upper()
        for idx, line in enumerate(lines):
            if line.upper() == label_upper:
                for prev in range(idx - 1, max(-1, idx - 5), -1):
                    candidate = clean_ru_line(lines[prev]).upper()
                    if is_name_part(candidate):
                        return candidate
        return ""

    if is_passport:
        surname = next_name_before_label("Фамилия")
        name = next_name_before_label("Имя")
        patronymic = next_name_before_label("Отчество")
        if surname and name:
            add(f"{prefix}_full_name", " ".join(part for part in [surname, name, patronymic] if part), 0.72, "ФИО из паспорта")

        issued_by_lines: list[str] = []
        for idx, line in enumerate(lines):
            if "ПАСПОРТ ВЫДАН" in line.upper():
                inline = clean_ru_line(re.sub(r".*ПАСПОРТ ВЫДАН", "", line, flags=re.IGNORECASE))
                if inline and not looks_like_service_line(inline):
                    issued_by_lines.append(inline)
                for candidate in lines[idx + 1 : idx + 8]:
                    upper = candidate.upper()
                    if re.search(r"\d{2}[.\-/]\d{2}[.\-/]\d{4}", candidate) or "КОД ПОДРАЗДЕЛЕНИЯ" in upper:
                        break
                    cleaned = clean_ru_line(candidate)
                    if cleaned:
                        issued_by_lines.append(cleaned)
                break
        if issued_by_lines:
            add(f"{prefix}_passport_issued_by", " ".join(issued_by_lines), 0.66, "Кем выдан")

        address_lines: list[str] = []
        for idx, line in enumerate(lines):
            if "МЕСТО ЖИТЕЛЬСТВА" in line.upper():
                for candidate in lines[idx + 1 : idx + 14]:
                    upper = candidate.upper()
                    if "УФМС" in upper or looks_like_service_line(candidate):
                        break
                    if upper in {"ЗАРЕГИСТРИРОВАН", "РЕ", "РЕГ-П:", "ПУНКТ", "УЛ.", "УЛ"}:
                        continue
                    cleaned = clean_ru_line(candidate)
                    if cleaned:
                        address_lines.append(cleaned)
                break
        if address_lines:
            add(f"{prefix}_address", " ".join(address_lines), 0.55, "Адрес регистрации")

    if is_vehicle_doc:
        vin = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", normalized.upper())
        if vin:
            add("vin", vin.group(1), 0.82, vin.group(0))

    passport = re.search(r"\b(\d{2}\s?\d{2}\s?\d{6})\b", normalized)
    if passport and can_read_person:
        raw = re.sub(r"\D", "", passport.group(1))
        field = "buyer_passport" if is_buyer_passport else "seller_passport"
        add(field, f"{raw[:4]} {raw[4:]}", 0.62, passport.group(0))

    dates = re.findall(r"\b(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b", normalized)
    if is_passport and dates:
        for date in dates:
            clean_date = date.replace("/", ".").replace("-", ".")
            pos = normalized.find(date)
            context = normalized[max(0, pos - 45) : pos + 45].lower()
            if any(word in context for word in ["род", "рожд"]):
                add(f"{prefix}_birth_date", clean_date, 0.58, context)
            elif any(word in context for word in ["выдан", "выдач"]):
                add(f"{prefix}_passport_issue_date", clean_date, 0.58, context)
        if f"{prefix}_birth_date" not in fields:
            birth_match = re.search(r"(?:рождения|дата\s+пол\s+\S+\s+рождения)\D{0,30}(\d{2}[.\-/]\d{2}[.\-/]\d{4})", normalized.lower())
            if birth_match:
                add(f"{prefix}_birth_date", birth_match.group(1).replace("/", ".").replace("-", "."), 0.58, birth_match.group(0))
        if f"{prefix}_passport_issue_date" not in fields:
            issue_match = re.search(r"паспорт\s+выдан[\s\S]{0,180}?(\d{2}[.\-/]\d{2}[.\-/]\d{4})", normalized.lower())
            if issue_match:
                add(f"{prefix}_passport_issue_date", issue_match.group(1).replace("/", ".").replace("-", "."), 0.58, issue_match.group(0))
    elif dates and document_hint in {"old_contract", "auto"}:
        add("contract_date", dates[0].replace("/", ".").replace("-", "."), 0.55, dates[0])

    year = re.search(r"(?:год выпуска|год изготовления|г\.в\.|выпуска)\D{0,20}(19\d{2}|20\d{2})", normalized.lower())
    if is_vehicle_doc and year:
        add("vehicle_year", year.group(1), 0.65, year.group(0))

    if is_vehicle_doc:
        plate = re.search(r"\b([АВЕКМНОРСТУХABEKMHOPCTYX]\s?\d{3}\s?[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\s?\d{2,3})\b", normalized.upper())
        if plate:
            add("registration_plate", re.sub(r"\s+", "", plate.group(1)), 0.65, plate.group(0))

        pts = re.search(r"(?:ПТС|ПАСПОРТ ТРАНСПОРТНОГО СРЕДСТВА)[^\dА-ЯA-Z]{0,20}([А-ЯA-Z0-9]{2,4}\s?\d{6,8})", normalized.upper())
        if pts:
            add("pts_series_number", pts.group(1), 0.58, pts.group(0))

        sts = re.search(r"(?:СТС|СВИДЕТЕЛЬСТВО)[^\dА-ЯA-Z]{0,30}([А-ЯA-Z0-9]{2,4}\s?\d{6,8})", normalized.upper())
        if sts:
            add("sts_series_number", sts.group(1), 0.58, sts.group(0))

    fio_line = next(
        (
            line
            for line in lines
            if re.fullmatch(r"[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+", line)
        ),
        "",
    )
    if fio_line:
        field = "buyer_full_name" if is_buyer_passport else "seller_full_name"
        add(field, fio_line, 0.48, fio_line)

    return {"fields": fields, "field_meta": field_meta}
