from __future__ import annotations

import base64
import json
import mimetypes
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .ai_ocr import FIELD_NAMES, SYSTEM_PROMPT
from .env_config import get_config
from .gemini_ocr import _extract_json, _hybrid_rules

API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_MODEL = "qwen/qwen3-vl-32b-instruct"
KEY_FILE = Path(__file__).resolve().parents[1] / "config" / "openrouter_api_key.txt"
OCR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}


def api_key() -> str:
    key = get_config("OPENROUTER_API_KEY").strip()
    if key:
        return key
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    return ""


def model() -> str:
    return get_config("OPENROUTER_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL


def status() -> dict[str, Any]:
    return {
        "configured": bool(api_key()),
        "model": model(),
        "key_file": str(KEY_FILE),
    }


def can_process(path: Path) -> bool:
    return path.suffix.lower() in OCR_EXTENSIONS


def _image_url_part(path: Path) -> dict[str, Any]:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime:
        mime = "image/jpeg"
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime};base64,{data}"},
    }


def recognize_files(paths: list[Path], document_hint: str = "auto", ocr_text: str = "") -> dict[str, Any]:
    key = api_key()
    if not key:
        raise RuntimeError("OpenRouter API key не настроен")

    ocr_paths = [path for path in paths if can_process(path)]
    if not ocr_paths and not ocr_text.strip():
        return {"fields": {}, "field_meta": {}, "warnings": ["Нет изображений для OpenRouter OCR"]}

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{_hybrid_rules()}\n\n"
        f"Тип комплекта, выбранный пользователем: {document_hint}.\n"
        f"Разрешённые поля: {', '.join(FIELD_NAMES)}.\n"
        "Проанализируй все вложенные изображения как один комплект документов. "
        "Номера страниц соответствуют порядку вложенных файлов.\n"
        "Сырой текст Yandex OCR ниже может содержать ошибки и нужен как подсказка, изображения важнее:\n"
        f"--- OCR TEXT START ---\n{ocr_text[:12000]}\n--- OCR TEXT END ---\n"
        "Верни строго JSON без markdown: "
        '{"document_type":"...",'
        '"fields":{"field_name":{"value":"...","confidence":0.0,"page":1,"evidence":"..."}},'
        '"warnings":["..."]}'
    )
    payload = {
        "model": model(),
        "temperature": 0,
        "response_format": {"type": "json_object"},
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    *[_image_url_part(path) for path in ocr_paths],
                ],
            }
        ],
    }
    request = urllib.request.Request(
        API_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "http://127.0.0.1:8765",
            "X-Title": "AutoDogovor",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter OCR вернул ошибку: {detail[:700]}") from exc
    except (OSError, urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"OpenRouter OCR недоступен: {exc}") from exc

    content = str(response_payload.get("choices", [{}])[0].get("message", {}).get("content", "")).strip()
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
            "source": "openrouter",
        }

    return {
        "document_type": parsed.get("document_type", document_hint),
        "fields": fields,
        "field_meta": field_meta,
        "warnings": parsed.get("warnings", []),
    }
