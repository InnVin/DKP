from __future__ import annotations

import base64
import json
import mimetypes
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .env_config import get_config
from .text_extract import extract_fields_from_text

API_URL = "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText"
KEY_FILE = Path(__file__).resolve().parents[1] / "config" / "yandex_api_key.txt"
FOLDER_FILE = Path(__file__).resolve().parents[1] / "config" / "yandex_folder_id.txt"
OCR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".pdf"}


def api_key() -> str:
    key = get_config("YANDEX_API_KEY").strip()
    if key:
        return key
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


def iam_token() -> str:
    return get_config("YANDEX_IAM_TOKEN").strip()


def folder_id() -> str:
    value = get_config("YANDEX_FOLDER_ID").strip()
    if value:
        return value
    if FOLDER_FILE.exists():
        return FOLDER_FILE.read_text(encoding="utf-8").strip()
    return ""


def status() -> dict[str, Any]:
    return {
        "configured": bool(api_key() or iam_token()),
        "folder_configured": bool(folder_id()),
        "key_file": str(KEY_FILE),
        "folder_file": str(FOLDER_FILE),
    }


def can_process(path: Path) -> bool:
    return path.suffix.lower() in OCR_EXTENSIONS


def _mime_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    return mime or ("application/pdf" if path.suffix.lower() == ".pdf" else "image/jpeg")


def _text_from_result(payload: dict[str, Any]) -> str:
    result = payload.get("result", {})
    if isinstance(result.get("textAnnotation"), dict):
        return str(result["textAnnotation"].get("fullText", "")).strip()
    if isinstance(result.get("text_annotation"), dict):
        return str(result["text_annotation"].get("full_text", "")).strip()
    chunks: list[str] = []
    for page in result.get("pages", []) or []:
        for block in page.get("blocks", []) or []:
            for line in block.get("lines", []) or []:
                line_text = line.get("text") or " ".join(word.get("text", "") for word in line.get("words", []) or [])
                if line_text:
                    chunks.append(str(line_text))
    return "\n".join(chunks).strip()


def recognize_files(paths: list[Path], document_hint: str = "auto") -> dict[str, Any]:
    key = api_key()
    token = iam_token()
    if not key and not token:
        raise RuntimeError("Yandex API key или IAM token не настроен")

    texts: list[str] = []
    warnings: list[str] = []
    for path in paths:
        if not can_process(path):
            warnings.append(f"{path.name}: формат не поддерживается Yandex OCR")
            continue
        payload = {
            "mimeType": _mime_type(path),
            "languageCodes": ["ru", "en"],
            "model": "page",
            "content": base64.b64encode(path.read_bytes()).decode("ascii"),
        }
        headers = {
            "Content-Type": "application/json",
        }
        headers["Authorization"] = f"Api-Key {key}" if key else f"Bearer {token}"
        folder = folder_id()
        if folder:
            headers["x-folder-id"] = folder
        request = urllib.request.Request(
            API_URL,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Yandex OCR вернул ошибку: {detail[:500]}") from exc
        except (OSError, urllib.error.URLError, TimeoutError) as exc:
            raise RuntimeError(f"Yandex OCR недоступен: {exc}") from exc

        text = _text_from_result(response_payload)
        if text:
            texts.append(text)
        else:
            warnings.append(f"{path.name}: текст не найден")

    full_text = "\n\n".join(texts)
    extracted = extract_fields_from_text(full_text, source="yandex_ocr", document_hint=document_hint)
    return {
        "document_type": document_hint,
        "fields": extracted["fields"],
        "field_meta": extracted["field_meta"],
        "text": full_text,
        "warnings": warnings,
    }
