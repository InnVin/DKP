from __future__ import annotations

import re
from typing import Any

from .ai_ocr import FIELD_NAMES


def extract_fields_from_text(text: str, source: str = "ocr_text", document_hint: str = "auto") -> dict[str, Any]:
    normalized = re.sub(r"[ \t]+", " ", text.replace("\r", "\n"))
    lines = [line.strip(" .,;:\t") for line in normalized.split("\n") if line.strip()]
    upper_text = normalized.upper()
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
    is_vehicle_doc = document_hint in {"vehicle_docs", "pts", "sts", "old_contract", "auto"}
    can_read_person = is_passport or document_hint in {"old_contract", "auto"}
    prefix = "buyer" if is_buyer_passport else "seller"

    def clean_ru_line(value: str) -> str:
        value = value.replace("—", " ").replace("...", " ").strip(" .,;:\t")
        value = re.sub(r"\b\d{3}\s*(?:Дата\s+выдачи|ДАТА\s+ВЫДАЧИ)\b", " ", value)
        value = re.sub(r"\bДата\s+выдачи\b", " ", value, flags=re.IGNORECASE)
        return re.sub(r"\s+", " ", value).strip(" .,;:\t")

    def looks_like_service_line(value: str) -> bool:
        upper = value.upper()
        return bool(
            re.search(r"\d{2}[.\-/]\d{2}[.\-/]\d{4}", value)
            or re.search(r"\d{3}[-–]\d{3}", value)
            or re.fullmatch(r"\d{1,3}", value.strip())
            or any(word in upper for word in ["КОД ПОДРАЗДЕЛЕНИЯ", "ДАТА", "ПОДПИСЬ", "ЗАВЕРИВ", "ЛИЧ", "ПОЛ"])
        )

    def is_name_part(value: str) -> bool:
        value = clean_ru_line(value)
        return bool(re.fullmatch(r"[А-ЯЁ]{3,}(?:-[А-ЯЁ]{3,})?", value))

    def next_name_before_label(label: str) -> str:
        label_upper = label.upper()
        for idx, line in enumerate(lines):
            if label_upper in line.upper():
                for prev in range(idx - 1, max(-1, idx - 5), -1):
                    candidate = clean_ru_line(lines[prev]).upper()
                    if is_name_part(candidate) and candidate not in {"ЛИЧ", "ПОЛ"}:
                        return candidate
        return ""

    def passport_date_near(labels: list[str], before: int = 90, after: int = 90) -> str:
        lower = normalized.lower()
        for match in re.finditer(r"\b(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b", normalized):
            context = lower[max(0, match.start() - before) : match.end() + after]
            if any(label in context for label in labels):
                return match.group(1).replace("/", ".").replace("-", ".")
        return ""

    def clean_issued_by(value: str) -> str:
        value = clean_ru_line(value)
        value = re.sub(r"\b\d{3}\b\s*$", "", value).strip(" .,;:")
        return re.sub(r"\s+", " ", value)

    def clean_address(value: str) -> str:
        value = clean_ru_line(value)
        value = re.sub(r"\b\d{2}[.\-/]\d{2}[.\-/]\d{4}\b", " ", value)
        value = re.sub(
            r"\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b.*",
            " ",
            value,
            flags=re.IGNORECASE,
        )
        return re.sub(r"\s+", " ", value).strip(" .,;:-")

    def value_near_label(labels: list[str], max_lines: int = 2) -> str:
        for idx, line in enumerate(lines):
            upper = line.upper()
            for label in labels:
                if label not in upper:
                    continue
                tail = re.split(re.escape(label), upper, maxsplit=1)[-1]
                tail = re.sub(r"^[\s:№N\-]+", "", tail).strip()
                if tail:
                    return tail
                for candidate in lines[idx + 1 : idx + 1 + max_lines]:
                    cleaned = clean_ru_line(candidate).upper()
                    if cleaned and not looks_like_service_line(cleaned):
                        return cleaned
        return ""

    if is_passport:
        surname = next_name_before_label("Фамилия")
        name = next_name_before_label("Имя")
        patronymic = next_name_before_label("Отчество")
        if surname and name:
            add(f"{prefix}_full_name", " ".join(part for part in [surname, name, patronymic] if part), 0.74, "ФИО из паспорта")

        issued_by_lines: list[str] = []
        for idx, line in enumerate(lines):
            if "ПАСПОРТ ВЫДАН" in line.upper():
                inline = clean_ru_line(re.sub(r".*ПАСПОРТ ВЫДАН", "", line, flags=re.IGNORECASE))
                if inline and not looks_like_service_line(inline):
                    issued_by_lines.append(clean_issued_by(inline))
                for candidate in lines[idx + 1 : idx + 8]:
                    upper = candidate.upper()
                    if re.search(r"\d{2}[.\-/]\d{2}[.\-/]\d{4}", candidate) or "КОД ПОДРАЗДЕЛЕНИЯ" in upper or "ДАТА ВЫДАЧИ" in upper:
                        break
                    cleaned = clean_ru_line(candidate)
                    if cleaned and not looks_like_service_line(cleaned):
                        issued_by_lines.append(clean_issued_by(cleaned))
                break
        issued_by = " ".join(part for part in issued_by_lines if part).strip()
        if issued_by:
            add(f"{prefix}_passport_issued_by", issued_by, 0.68, "Кем выдан")

        address_lines: list[str] = []
        for idx, line in enumerate(lines):
            if "МЕСТО ЖИТЕЛЬСТВА" in line.upper():
                for candidate in lines[idx + 1 : idx + 14]:
                    upper = candidate.upper()
                    if "УФМС" in upper or "ПАСПОРТ" in upper or looks_like_service_line(candidate):
                        break
                    if upper in {"ЗАРЕГИСТРИРОВАН", "РЕ", "РЕГ-П:", "ПУНКТ", "УЛ.", "УЛ"}:
                        continue
                    cleaned = clean_address(candidate)
                    if cleaned:
                        address_lines.append(cleaned)
                break
        if address_lines:
            add(f"{prefix}_address", " ".join(address_lines), 0.58, "Адрес регистрации")

    if is_vehicle_doc:
        vin = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", upper_text)
        if vin:
            add("vin", vin.group(1), 0.82, vin.group(0))

        model_value = value_near_label(["МАРКА, МОДЕЛЬ", "МАРКА И МОДЕЛЬ", "МАРКА", "КОММЕРЧЕСКОЕ НАИМЕНОВАНИЕ"])
        if model_value:
            add("vehicle_make_model", clean_ru_line(model_value.title()), 0.56, model_value)

        body_value = value_near_label(["НОМЕР КУЗОВА", "КУЗОВ"])
        if body_value:
            add("body_number", re.sub(r"[^A-HJ-NPR-Z0-9А-ЯЁ\-]", "", body_value), 0.56, body_value)

        chassis_value = value_near_label(["НОМЕР ШАССИ", "ШАССИ", "РАМА"])
        if chassis_value:
            add("chassis_number", re.sub(r"[^A-HJ-NPR-Z0-9А-ЯЁ\-]", "", chassis_value), 0.52, chassis_value)

        color_value = value_near_label(["ЦВЕТ КУЗОВА", "ЦВЕТ"])
        if color_value:
            add("color", clean_ru_line(color_value.lower()), 0.52, color_value)

    passport = re.search(r"\b(\d{2}\s?\d{2}\s?\d{6})\b", normalized)
    if passport and can_read_person:
        raw = re.sub(r"\D", "", passport.group(1))
        field = "buyer_passport" if is_buyer_passport else "seller_passport"
        add(field, f"{raw[:4]} {raw[4:]}", 0.62, passport.group(0))

    dates = re.findall(r"\b(\d{2}[.\-/]\d{2}[.\-/]\d{4})\b", normalized)
    if is_passport and dates:
        birth_date = passport_date_near(["рожд", "дата рождения"], before=110, after=35)
        issue_date = passport_date_near(["выдан", "выдач", "дата выдачи"], before=80, after=80)
        if birth_date:
            add(f"{prefix}_birth_date", birth_date, 0.64, "Дата рядом с блоком рождения")
        if issue_date and issue_date != birth_date:
            add(f"{prefix}_passport_issue_date", issue_date, 0.64, "Дата рядом с блоком выдачи паспорта")
        if f"{prefix}_birth_date" not in fields:
            birth_match = re.search(r"(?:рождения|дата\s+пол\s+\S+\s+рождения)\D{0,30}(\d{2}[.\-/]\d{2}[.\-/]\d{4})", normalized.lower())
            if birth_match:
                add(f"{prefix}_birth_date", birth_match.group(1).replace("/", ".").replace("-", "."), 0.58, birth_match.group(0))
        if f"{prefix}_passport_issue_date" not in fields:
            issue_match = re.search(r"паспорт\s+выдан[\s\S]{0,180}?(\d{2}[.\-/]\d{2}[.\-/]\d{4})", normalized.lower())
            if issue_match:
                issue = issue_match.group(1).replace("/", ".").replace("-", ".")
                if issue != fields.get(f"{prefix}_birth_date"):
                    add(f"{prefix}_passport_issue_date", issue, 0.58, issue_match.group(0))
    elif dates and document_hint in {"old_contract", "auto"}:
        add("contract_date", dates[0].replace("/", ".").replace("-", "."), 0.55, dates[0])

    year = re.search(r"(?:год выпуска|год изготовления|г\.в\.|выпуска)\D{0,20}(19\d{2}|20\d{2})", normalized.lower())
    if is_vehicle_doc and year:
        add("vehicle_year", year.group(1), 0.65, year.group(0))

    if is_vehicle_doc:
        plate = re.search(r"\b([АВЕКМНОРСТУХABEKMHOPCTYX]\s?\d{3}\s?[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\s?\d{2,3})\b", upper_text)
        if plate:
            add("registration_plate", re.sub(r"\s+", "", plate.group(1)), 0.65, plate.group(0))

        pts = re.search(r"(?:ЭПТС|ЕПТС|ПТС|ПАСПОРТ ТРАНСПОРТНОГО СРЕДСТВА|ЭЛЕКТРОННЫЙ ПАСПОРТ(?: ТРАНСПОРТНОГО СРЕДСТВА)?)[\s\S]{0,120}?(\d{15}|\d{2}[А-ЯA-Z]{2}\s?\d{6}|\d{4}\s?\d{4})", upper_text)
        if pts:
            add("pts_series_number", pts.group(1), 0.58, pts.group(0))

        sts = re.search(r"(?:СТС|СОР|СВИДЕТЕЛЬСТВО(?: О РЕГИСТРАЦИИ)?(?: ТС)?)[\s\S]{0,120}?(\d{4}\s?\d{6}|\d{2}[А-ЯA-Z]{2}\s?\d{6})", upper_text)
        if sts:
            add("sts_series_number", sts.group(1), 0.58, sts.group(0))

        category = re.search(r"(?:КАТЕГОРИЯ\s+ТС|КАТЕГОРИЯ)\s*[:№]?\s*([A-EА-Е](?:\s*/\s*[A-ZА-Я0-9]+)?)", upper_text)
        if category:
            add("vehicle_type", category.group(1).replace(" ", ""), 0.72, category.group(0))

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


