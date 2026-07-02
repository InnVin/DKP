from __future__ import annotations

import json
import mimetypes
import shutil
import sqlite3
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parent
STATIC_DIR = PROJECT_ROOT / "app" / "static"
DATA_DIR = PROJECT_ROOT / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "contracts"
DB_PATH = DATA_DIR / "autodogovor.sqlite3"


def ensure_storage() -> None:
    for path in (DATA_DIR, UPLOAD_DIR, OUTPUT_DIR):
        path.mkdir(parents=True, exist_ok=True)


def connect() -> sqlite3.Connection:
    ensure_storage()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with connect() as conn:
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
            """
        )


def summary(payload: dict) -> dict[str, str]:
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


def save_deal(payload: dict, deal_id: int | None) -> int:
    now = datetime.now().isoformat(timespec="seconds")
    packed = json.dumps(payload, ensure_ascii=False)
    item = summary(payload)
    with connect() as conn:
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
                    item["seller_full_name"],
                    item["seller_phone"],
                    item["buyer_full_name"],
                    item["buyer_phone"],
                    item["vin"],
                    item["registration_plate"],
                    item["vehicle_make_model"],
                    item["notes"],
                    packed,
                    deal_id,
                ),
            )
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
                item["seller_full_name"],
                item["seller_phone"],
                item["buyer_full_name"],
                item["buyer_phone"],
                item["vin"],
                item["registration_plate"],
                item["vehicle_make_model"],
                item["notes"],
                packed,
            ),
        )
        return int(cursor.lastrowid)


def parse_multipart(body: bytes, content_type: str) -> tuple[dict[str, str], dict[str, bytes | str]]:
    marker = "boundary="
    if marker not in content_type:
        return {}, {}
    boundary = ("--" + content_type.split(marker, 1)[1].strip().strip('"')).encode()
    fields: dict[str, str] = {}
    files: dict[str, bytes | str] = {}
    for part in body.split(boundary):
        part = part.strip(b"\r\n")
        if not part or part == b"--" or b"\r\n\r\n" not in part:
            continue
        header_blob, value = part.split(b"\r\n\r\n", 1)
        value = value.rstrip(b"\r\n")
        headers = header_blob.decode("utf-8", "replace")
        if 'name="' not in headers:
            continue
        name = headers.split('name="', 1)[1].split('"', 1)[0]
        if 'filename="' in headers:
            filename = headers.split('filename="', 1)[1].split('"', 1)[0]
            files["name"] = name
            files["filename"] = filename
            files["content"] = value
        else:
            fields[name] = value.decode("utf-8", "replace")
    return fields, files


class Handler(BaseHTTPRequestHandler):
    server_version = "AutoDogovorFallback/0.1"

    def send_json(self, value: object, status: int = 200) -> None:
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path: Path, download_name: str | None = None) -> None:
        if not path.exists() or not path.is_file():
            self.send_json({"detail": "Файл не найден"}, 404)
            return
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(path.stat().st_size))
        self.send_header("Cache-Control", "no-store")
        if download_name:
            self.send_header("Content-Disposition", f'attachment; filename="{download_name}"')
        self.end_headers()
        with path.open("rb") as file:
            shutil.copyfileobj(file, self.wfile)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        if path == "/":
            self.send_file(STATIC_DIR / "index.html")
            return
        if path.startswith("/static/"):
            self.send_file(STATIC_DIR / Path(path).name)
            return
        if path == "/api/health":
            self.send_json({"status": "ok", "database": str(DB_PATH), "ocr": {"available": False}})
            return
        if path == "/api/deals":
            query = parse_qs(parsed.query).get("q", [""])[0].strip()
            with connect() as conn:
                if query:
                    like = f"%{query}%"
                    rows = conn.execute(
                        """
                        SELECT id, created_at, updated_at, seller_full_name, seller_phone,
                               buyer_full_name, buyer_phone, vin, registration_plate,
                               vehicle_make_model
                        FROM deals
                        WHERE seller_full_name LIKE ? OR seller_phone LIKE ?
                           OR buyer_full_name LIKE ? OR buyer_phone LIKE ?
                           OR vin LIKE ? OR registration_plate LIKE ?
                        ORDER BY updated_at DESC LIMIT 100
                        """,
                        (like, like, like, like, like, like),
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
            self.send_json([dict(row) for row in rows])
            return
        if path.startswith("/api/deals/"):
            try:
                deal_id = int(path.rsplit("/", 1)[-1])
            except ValueError:
                self.send_json({"detail": "Сделка не найдена"}, 404)
                return
            with connect() as conn:
                row = conn.execute("SELECT * FROM deals WHERE id=?", (deal_id,)).fetchone()
                if not row:
                    self.send_json({"detail": "Сделка не найдена"}, 404)
                    return
                payload = json.loads(row["payload_json"])
                payload["_meta"] = {"id": row["id"], "created_at": row["created_at"], "updated_at": row["updated_at"]}
                payload["documents"] = [
                    dict(doc)
                    for doc in conn.execute(
                        "SELECT id, document_type, original_name, ocr_status, created_at FROM documents WHERE deal_id=? ORDER BY id",
                        (deal_id,),
                    ).fetchall()
                ]
            self.send_json(payload)
            return
        if path.startswith("/api/documents/"):
            document_id = int(path.rsplit("/", 1)[-1])
            with connect() as conn:
                row = conn.execute("SELECT stored_path, original_name FROM documents WHERE id=?", (document_id,)).fetchone()
            self.send_file(Path(row["stored_path"]), row["original_name"]) if row else self.send_json({"detail": "Файл не найден"}, 404)
            return
        self.send_json({"detail": "Не найдено"}, 404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        if path == "/api/deals":
            payload = json.loads(body.decode("utf-8") or "{}")
            deal_id = save_deal(payload.get("data", {}), payload.get("deal_id"))
            self.send_json({"id": deal_id, "message": "Сделка сохранена"})
            return
        if path.endswith("/documents") and path.startswith("/api/deals/"):
            deal_id = int(path.split("/")[3])
            fields, files = parse_multipart(body, self.headers.get("Content-Type", ""))
            filename = str(files.get("filename") or "document.bin")
            suffix = Path(filename).suffix.lower() or ".bin"
            folder = UPLOAD_DIR / str(deal_id)
            folder.mkdir(parents=True, exist_ok=True)
            stored = folder / f"{uuid.uuid4().hex}{suffix}"
            stored.write_bytes(files.get("content", b"") if isinstance(files.get("content"), bytes) else b"")
            with connect() as conn:
                cursor = conn.execute(
                    """
                    INSERT INTO documents (deal_id, created_at, document_type, original_name, stored_path, ocr_text, ocr_status)
                    VALUES (?, ?, ?, ?, ?, '', 'waiting_ai')
                    """,
                    (deal_id, datetime.now().isoformat(timespec="seconds"), fields.get("document_type", "other"), filename, str(stored)),
                )
                document_id = int(cursor.lastrowid)
            self.send_json(
                {
                    "document_id": document_id,
                    "fields": {},
                    "field_meta": {},
                    "note": "Документ сохранён. Для распознавания нужна нормальная установка зависимостей и локальный ИИ.",
                    "status": "waiting_ai",
                    "effective_type": fields.get("document_type", "other"),
                    "pages": 1,
                }
            )
            return
        if path.endswith("/reprocess"):
            self.send_json({"processed": 0, "fields": {}, "field_meta": {}, "notes": "Распознавание недоступно в аварийном режиме."})
            return
        if path.endswith("/contract"):
            self.send_json({"detail": "Создание Excel недоступно в аварийном режиме: нужны зависимости проекта."}, 503)
            return
        self.send_json({"detail": "Не найдено"}, 404)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", 8765), Handler)
    print("AutoDogovor started: http://127.0.0.1:8765")
    server.serve_forever()
