from __future__ import annotations

from pathlib import Path
from typing import Any

from .field_postprocess import postprocess_fields
from .gemini_ocr import can_process as gemini_can_process
from .gemini_ocr import recognize_files as gemini_recognize_files
from .gemini_ocr import status as gemini_status
from .openrouter_ocr import can_process as openrouter_can_process
from .openrouter_ocr import recognize_files as openrouter_recognize_files
from .openrouter_ocr import status as openrouter_status
from .yandex_ocr import can_process as yandex_can_process
from .yandex_ocr import recognize_files as yandex_recognize_files
from .yandex_ocr import status as yandex_status

REQUIRED_BY_TYPE = {
    "seller_passport": ["seller_full_name", "seller_birth_date", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address"],
    "buyer_passport": ["buyer_full_name", "buyer_birth_date", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address"],
    "pts": ["vehicle_make_model", "vehicle_year", "body_number", "color", "pts_series_number"],
    "sts": ["vehicle_make_model", "vehicle_type", "vehicle_year", "body_number", "color", "registration_plate", "sts_series_number"],
    "vehicle_docs": ["vehicle_make_model", "vehicle_type", "vehicle_year", "body_number", "color", "registration_plate", "pts_series_number", "sts_series_number"],
    "auto": ["vehicle_make_model", "vehicle_year", "registration_plate"],
}


def _visible(paths: list[Path]) -> list[Path]:
    return [path for path in paths if path.exists()]


def _notes(document_hint: str, processed: int, warnings: list[str], missing: list[str]) -> list[str]:
    notes = [f"{document_hint}: обработано файлов {processed}."]
    notes.extend(warnings)
    if missing:
        notes.append(f"{document_hint}: не заполнены поля: {', '.join(missing)}")
    return notes


def recognize_files(paths: list[Path], document_hint: str = "auto") -> dict[str, Any]:
    paths = _visible(paths)
    if not paths:
        return {"document_type": document_hint, "fields": {}, "field_meta": {}, "text": "", "warnings": ["Нет файлов для OCR"], "engine": "none"}

    yandex = yandex_status()
    gemini = gemini_status()
    openrouter = openrouter_status()
    if not openrouter.get("configured") and not gemini.get("configured"):
        raise RuntimeError("OpenRouter или Gemini API key не настроен. Для точного распознавания добавьте ключ в config/openrouter_api_key.txt или config/gemini_api_key.txt.")

    yandex_text = ""
    warnings: list[str] = []
    if yandex.get("configured"):
        yandex_paths = [path for path in paths if yandex_can_process(path)]
        if yandex_paths:
            try:
                yandex_result = yandex_recognize_files(yandex_paths, document_hint)
                yandex_text = str(yandex_result.get("text", ""))
                warnings.extend(yandex_result.get("warnings", []))
            except RuntimeError as exc:
                warnings.append(f"Yandex OCR не сработал, Gemini использует изображения напрямую: {exc}")
        else:
            warnings.append(f"{document_hint}: нет файлов подходящих для Yandex OCR.")
    else:
        warnings.append("Yandex OCR не настроен, Gemini использует изображения напрямую.")

    openrouter_paths = [path for path in paths if openrouter_can_process(path)]
    if openrouter.get("configured") and (openrouter_paths or yandex_text.strip()):
        try:
            openrouter_result = openrouter_recognize_files(openrouter_paths, document_hint, ocr_text=yandex_text)
            fields = postprocess_fields(openrouter_result.get("fields", {}), document_hint)
            meta = {key: value for key, value in openrouter_result.get("field_meta", {}).items() if key in fields}
            required = REQUIRED_BY_TYPE.get(document_hint, [])
            missing = [name for name in required if not fields.get(name)]
            all_warnings = [*warnings, *openrouter_result.get("warnings", [])]
            if missing:
                all_warnings.append(f"{document_hint}: не заполнены поля: {', '.join(missing)}")
            return {
                "document_type": openrouter_result.get("document_type", document_hint),
                "fields": fields,
                "field_meta": meta,
                "text": yandex_text,
                "warnings": all_warnings,
                "engine": "yandex_openrouter" if yandex_text else "openrouter",
                "processed": len(openrouter_paths),
            }
        except RuntimeError as exc:
            warnings.append(f"OpenRouter OCR не сработал, пробую Gemini: {exc}")

    gemini_paths = [path for path in paths if gemini_can_process(path)]
    if not gemini.get("configured") or not gemini_paths:
        return {"document_type": document_hint, "fields": {}, "field_meta": {}, "text": yandex_text, "warnings": [*warnings, "Нет файлов подходящих для OpenRouter/Gemini OCR"], "engine": "yandex_text_only"}

    gemini_result = gemini_recognize_files(gemini_paths, document_hint, ocr_text=yandex_text)
    fields = postprocess_fields(gemini_result.get("fields", {}), document_hint)
    meta = {key: value for key, value in gemini_result.get("field_meta", {}).items() if key in fields}
    required = REQUIRED_BY_TYPE.get(document_hint, [])
    missing = [name for name in required if not fields.get(name)]
    all_warnings = [*warnings, *gemini_result.get("warnings", [])]
    if missing:
        all_warnings.append(f"{document_hint}: не заполнены поля: {', '.join(missing)}")
    return {
        "document_type": gemini_result.get("document_type", document_hint),
        "fields": fields,
        "field_meta": meta,
        "text": yandex_text,
        "warnings": all_warnings,
        "engine": "yandex_gemini" if yandex_text else "gemini",
        "processed": len(gemini_paths),
    }

