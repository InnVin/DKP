from __future__ import annotations

import base64
import json
import mimetypes
import socket
import urllib.error
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

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


def proxy_url() -> str:
    configured = get_config("OPENROUTER_PROXY").strip()
    if configured:
        return configured
    # HAPP/Xray обычно поднимает локальный HTTP-прокси на одном из этих портов.
    for port in (10809, 10808):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.15):
                return f"http://127.0.0.1:{port}"
        except OSError:
            continue
    return ""


def status() -> dict[str, Any]:
    return {
        "configured": bool(api_key()),
        "model": model(),
        "proxy_configured": bool(proxy_url()),
        "key_file": str(KEY_FILE),
    }


def can_process(path: Path) -> bool:
    return path.suffix.lower() in OCR_EXTENSIONS


def _image_url_part(path: Path) -> dict[str, Any]:
    mime = "image/jpeg"
    try:
        image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
        buffer = BytesIO()
        image.save(buffer, format="JPEG", quality=82, optimize=True)
        raw = buffer.getvalue()
    except Exception:
        mime, _ = mimetypes.guess_type(path.name)
        mime = mime or "image/jpeg"
        raw = path.read_bytes()
    data = base64.b64encode(raw).decode("ascii")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime};base64,{data}"},
    }


def recognize_files(
    paths: list[Path],
    document_hint: str = "auto",
    ocr_text: str = "",
    target_fields: list[str] | None = None,
) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise RuntimeError("OpenRouter API key не настроен")

    ocr_paths = [path for path in paths if can_process(path)]
    if not ocr_paths and not ocr_text.strip():
        return {"fields": {}, "field_meta": {}, "warnings": ["Нет изображений для OpenRouter OCR"]}

    allowed_fields = target_fields or FIELD_NAMES
    target_instruction = (
        "Распознай только перечисленные поля. Остальные данные не возвращай.\n"
        if target_fields else ""
    )
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{_hybrid_rules()}\n\n"
        f"Тип комплекта, выбранный пользователем: {document_hint}.\n"
        f"Разрешённые поля: {', '.join(allowed_fields)}.\n"
        f"{target_instruction}"
        "Проанализируй все вложенные изображения как один комплект документов. "
        "Номера страниц соответствуют порядку вложенных файлов.\n"
        "Для каждого поля обязательно верни candidates: отдельный прочитанный вариант с каждой страницы, где поле видно. "
        "Не объединяй разные варианты заранее и не скрывай расхождения похожих символов.\n"
        "Сырой текст Yandex OCR ниже может содержать ошибки и нужен как подсказка, изображения важнее:\n"
        f"--- OCR TEXT START ---\n{ocr_text[:12000]}\n--- OCR TEXT END ---\n"
        "Верни строго JSON без markdown: "
        '{"document_type":"...",'
        '"fields":{"field_name":{"value":"...","confidence":0.0,"page":1,"evidence":"...",'
        '"candidates":[{"value":"...","confidence":0.0,"page":1,"evidence":"..."}]}},'
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
    proxy = proxy_url()
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy, "https": proxy})
    ) if proxy else urllib.request.build_opener()
    try:
        with opener.open(request, timeout=180) as response:
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
    field_candidates: dict[str, list[dict[str, Any]]] = {}
    for key_name, item in parsed.get("fields", {}).items():
        if key_name not in allowed_fields or not isinstance(item, dict):
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
        candidates = item.get("candidates", [])
        if not isinstance(candidates, list) or not candidates:
            candidates = [item]
        field_candidates[key_name] = [
            {
                "value": str(candidate.get("value", "")).strip(),
                "confidence": max(0.0, min(1.0, float(candidate.get("confidence", 0)))),
                "page": candidate.get("page"),
                "evidence": str(candidate.get("evidence", ""))[:200],
            }
            for candidate in candidates
            if isinstance(candidate, dict) and str(candidate.get("value", "")).strip()
        ]

    return {
        "document_type": parsed.get("document_type", document_hint),
        "fields": fields,
        "field_meta": field_meta,
        "field_candidates": field_candidates,
        "warnings": parsed.get("warnings", []),
    }
