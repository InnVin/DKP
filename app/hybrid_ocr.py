from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .field_postprocess import postprocess_fields
from .openrouter_ocr import can_process as openrouter_can_process
from .openrouter_ocr import recognize_files as openrouter_recognize_files
from .openrouter_ocr import status as openrouter_status

REQUIRED_BY_TYPE = {
    "seller_passport": ["seller_full_name", "seller_birth_date", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address"],
    "buyer_passport": ["buyer_full_name", "buyer_birth_date", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address"],
    "pts": ["vehicle_make_model", "vehicle_year", "body_number", "color", "pts_series_number"],
    "sts": ["vehicle_make_model", "vehicle_type", "vehicle_year", "body_number", "color", "registration_plate", "sts_series_number"],
    "vehicle_docs": ["vehicle_make_model", "vehicle_type", "vehicle_year", "body_number", "color", "registration_plate", "pts_series_number", "sts_series_number"],
    "auto": ["vehicle_make_model", "vehicle_year", "registration_plate"],
}


def _visible(paths: list[Path]) -> list[Path]:
    unique: list[Path] = []
    hashes: set[str] = set()
    for path in paths:
        if not path.exists():
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest in hashes:
            continue
        hashes.add(digest)
        unique.append(path)
    return unique


def _resolve_candidates(
    candidates_by_field: dict[str, list[dict[str, Any]]],
    document_hint: str,
) -> tuple[dict[str, str], dict[str, list[dict[str, Any]]]]:
    resolved: dict[str, str] = {}
    conflicts: dict[str, list[dict[str, Any]]] = {}
    for field_name, candidates in candidates_by_field.items():
        variants: dict[str, dict[str, Any]] = {}
        for candidate in candidates:
            normalized = postprocess_fields(
                {field_name: candidate.get("value", "")},
                document_hint,
            ).get(field_name, "")
            if not normalized:
                continue
            variant = variants.setdefault(normalized, {
                "value": normalized,
                "pages": set(),
                "confidence": 0.0,
            })
            page = candidate.get("page")
            if page is not None:
                variant["pages"].add(str(page))
            variant["confidence"] = max(
                variant["confidence"],
                float(candidate.get("confidence", 0) or 0),
            )
        options = [
            {
                "value": item["value"],
                "support": max(1, len(item["pages"])),
                "confidence": round(item["confidence"], 2),
            }
            for item in variants.values()
        ]
        options.sort(key=lambda item: (item["support"], item["confidence"]), reverse=True)
        if not options:
            continue
        if len(options) == 1:
            resolved[field_name] = options[0]["value"]
        elif options[0]["support"] >= 2 and options[0]["support"] > options[1]["support"]:
            resolved[field_name] = options[0]["value"]
        else:
            conflicts[field_name] = options
    return resolved, conflicts


def _notes(document_hint: str, processed: int, warnings: list[str], missing: list[str]) -> list[str]:
    notes = [f"{document_hint}: обработано файлов {processed}."]
    notes.extend(warnings)
    if missing:
        notes.append(f"{document_hint}: не заполнены поля: {', '.join(missing)}")
    return notes


def recognize_files(
    paths: list[Path],
    document_hint: str = "auto",
    target_fields: list[str] | None = None,
) -> dict[str, Any]:
    paths = _visible(paths)
    if not paths:
        return {"document_type": document_hint, "fields": {}, "field_meta": {}, "text": "", "warnings": ["Нет файлов для OCR"], "engine": "none"}

    openrouter = openrouter_status()
    if not openrouter.get("configured"):
        raise RuntimeError("OpenRouter API key не настроен.")

    openrouter_paths = [path for path in paths if openrouter_can_process(path)]
    if not openrouter_paths:
        return {"document_type": document_hint, "fields": {}, "field_meta": {}, "text": "", "warnings": ["Нет файлов подходящих для OpenRouter OCR"], "engine": "none"}

    result = openrouter_recognize_files(openrouter_paths, document_hint, ocr_text="", target_fields=target_fields)
    fields = postprocess_fields(result.get("fields", {}), document_hint)
    candidate_fields, conflicts = _resolve_candidates(
        result.get("field_candidates", {}),
        document_hint,
    )
    fields.update(candidate_fields)
    for field_name in conflicts:
        fields.pop(field_name, None)
    meta = {key: value for key, value in result.get("field_meta", {}).items() if key in fields}
    required = target_fields or REQUIRED_BY_TYPE.get(document_hint, [])
    missing = [name for name in required if not fields.get(name)]
    warnings = list(result.get("warnings", []))
    if missing:
        warnings.append(f"{document_hint}: не заполнены поля: {', '.join(missing)}")
    return {
        "document_type": result.get("document_type", document_hint),
        "fields": fields,
        "field_meta": meta,
        "conflicts": conflicts,
        "text": "",
        "warnings": warnings,
        "engine": "openrouter",
        "processed": len(openrouter_paths),
    }

