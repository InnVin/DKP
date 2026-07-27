from __future__ import annotations

import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from . import database
from .ai_ocr import FIELD_NAMES
from .excel_service import create_contract
from .hybrid_ocr import recognize_files as hybrid_recognize_files
from .openrouter_ocr import can_process as openrouter_can_process
from .openrouter_ocr import status as openrouter_status
from .ocr import normalize_fields

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "app" / "static"
ALLOWED_DOCUMENT_TYPES = {"auto", "seller_passport", "buyer_passport", "vehicle_docs", "pts", "sts", "old_contract", "other"}
ALLOWED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".heic",
    ".bmp",
    ".tif",
    ".tiff",
    ".psd",
    ".pdf",
    ".xls",
    ".xlsx",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="АвтоДоговор", version="0.1.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.middleware("http")
async def disable_browser_cache(request, call_next):
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response


class DealPayload(BaseModel):
    deal_id: int | None = None
    data: dict[str, Any]


def _notes_by_group(notes: list[str]) -> dict[str, str]:
    groups = {"seller": [], "buyer": [], "vehicle": []}
    for note in notes:
        lowered = note.lower()
        if "buyer" in lowered or "покуп" in lowered:
            groups["buyer"].append(note)
        elif any(word in lowered for word in ["pts", "sts", "птс", "стс", "vehicle", "auto", "авто", "дкп"]):
            groups["vehicle"].append(note)
        else:
            groups["seller"].append(note)
    return {key: "\n\n".join(value) for key, value in groups.items()}


def _recognition_group(document_type: str) -> str:
    if document_type in {"vehicle_docs", "pts", "sts"}:
        return "vehicle_docs"
    return document_type


def _fields_for_document(document_type: str, fields: dict[str, Any]) -> dict[str, Any]:
    if document_type == "seller_passport":
        return {key: value for key, value in fields.items() if key.startswith("seller_")}
    if document_type == "buyer_passport":
        return {key: value for key, value in fields.items() if key.startswith("buyer_")}
    if document_type in {"vehicle_docs", "pts", "sts"}:
        return {
            key: value
            for key, value in fields.items()
            if not key.startswith(("seller_", "buyer_")) and key not in {"price", "contract_date", "contract_place"}
        }
    return fields


def _persist_recognized_fields(deal_id: int, fields: dict[str, Any]) -> None:
    if not fields:
        return
    deal = database.get_deal(deal_id)
    if not deal:
        return
    deal.pop("_meta", None)
    deal.pop("documents", None)
    deal.update({key: value for key, value in fields.items() if value not in (None, "")})
    database.save_deal(deal, deal_id)


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "database": str(database.DB_PATH),
        "openrouter_ocr": openrouter_status(),
        "version": app.version,
    }


@app.get("/api/deals")
def list_deals(q: str = "") -> list[dict[str, Any]]:
    return database.search_deals(q)


@app.get("/api/deals-next-number")
def next_deal_number() -> dict[str, int]:
    return {"contract_number": database.next_contract_number()}


@app.get("/api/deals-trash")
def list_deleted_deals() -> list[dict[str, Any]]:
    return database.list_deleted_deals()


@app.get("/api/deals/{deal_id}")
def read_deal(deal_id: int) -> dict[str, Any]:
    deal = database.get_deal(deal_id)
    if not deal:
        raise HTTPException(404, "Сделка не найдена")
    return deal


@app.post("/api/deals")
def write_deal(payload: DealPayload) -> dict[str, Any]:
    try:
        deal_id = database.save_deal(payload.data, payload.deal_id)
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    return {"id": deal_id, "message": "Сделка сохранена"}


@app.post("/api/deals/{deal_id}/documents")
async def upload_document(
    deal_id: int,
    document_type: str = Form(...),
    defer_ocr: bool = Form(False),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    if not database.get_deal(deal_id):
        raise HTTPException(404, "Сначала сохраните карточку сделки")
    if document_type not in ALLOWED_DOCUMENT_TYPES:
        raise HTTPException(400, "Неизвестный тип документа")

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Формат файла не поддерживается")

    folder = database.UPLOAD_DIR / str(deal_id)
    folder.mkdir(parents=True, exist_ok=True)
    stored = folder / f"{uuid.uuid4().hex}{suffix}"
    with stored.open("wb") as destination:
        shutil.copyfileobj(file.file, destination)
    if defer_ocr:
        result = {
            "status": "stored_for_batch",
            "fields": {},
            "field_meta": {},
            "conflicts": {},
            "text": "",
            "note": "",
            "detected_type": document_type,
            "effective_type": document_type,
            "pages": 1,
        }
    elif openrouter_can_process(stored):
        existing_paths = [
            Path(document["stored_path"])
            for document in database.get_deal_documents(deal_id)
            if document["document_type"] == document_type and Path(document["stored_path"]).exists() and openrouter_can_process(Path(document["stored_path"]))
        ]
        group_paths = [*existing_paths, stored]
        try:
            ai_result = await run_in_threadpool(hybrid_recognize_files, group_paths, document_type)
            result = {
                "status": ai_result.get("engine", "openrouter"),
                "fields": ai_result.get("fields", {}),
                "field_meta": ai_result.get("field_meta", {}),
                "conflicts": ai_result.get("conflicts", {}),
                "text": ai_result.get("text", ""),
                "note": "\n".join(ai_result.get("warnings", [])),
                "detected_type": ai_result.get("document_type", document_type),
                "effective_type": document_type,
                "pages": len(group_paths),
            }
        except RuntimeError as exc:
            result = {
                "status": "waiting_cloud_ocr",
                "fields": {},
                "field_meta": {},
                "conflicts": {},
                "text": "",
                "note": f"Файл сохранён, но OpenRouter не выполнил распознавание: {exc}",
                "detected_type": document_type,
                "effective_type": document_type,
                "pages": 1,
            }
    else:
        result = {
            "status": "stored",
            "fields": {},
            "field_meta": {},
            "text": "",
            "note": "Файл сохранён как вложение. Для распознавания нужен поддерживаемый OpenRouter формат.",
            "detected_type": document_type,
            "effective_type": document_type,
            "pages": 1,
        }

    result["fields"] = normalize_fields(result.get("fields", {}))
    _persist_recognized_fields(deal_id, _fields_for_document(document_type, result["fields"]))
    document_id = database.add_document(
        deal_id,
        document_type,
        file.filename or stored.name,
        str(stored),
        result.get("text", ""),
        result.get("status", "unknown"),
    )
    return {
        "document_id": document_id,
        "fields": result.get("fields", {}),
        "field_meta": result.get("field_meta", {}),
        "conflicts": result.get("conflicts", {}),
        "note": result.get("note", ""),
        "status": result.get("status", ""),
        "file_size": stored.stat().st_size if stored.exists() else 0,
        "detected_type": result.get("detected_type", document_type),
        "effective_type": result.get("effective_type", document_type),
        "pages": result.get("pages", 1),
    }


@app.delete("/api/documents/{document_id}")
def delete_document(document_id: int) -> dict[str, Any]:
    if not database.delete_document(document_id):
        raise HTTPException(404, "Документ не найден")
    return {"deleted": True}


@app.delete("/api/deals/{deal_id}")
def delete_deal(deal_id: int) -> dict[str, Any]:
    if not database.delete_deal(deal_id):
        raise HTTPException(404, "Сделка не найдена")
    return {"deleted": True}


@app.post("/api/deals/{deal_id}/restore")
def restore_deal(deal_id: int) -> dict[str, Any]:
    if not database.restore_deal(deal_id):
        raise HTTPException(404, "Сделка не найдена в корзине")
    return {"restored": True}


@app.delete("/api/deals/{deal_id}/permanent")
def permanently_delete_deal(deal_id: int) -> dict[str, Any]:
    if not database.permanently_delete_deal(deal_id):
        raise HTTPException(404, "ДКП не найден в корзине")
    return {"deleted": True, "permanent": True}


@app.get("/api/documents/{document_id}")
def download_document(document_id: int) -> FileResponse:
    path = database.get_document_path(document_id)
    if not path or not path.exists():
        raise HTTPException(404, "Файл не найден")
    return FileResponse(path)


@app.post("/api/deals/{deal_id}/reprocess")
async def reprocess_documents(deal_id: int, section: str = "all") -> dict[str, Any]:
    deal = database.get_deal(deal_id)
    if not deal:
        raise HTTPException(404, "Сделка не найдена")
    documents = database.get_deal_documents(deal_id)
    if not documents:
        return {"processed": 0, "fields": {}, "field_meta": {}, "notes": "Нет загруженных документов.", "notes_by_group": _notes_by_group(["Нет загруженных документов."])}

    combined_fields: dict[str, str] = {}
    combined_meta: dict[str, dict[str, Any]] = {}
    combined_conflicts: dict[str, list[dict[str, Any]]] = {}
    notes: list[str] = []
    processed = 0
    grouped: dict[str, list[dict[str, Any]]] = {}
    allowed_document_types = {
        "contract": {"old_contract"},
        "seller": {"seller_passport", "old_contract"},
        "buyer": {"buyer_passport"},
        "vehicle": {"vehicle_docs", "pts", "sts", "old_contract"},
        "notes": ALLOWED_DOCUMENT_TYPES,
        "all": ALLOWED_DOCUMENT_TYPES,
    }
    allowed_fields = {
        "contract": {"contract_date", "contract_place", "price"},
        "seller": {"seller_full_name", "seller_birth_date", "seller_phone", "seller_passport", "seller_passport_issue_date", "seller_passport_issued_by", "seller_address"},
        "buyer": {"buyer_full_name", "buyer_birth_date", "buyer_phone", "buyer_passport", "buyer_passport_issue_date", "buyer_passport_issued_by", "buyer_address"},
        "vehicle": {"vehicle_make_model", "vehicle_type", "vehicle_year", "vin", "body_number", "chassis_number", "color", "registration_plate", "pts_series_number", "sts_series_number"},
        "notes": set(),
    }
    if section not in allowed_document_types:
        raise HTTPException(400, "Неизвестный раздел распознавания")
    for document in documents:
        if document["document_type"] in allowed_document_types[section]:
            grouped.setdefault(_recognition_group(document["document_type"]), []).append(document)

    group_priority = {"old_contract": 0, "other": 1, "seller_passport": 2, "buyer_passport": 2, "vehicle_docs": 3}
    for document_type, group in sorted(grouped.items(), key=lambda item: group_priority.get(item[0], 1)):
        ocr_documents = [
            document
            for document in group
            if Path(document["stored_path"]).exists() and openrouter_can_process(Path(document["stored_path"]))
        ]
        if not ocr_documents:
            notes.append(f"{document_type}: нет файлов подходящих для OpenRouter OCR.")
            continue
        paths = [Path(document["stored_path"]) for document in ocr_documents]
        try:
            result = await run_in_threadpool(hybrid_recognize_files, paths, document_type)
        except RuntimeError as exc:
            notes.append(f"{document_type}: OpenRouter не выполнил распознавание: {exc}")
            continue
        combined_fields.update(result.get("fields", {}))
        combined_meta.update(result.get("field_meta", {}))
        combined_conflicts.update(result.get("conflicts", {}))
        notes.extend(result.get("warnings", []))
        text = result.get("text", "")
        status = result.get("engine", "openrouter")
        for document in ocr_documents:
            database.update_document_ocr(document["id"], text, status)
            processed += 1

    if not processed and not notes:
        notes.append("OCR не выполнился. Проверьте OpenRouter API key и форматы файлов.")
    fields = normalize_fields(combined_fields)
    if section != "all":
        fields = {key: value for key, value in fields.items() if key in allowed_fields[section]}
    _persist_recognized_fields(deal_id, fields)
    return {
        "processed": processed,
        "fields": fields,
        "field_meta": {key: value for key, value in combined_meta.items() if key in fields},
        "conflicts": combined_conflicts,
        "notes": "\n\n".join(notes),
        "notes_by_group": _notes_by_group(notes),
    }


@app.post("/api/deals/{deal_id}/reprocess-field")
async def reprocess_single_field(deal_id: int, field_name: str) -> dict[str, Any]:
    if field_name not in FIELD_NAMES:
        raise HTTPException(400, "Это поле не поддерживает распознавание")
    if not database.get_deal(deal_id):
        raise HTTPException(404, "Сделка не найдена")

    if field_name.startswith("seller_"):
        document_types, document_hint = {"seller_passport", "old_contract"}, "seller_passport"
    elif field_name.startswith("buyer_"):
        document_types, document_hint = {"buyer_passport"}, "buyer_passport"
    elif field_name in {"contract_number", "contract_date", "contract_place", "price"}:
        document_types, document_hint = {"old_contract"}, "old_contract"
    else:
        document_types, document_hint = {"vehicle_docs", "pts", "sts", "old_contract"}, "vehicle_docs"

    documents = database.get_deal_documents(deal_id)
    paths = [
        Path(document["stored_path"])
        for document in documents
        if document["document_type"] in document_types
        and Path(document["stored_path"]).exists()
        and openrouter_can_process(Path(document["stored_path"]))
    ]
    if not paths:
        return {
            "processed": 0,
            "fields": {},
            "field_meta": {},
            "conflicts": {},
            "notes": "Нет подходящих документов для этого поля.",
        }

    try:
        result = await run_in_threadpool(
            hybrid_recognize_files,
            paths,
            document_hint,
            [field_name],
        )
    except RuntimeError as exc:
        raise HTTPException(502, f"OpenRouter не выполнил распознавание: {exc}") from exc

    fields = normalize_fields(result.get("fields", {}))
    fields = {field_name: fields[field_name]} if fields.get(field_name) else {}
    _persist_recognized_fields(deal_id, fields)
    return {
        "processed": len(paths),
        "fields": fields,
        "field_meta": {
            key: value
            for key, value in result.get("field_meta", {}).items()
            if key in fields
        },
        "conflicts": result.get("conflicts", {}),
        "notes": "\n".join(result.get("warnings", [])),
    }


@app.post("/api/deals/{deal_id}/contract")
def make_contract(deal_id: int) -> dict[str, Any]:
    deal = database.get_deal(deal_id)
    if not deal:
        raise HTTPException(404, "Сделка не найдена")
    deal.pop("_meta", None)
    deal.pop("documents", None)
    try:
        path, template_name = create_contract(deal_id, deal)
    except Exception as exc:
        raise HTTPException(500, f"Не удалось создать Excel: {exc}") from exc
    return {
        "filename": path.name,
        "download_url": f"/api/contracts/{path.name}",
        "template": template_name,
    }


@app.get("/api/contracts/{filename}")
def download_contract(filename: str) -> FileResponse:
    safe_name = Path(filename).name
    path = database.OUTPUT_DIR / safe_name
    if not path.exists():
        raise HTTPException(404, "Договор не найден")
    return FileResponse(path, filename=safe_name)


