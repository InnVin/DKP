from __future__ import annotations

import base64
import json
import mimetypes
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .ai_ocr import FIELD_NAMES, SYSTEM_PROMPT
from .env_config import get_config

MODEL = "gemini-2.5-flash"
API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
KEY_FILE = Path(__file__).resolve().parents[1] / "config" / "gemini_api_key.txt"
OCR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".bmp", ".tif", ".tiff", ".pdf"}


def api_key() -> str:
    key = get_config("GEMINI_API_KEY").strip()
    if key:
        return key
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


def status() -> dict[str, Any]:
    return {
        "configured": bool(api_key()),
        "model": MODEL,
        "key_file": str(KEY_FILE),
    }


def can_process(path: Path) -> bool:
    return path.suffix.lower() in OCR_EXTENSIONS


def _file_part(path: Path) -> dict[str, Any]:
    mime, _ = mimetypes.guess_type(path.name)
    if path.suffix.lower() == ".heic":
        mime = "image/heic"
    if not mime:
        mime = "application/pdf" if path.suffix.lower() == ".pdf" else "application/octet-stream"
    return {
        "inlineData": {
            "mimeType": mime,
            "data": base64.b64encode(path.read_bytes()).decode("ascii"),
        }
    }


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        text = text[start : end + 1]
    return json.loads(text)


def recognize_files(paths: list[Path], document_hint: str = "auto") -> dict[str, Any]:
    key = api_key()
    if not key:
        raise RuntimeError("Gemini API key не настроен")

    ocr_paths = [path for path in paths if can_process(path)]
    if not ocr_paths:
        return {"fields": {}, "field_meta": {}, "warnings": ["Нет файлов для OCR"]}

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Тип комплекта, выбранный пользователем: {document_hint}.\n"
        f"Разрешённые поля: {', '.join(FIELD_NAMES)}.\n"
        "Проанализируй все вложенные изображения/PDF, включая рукописный текст, если он читается.\n"
        "Верни строго JSON без markdown: "
        '{"document_type":"...",'
        '"fields":{"field_name":{"value":"...","confidence":0.0,"page":1,"evidence":"..."}},'
        '"warnings":["..."]}'
    )
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}, *[_file_part(path) for path in ocr_paths]],
            }
        ],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
        },
    }
    url = API_URL.format(model=urllib.parse.quote(MODEL, safe="")) + "?key=" + urllib.parse.quote(key)
    request = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Gemini OCR вернул ошибку: {detail[:500]}") from exc
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"Gemini OCR недоступен: {exc}") from exc

    parts = response_payload.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    content = "".join(str(part.get("text", "")) for part in parts).strip()
    parsed = _extract_json(content or "{}")

    fields: dict[str, str] = {}
    field_meta: dict[str, dict[str, Any]] = {}
    for key_name, item in parsed.get("fields", {}).items():
        if key_name not in FIELD_NAMES or not isinstance(item, dict):
            continue
        value = str(item.get("value", "")).strip()
        if not value:
            continue
        confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
        fields[key_name] = value
        field_meta[key_name] = {
            "confidence": confidence,
            "page": item.get("page"),
            "evidence": str(item.get("evidence", ""))[:200],
            "source": "gemini",
        }

    return {
        "document_type": parsed.get("document_type", document_hint),
        "fields": fields,
        "field_meta": field_meta,
        "warnings": parsed.get("warnings", []),
    }
