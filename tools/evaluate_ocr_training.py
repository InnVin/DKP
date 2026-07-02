from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = ROOT / "training_examples" / "cases.json"
EXAMPLE_PATH = ROOT / "training_examples" / "cases.example.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.hybrid_ocr import recognize_files as hybrid_recognize_files  # noqa: E402
from app.ocr import normalize_fields, recognize  # noqa: E402


def _load_cases() -> list[dict[str, Any]]:
    if not CASES_PATH.exists():
        raise SystemExit(
            f"Не найден {CASES_PATH}.\n"
            f"Скопируйте {EXAMPLE_PATH.name} в cases.json и заполните правильные значения."
        )
    with CASES_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, list):
        raise SystemExit("cases.json должен быть списком примеров.")
    return data


def _clean_expected(expected: dict[str, Any]) -> dict[str, str]:
    return {
        key: value
        for key, value in normalize_fields(expected).items()
        if str(value).strip()
    }


def _case_files(case: dict[str, Any]) -> list[Path]:
    if "files" in case:
        return [ROOT / str(item) for item in case.get("files") or []]
    return [ROOT / str(case.get("file") or "")]


def _compare(expected: dict[str, str], actual: dict[str, str]) -> tuple[int, int, list[str]]:
    ok = 0
    total = len(expected)
    lines: list[str] = []
    for key, expected_value in expected.items():
        actual_value = str(actual.get(key, "")).strip()
        if actual_value == expected_value:
            ok += 1
            lines.append(f"  OK   {key}: {actual_value}")
        else:
            lines.append(f"  FAIL {key}: ожидалось `{expected_value}`, получено `{actual_value}`")
    return ok, total, lines


def _recognize_case(file_paths: list[Path], document_type: str) -> dict[str, str]:
    result = hybrid_recognize_files(file_paths, document_type)
    return normalize_fields(result.get("fields", {}))


def main() -> int:
    cases = _load_cases()
    total_ok = 0
    total_fields = 0

    for case in cases:
        name = str(case.get("name") or "без названия")
        document_type = str(case.get("document_type") or "auto")
        file_paths = _case_files(case)
        expected = _clean_expected(case.get("expected") or {})

        print(f"\n{name}")
        missing = [path for path in file_paths if not path.exists()]
        if missing:
            for path in missing:
                print(f"  WAIT файл пока не добавлен: {path}")
            continue
        if not expected:
            print("  SKIP нет заполненных expected-полей")
            continue

        try:
            actual = _recognize_case(file_paths, document_type)
        except RuntimeError as exc:
            print(f"  FAIL OCR не сработал: {exc}")
            total_fields += len(expected)
            continue
        ok, total, lines = _compare(expected, actual)
        total_ok += ok
        total_fields += total
        print(f"  Результат: {ok}/{total}")
        print("\n".join(lines))

    if not total_fields:
        print("\nНет заполненных примеров для проверки.")
        return 1

    percent = round(total_ok / total_fields * 100)
    print(f"\nИтого: {total_ok}/{total_fields}, точность {percent}%")
    return 0 if total_ok == total_fields else 2


if __name__ == "__main__":
    raise SystemExit(main())


