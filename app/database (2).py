from __future__ import annotations

import json
import shutil
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "contracts"
DB_PATH = DATA_DIR / "autodogovor.sqlite3"


def ensure_storage() -> None:
    for path in (DATA_DIR, UPLOAD_DIR, OUTPUT_DIR):
        path.mkdir(parents=True, exist_ok=True)


@contextmanager
def connection() -> Iterator[sqlite3.Connection]:
    ensure_storage()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS deals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft',
                seller_full_name TEXT NOT NULL DEFAULT '',
                seller_phone TEXT NOT NULL DEFAULT '',
                buyer_full_name TEXT NOT NULL DEFAULT '',
                buyer_phone TEXT NOT NULL DEFAULT '',
                vin TEXT NOT NULL DEFAULT '',
                registration_plate TEXT NOT NULL DEFAULT '',
                vehicle_make_model TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                deal_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                document_type TEXT NOT NULL,
                original_name TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                ocr_text TEXT NOT NULL DEFAULT '',
                ocr_status TEXT NOT NULL DEFAULT 'not_processed',
                FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_deals_seller ON deals(seller_full_name);
            CREATE INDEX IF NOT EXISTS idx_deals_buyer ON deals(buyer_full_name);
            CREATE INDEX IF NOT EXISTS idx_deals_vin ON deals(vin);
            CREATE INDEX IF NOT EXISTS idx_deals_plate ON deals(registration_plate);
            """
        )


def _summary(payload: dict[str, Any]) -> dict[str, str]:
    return {
        "seller_full_name": str(payload.get("seller_full_name", "")).strip(),
        "seller_phone": str(payload.get("seller_phone", "")).strip(),
        "buyer_full_name": str(payload.get("buyer_full_name", "")).strip(),
        "buyer_phone": str(payload.get("buyer_phone", "")).strip(),
        "vin": str(payload.get("vin", "")).strip().upper(),
        "registration_plate": str(payload.get("registration_plate", "")).strip().upper(),
        "vehicle_make_model": str(payload.get("vehicle_make_model", "")).strip(),
        "notes": str(payload.get("notes", "")).strip(),
    }


def save_deal(payload: dict[str, Any], deal_id: int | None = None) -> int:
    now = datetime.now().isoformat(timespec="seconds")
    summary = _summary(payload)
    packed = json.dumps(payload, ensure_ascii=False)
    with connection() as conn:
        if deal_id:
            conn.execute(
                """
                UPDATE deals SET updated_at=?, seller_full_name=?, seller_phone=?,
                    buyer_full_name=?, buyer_phone=?, vin=?, registration_plate=?,
                    vehicle_make_model=?, notes=?, payload_json=?
                WHERE id=?
                """,
                (
                    now,
                    summary["seller_full_name"],
                    summary["seller_phone"],
                    summary["buyer_full_name"],
                    summary["buyer_phone"],
                    summary["vin"],
                    summary["registration_plate"],
                    summary["vehicle_make_model"],
                    summary["notes"],
                    packed,
                    deal_id,
                ),
            )
            if conn.total_changes == 0:
                raise KeyError(f"Сделка {deal_id} не найдена")
            return deal_id
        cursor = conn.execute(
            """
            INSERT INTO deals (
                created_at, updated_at, seller_full_name, seller_phone,
                buyer_full_name, buyer_phone, vin, registration_plate,
                vehicle_make_model, notes, payload_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                now,
                now,
                summary["seller_full_name"],
                summary["seller_phone"],
                summary["buyer_full_name"],
                summary["buyer_phone"],
                summary["vin"],
                summary["registration_plate"],
                summary["vehicle_make_model"],
                summary["notes"],
                packed,
            ),
        )
        return int(cursor.lastrowid)


def get_deal(deal_id: int) -> dict[str, Any] | None:
    with connection() as conn:
        row = conn.execute("SELECT * FROM deals WHERE id=?", (deal_id,)).fetchone()
        if not row:
            return None
        payload = json.loads(row["payload_json"])
        payload["_meta"] = {
            "id": row["id"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        payload["documents"] = [
            dict(doc)
            for doc in conn.execute(
                "SELECT id, document_type, original_name, ocr_status, created_at FROM documents WHERE deal_id=? ORDER BY id",
                (deal_id,),
            ).fetchall()
        ]
        for doc in payload["documents"]:
            path_row = conn.execute("SELECT stored_path FROM documents WHERE id=?", (doc["id"],)).fetchone()
            if path_row:
                path = Path(path_row["stored_path"])
                doc["file_size"] = path.stat().st_size if path.exists() else 0
        return payload


def delete_deal(deal_id: int) -> bool:
    with connection() as conn:
        paths = [
            Path(row["stored_path"])
            for row in conn.execute("SELECT stored_path FROM documents WHERE deal_id=?", (deal_id,)).fetchall()
        ]
        cursor = conn.execute("DELETE FROM deals WHERE id=?", (deal_id,))
    folder = UPLOAD_DIR / str(deal_id)
    for path in paths:
        _delete_upload_file(path)
    if folder.exists() and folder.is_dir():
        try:
            shutil.rmtree(folder)
        except OSError:
            pass
    return cursor.rowcount > 0


def search_deals(query: str = "") -> list[dict[str, Any]]:
    query = query.strip()
    with connection() as conn:
        if query:
            like = f"%{query}%"
            normalized = query.replace(" ", "").upper()
            payload_like = f"%{query}%"
            compact_like = f"%{normalized}%"
            rows = conn.execute(
                """
                SELECT id, created_at, updated_at, seller_full_name, seller_phone,
                       buyer_full_name, buyer_phone, vin, registration_plate,
                       vehicle_make_model
                FROM deals
                WHERE seller_full_name LIKE ? OR seller_phone LIKE ?
                   OR buyer_full_name LIKE ? OR buyer_phone LIKE ?
                   OR vin LIKE ? OR registration_plate LIKE ?
                   OR payload_json LIKE ? OR REPLACE(UPPER(payload_json), ' ', '') LIKE ?
                ORDER BY updated_at DESC LIMIT 100
                """,
                (like, like, like, like, like, like, payload_like, compact_like),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, created_at, updated_at, seller_full_name, seller_phone,
                       buyer_full_name, buyer_phone, vin, registration_plate,
                       vehicle_make_model
                FROM deals ORDER BY updated_at DESC LIMIT 100
                """
            ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            full_row = conn.execute("SELECT payload_json FROM deals WHERE id=?", (row["id"],)).fetchone()
            if full_row:
                payload = json.loads(full_row["payload_json"])
                item.update({key: payload.get(key, "") for key in payload.keys() if isinstance(payload.get(key), str)})
            result.append(item)
        return result


def add_document(
    deal_id: int,
    document_type: str,
    original_name: str,
    stored_path: str,
    ocr_text: str,
    ocr_status: str,
) -> int:
    with connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO documents (
                deal_id, created_at, document_type, original_name,
                stored_path, ocr_text, ocr_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                deal_id,
                datetime.now().isoformat(timespec="seconds"),
                document_type,
                original_name,
                stored_path,
                ocr_text,
                ocr_status,
            ),
        )
        return int(cursor.lastrowid)


def get_document_path(document_id: int) -> Path | None:
    with connection() as conn:
        row = conn.execute("SELECT stored_path FROM documents WHERE id=?", (document_id,)).fetchone()
    return Path(row["stored_path"]) if row else None


def delete_document(document_id: int) -> bool:
    with connection() as conn:
        row = conn.execute("SELECT stored_path FROM documents WHERE id=?", (document_id,)).fetchone()
        if not row:
            return False
        path = Path(row["stored_path"])
        cursor = conn.execute("DELETE FROM documents WHERE id=?", (document_id,))
    _delete_upload_file(path)
    return cursor.rowcount > 0


def get_deal_documents(deal_id: int) -> list[dict[str, Any]]:
    with connection() as conn:
        rows = conn.execute(
            """
            SELECT id, document_type, original_name, stored_path, ocr_status
            FROM documents WHERE deal_id=? ORDER BY id
            """,
            (deal_id,),
        ).fetchall()
    result = [dict(row) for row in rows]
    for item in result:
        path = Path(item["stored_path"])
        item["file_size"] = path.stat().st_size if path.exists() else 0
    return result


def update_document_ocr(document_id: int, text: str, status: str) -> None:
    with connection() as conn:
        conn.execute(
            "UPDATE documents SET ocr_text=?, ocr_status=? WHERE id=?",
            (text, status, document_id),
        )


def _delete_upload_file(path: Path) -> None:
    try:
        resolved = path.resolve()
        upload_root = UPLOAD_DIR.resolve()
        if upload_root not in resolved.parents:
            return
        if resolved.exists() and resolved.is_file():
            resolved.unlink()
    except OSError:
        return
