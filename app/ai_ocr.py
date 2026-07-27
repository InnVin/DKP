from __future__ import annotations

import base64
import json
import mimetypes
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

OLLAMA_URL = "http://127.0.0.1:11434"
MODEL = "qwen2.5vl:3b"

FIELD_NAMES = [
    "seller_full_name",
    "seller_birth_date",
    "seller_passport",
    "seller_passport_issued_by",
    "seller_passport_issue_date",
    "seller_address",
    "seller_phone",
    "buyer_full_name",
    "buyer_birth_date",
    "buyer_passport",
    "buyer_passport_issued_by",
    "buyer_passport_issue_date",
    "buyer_address",
    "buyer_phone",
    "vehicle_make_model",
    "vehicle_type",
    "vehicle_year",
    "vin",
    "body_number",
    "chassis_number",
    "color",
    "registration_plate",
    "pts_series_number",
    "sts_series_number",
    "price",
    "contract_number",
    "contract_date",
    "contract_place",
]

SYSTEM_PROMPT = """
Ты — оператор по переносу данных из российских документов в договор купли-продажи автомобиля.
На изображениях могут быть: паспорт РФ (разворот и прописка), ПТС, СТС/СОР с двух сторон,
старый печатный или рукописный договор купли-продажи.

Верни только JSON. Не исправляй и не додумывай неразборчивые символы.
Для каждого найденного поля укажи:
- value: прочитанное значение;
- confidence: число от 0 до 1;
- page: номер изображения, начиная с 1;
- evidence: короткий фрагмент, на котором основан ответ.

Правила:
1. В старом ДКП прежний покупатель является продавцом для новой сделки.
2. Свежий паспорт человека важнее старого ДКП.
3. СТС важнее старого ДКП по госномеру и регистрации.
4. ПТС/СТС важнее старого ДКП по данным автомобиля.
5. VIN должен содержать ровно 17 латинских букв/цифр, без I, O, Q. Если это номер кузова,
   а не VIN, запиши его в body_number.
6. Паспорт РФ записывай как "СССС НННННН".
7. Даты записывай как ДД.ММ.ГГГГ.
8. Если значение нельзя прочитать, не включай поле.
9. Рукописное значение с неоднозначными буквами или цифрами не может иметь confidence выше 0.69.
10. Используй только имена полей из разрешённого списка.
""".strip()


def _request(path: str, payload: dict[str, Any] | None = None, timeout: int = 10) -> Any:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        f"{OLLAMA_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="GET" if payload is None else "POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def status() -> dict[str, Any]:
    try:
        payload = _request("/api/tags", timeout=3)
    except (OSError, urllib.error.URLError, TimeoutError):
        return {"available": False, "model": MODEL, "installed": False}
    names = {item.get("name", "") for item in payload.get("models", [])}
    installed = MODEL in names or any(name.startswith("qwen2.5vl:3b") for name in names)
    return {"available": True, "model": MODEL, "installed": installed}


def _image_base64(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path.name)
    if not mime or not mime.startswith("image/"):
        raise ValueError(f"Файл {path.name} не является изображением")
    return base64.b64encode(path.read_bytes()).decode("ascii")


def recognize_images(paths: list[Path], document_hint: str = "auto") -> dict[str, Any]:
    if not paths:
        return {"fields": {}, "field_meta": {}, "warnings": ["Нет изображений для распознавания"]}
    engine = status()
    if not engine["available"]:
        raise RuntimeError("Ollama не запущен")
    if not engine["installed"]:
        raise RuntimeError(f"Модель {MODEL} не установлена")

    prompt = (
        f"Тип комплекта, выбранный пользователем: {document_hint}.\n"
        f"Разрешённые поля: {', '.join(FIELD_NAMES)}.\n"
        'Формат ответа: {"document_type":"...",'
        '"fields":{"field_name":{"value":"...","confidence":0.0,"page":1,"evidence":"..."}},'
        '"warnings":["..."]}'
    )
    payload = {
        "model": MODEL,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": prompt,
                "images": [_image_base64(path) for path in paths],
            },
        ],
    }
    response = _request("/api/chat", payload, timeout=600)
    content = response.get("message", {}).get("content", "{}")
    parsed = json.loads(content)
    raw_fields = parsed.get("fields", {})
    fields: dict[str, str] = {}
    field_meta: dict[str, dict[str, Any]] = {}

    for key, item in raw_fields.items():
        if key not in FIELD_NAMES or not isinstance(item, dict):
            continue
        value = str(item.get("value", "")).strip()
        if not value:
            continue
        confidence = max(0.0, min(1.0, float(item.get("confidence", 0))))
        fields[key] = value
        field_meta[key] = {
            "confidence": confidence,
            "page": item.get("page"),
            "evidence": str(item.get("evidence", ""))[:200],
            "source": "ollama",
        }
    return {
        "document_type": parsed.get("document_type", document_hint),
        "fields": fields,
        "field_meta": field_meta,
        "warnings": parsed.get("warnings", []),
    }
