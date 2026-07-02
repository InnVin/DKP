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

from . import database
from .ai_ocr import recognize_images, status as ai_status
from .excel_service import create_contract
from .gemini_ocr import can_process as gemini_can_process
from .gemini_ocr import recognize_files as gemini_recognize_files
from .gemini_ocr import status as gemini_status
from .ocr import normalize_fields, recognize
from .yandex_ocr import can_process as yandex_can_process
from .yandex_ocr import recognize_files as yandex_recognize_files
from .yandex_ocr import status as yandex_status

ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = ROOT / "app" / "static"
ALLOWED_DOCUMENT_TYPES = {"auto", "seller_passport", "buyer_passport", "pts", "sts", "old_contract", "other"}
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


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "database": str(database.DB_PATH),
        "ocr": ai_status(),
        "yandex_ocr": yandex_status(),
        "gemini_ocr": gemini_status(),
        "version": app.version,
    }


@app.get("/api/deals")
def list_deals(q: str = "") -> list[dict[str, Any]]:
    return database.search_deals(q)


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

    yandex = yandex_status()
    gemini = gemini_status()
    if yandex_can_process(stored) and yandex.get("configured"):
        try:
            ai_result = yandex_recognize_files([stored], document_type)
            result = {
                "status": "ok",
                "fields": ai_result.get("fields", {}),
                "field_meta": ai_result.get("field_meta", {}),
                "text": ai_result.get("text", ""),
                "note": "\n".join(ai_result.get("warnings", [])),
                "detected_type": ai_result.get("document_type", document_type),
                "effective_type": document_type,
                "pages": 1,
            }
        except RuntimeError as exc:
            result = {
                "status": "waiting_ai",
                "fields": {},
                "field_meta": {},
                "text": "",
                "note": f"Файл сохранён, но Yandex OCR не сработал: {exc}",
                "detected_type": document_type,
                "effective_type": document_type,
                "pages": 1,
            }
    elif gemini_can_process(stored) and gemini.get("configured"):
        try:
            ai_result = gemini_recognize_files([stored], document_type)
            result = {
                "status": "ok",
                "fields": ai_result.get("fields", {}),
                "field_meta": ai_result.get("field_meta", {}),
                "text": "",
                "note": "\n".join(ai_result.get("warnings", [])),
                "detected_type": ai_result.get("document_type", document_type),
                "effective_type": document_type,
                "pages": 1,
            }
        except RuntimeError as exc:
            result = {
                "status": "waiting_ai",
                "fields": {},
                "field_meta": {},
                "text": "",
                "note": f"Файл сохранён, но Gemini OCR не сработал: {exc}",
                "detected_type": document_type,
                "effective_type": document_type,
                "pages": 1,
            }
    elif suffix not in {".pdf", ".heic", ".psd", ".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"}:
        engine = ai_status()
        if engine.get("available") and engine.get("installed"):
            ai_result = recognize_images([stored], document_type)
            result = {
                "status": "ok",
                "fields": ai_result.get("fields", {}),
                "field_meta": ai_result.get("field_meta", {}),
                "text": "",
                "note": "\n".join(ai_result.get("warnings", [])),
                "detected_type": ai_result.get("document_type", document_type),
                "effective_type": document_type,
                "pages": 1,
            }
        else:
            result = {
                "status": "waiting_ai",
                "fields": {},
                "field_meta": {},
                "text": "",
                "note": "Документ сохранён. Для распознавания настройте Yandex OCR, Gemini API или локальный ИИ.",
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
            "note": "Файл сохранён как вложение. Yandex OCR работает с jpg, jpeg, png и pdf; Gemini дополнительно может обработать другие изображения/PDF.",
            "detected_type": document_type,
            "effective_type": document_type,
            "pages": 1,
        }

    result["fields"] = normalize_fields(result.get("fields", {}))
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


@app.get("/api/documents/{document_id}")
def download_document(document_id: int) -> FileResponse:
    path = database.get_document_path(document_id)
    if not path or not path.exists():
        raise HTTPException(404, "Файл не найден")
    return FileResponse(path)


@app.post("/api/deals/{deal_id}/reprocess")
def reprocess_documents(deal_id: int) -> dict[str, Any]:
    deal = database.get_deal(deal_id)
    if not deal:
        raise HTTPException(404, "Сделка не найдена")
    documents = database.get_deal_documents(deal_id)
    yandex = yandex_status()
    if yandex.get("configured"):
        combined_fields: dict[str, str] = {}
        combined_meta: dict[str, dict[str, Any]] = {}
        notes: list[str] = []
        processed = 0
        grouped: dict[str, list[dict[str, Any]]] = {}
        for document in documents:
            grouped.setdefault(document["document_type"], []).append(document)
        for document_type, group in grouped.items():
            ocr_documents = [
                document
                for document in group
                if Path(document["stored_path"]).exists() and yandex_can_process(Path(document["stored_path"]))
            ]
            if not ocr_documents:
                notes.append(f"{document_type}: нет файлов для Yandex OCR.")
                continue
            try:
                result = yandex_recognize_files(
                    [Path(document["stored_path"]) for document in ocr_documents],
                    document_type,
                )
            except RuntimeError as exc:
                notes.append(f"{document_type}: Yandex OCR не сработал: {exc}")
                continue
            combined_fields.update(result.get("fields", {}))
            combined_meta.update(result.get("field_meta", {}))
            notes.extend(result.get("warnings", []))
            for document in ocr_documents:
                database.update_document_ocr(document["id"], result.get("text", ""), "yandex_processed")
                processed += 1
        return {
            "processed": processed,
            "fields": normalize_fields(combined_fields),
            "field_meta": combined_meta,
            "notes": "\n\n".join(notes),
            "notes_by_group": _notes_by_group(notes),
        }

    gemini = gemini_status()
    if gemini.get("configured"):
        combined_fields: dict[str, str] = {}
        combined_meta: dict[str, dict[str, Any]] = {}
        notes: list[str] = []
        processed = 0
        grouped: dict[str, list[dict[str, Any]]] = {}
        for document in documents:
            grouped.setdefault(document["document_type"], []).append(document)
        for document_type, group in grouped.items():
            ocr_documents = [
                document
                for document in group
                if Path(document["stored_path"]).exists() and gemini_can_process(Path(document["stored_path"]))
            ]
            if not ocr_documents:
                notes.append(f"{document_type}: нет файлов для OCR, сохранены как вложения.")
                continue
            try:
                result = gemini_recognize_files(
                    [Path(document["stored_path"]) for document in ocr_documents],
                    document_type,
                )
            except RuntimeError as exc:
                notes.append(f"{document_type}: Gemini OCR не сработал: {exc}")
                continue
            combined_fields.update(result.get("fields", {}))
            combined_meta.update(result.get("field_meta", {}))
            notes.extend(result.get("warnings", []))
            for document in ocr_documents:
                database.update_document_ocr(document["id"], "", "gemini_processed")
                processed += 1
        return {
            "processed": processed,
            "fields": normalize_fields(combined_fields),
            "field_meta": combined_meta,
            "notes": "\n\n".join(notes),
            "notes_by_group": _notes_by_group(notes),
        }

    engine = ai_status()
    if not engine.get("available") or not engine.get("installed"):
        raise HTTPException(
            503,
            "OCR не готов. Укажите Yandex API key в config/yandex_api_key.txt, Gemini API key в config/gemini_api_key.txt или запустите локальный ИИ.",
        )
    combined_fields: dict[str, str] = {}
    combined_meta: dict[str, dict[str, Any]] = {}
    notes: list[str] = []
    processed = 0
    grouped: dict[str, list[dict[str, Any]]] = {}
    for document in documents:
        grouped.setdefault(document["document_type"], []).append(document)
    for document_type, group in grouped.items():
        image_documents = [
            document
            for document in group
            if Path(document["stored_path"]).exists()
            and Path(document["stored_path"]).suffix.lower() != ".pdf"
        ]
        if not image_documents:
            notes.append(f"{document_type}: PDF будет подключён к локальному ИИ следующим этапом.")
            continue
        result = recognize_images(
            [Path(document["stored_path"]) for document in image_documents],
            document_type,
        )
        combined_fields.update(result.get("fields", {}))
        combined_meta.update(result.get("field_meta", {}))
        notes.extend(result.get("warnings", []))
        for document in image_documents:
            database.update_document_ocr(document["id"], "", "ai_processed")
            processed += 1
    return {
        "processed": processed,
        "fields": normalize_fields(combined_fields),
        "field_meta": combined_meta,
        "notes": "\n\n".join(notes),
        "notes_by_group": _notes_by_group(notes),
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
