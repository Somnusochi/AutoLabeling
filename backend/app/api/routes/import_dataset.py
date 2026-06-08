"""Dataset import routes — supports direct upload and chunked upload with resume."""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import threading
import uuid
from contextlib import suppress
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ...core.config import settings
from ...core.database import SessionLocal
from ...repositories.detection import DetectionRepository
from ...schemas.common import APIResponse
from ..deps import get_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["import"])

ACTIVE_IMPORTS: dict[str, threading.Event] = {}
CHUNK_DIR = Path(settings.project_root) / "import_chunks"


# ── Chunked upload ──────────────────────────────────


@router.post("/datasets/import/chunk/init")
async def chunk_init(request: Request) -> APIResponse:
    """Create or resume a chunked upload session.

    The client sends JSON: {fileName, totalSize, chunkSize, format}.
    We derive an uploadId from fileName+totalSize so re-uploads
    of the same file resume automatically.
    """
    body: dict = {}
    with suppress(json.JSONDecodeError):
        body = json.loads((await request.body() or b"{}").decode())

    file_name = body.get("fileName", "dataset.zip")
    total_size = body.get("totalSize", 0)
    chunk_size = body.get("chunkSize", 20 * 1024 * 1024)
    fmt = body.get("format", "yolo")

    if not total_size or not file_name:
        raise HTTPException(400, "fileName and totalSize are required")

    max_bytes = settings.max_import_size_mb * 1024 * 1024
    if total_size > max_bytes:
        raise HTTPException(400, f"File exceeds {settings.max_import_size_mb // 1024}GB limit")

    total_chunks = max(1, (total_size + chunk_size - 1) // chunk_size)

    # Derive stable uploadId from file identity
    upload_id = hashlib.md5(f"{file_name}:{total_size}".encode()).hexdigest()[:16]

    chunk_dir = CHUNK_DIR / upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    # Check which chunks are already uploaded
    uploaded = sorted(
        int(p.name.replace("chunk_", "")) for p in chunk_dir.glob("chunk_*") if p.stat().st_size > 0
    )

    # Write/update meta
    meta = {
        "fileName": file_name,
        "totalSize": total_size,
        "chunkSize": chunk_size,
        "totalChunks": total_chunks,
        "format": fmt,
    }
    (chunk_dir / "meta.json").write_text(json.dumps(meta))

    return APIResponse(
        data={
            "uploadId": upload_id,
            "totalChunks": total_chunks,
            "uploadedChunks": uploaded,
        }
    )


@router.post("/datasets/import/chunk/{upload_id}/{chunk_index}")
async def chunk_upload(
    upload_id: str,
    chunk_index: int,
    request: Request,
) -> APIResponse:
    """Upload a single chunk."""
    chunk_dir = CHUNK_DIR / upload_id
    if not chunk_dir.exists():
        raise HTTPException(404, "Upload session not found. Call /chunk/init first.")

    meta_path = chunk_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(400, "Upload session metadata missing")

    meta = json.loads(meta_path.read_text())
    if chunk_index < 0 or chunk_index >= meta["totalChunks"]:
        raise HTTPException(400, f"Invalid chunk index: {chunk_index}")

    chunk_data = await request.body()
    chunk_path = chunk_dir / f"chunk_{chunk_index}"
    chunk_path.write_bytes(chunk_data)

    return APIResponse(data={"ok": True, "chunk": chunk_index})


@router.get("/datasets/import/chunk/{upload_id}")
def chunk_status(upload_id: str) -> APIResponse:
    """Check chunk upload status (for resume)."""
    chunk_dir = CHUNK_DIR / upload_id
    if not chunk_dir.exists():
        raise HTTPException(404, "Upload session not found")

    meta = {}
    meta_path = chunk_dir / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())

    uploaded = sorted(
        int(p.name.replace("chunk_", "")) for p in chunk_dir.glob("chunk_*") if p.stat().st_size > 0
    )

    return APIResponse(
        data={
            "uploadId": upload_id,
            "totalChunks": meta.get("totalChunks", 0),
            "uploadedChunks": uploaded,
        }
    )


@router.post("/datasets/import/chunk/{upload_id}/complete")
def chunk_complete(
    upload_id: str,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    """Assemble chunks and start dataset import."""
    from ...services.dataset_import import import_dataset as do_import

    chunk_dir = CHUNK_DIR / upload_id
    if not chunk_dir.exists():
        raise HTTPException(404, "Upload session not found")

    meta_path = chunk_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(400, "Upload session metadata missing")

    meta = json.loads(meta_path.read_text())

    # Verify all chunks present
    missing = []
    for i in range(meta["totalChunks"]):
        p = chunk_dir / f"chunk_{i}"
        if not p.exists() or p.stat().st_size == 0:
            missing.append(i)

    if missing:
        raise HTTPException(
            400,
            f"Missing chunks: {missing[:10]}{'...' if len(missing) > 10 else ''}",
        )

    # Assemble
    progress_dir = Path(settings.project_root) / "import_progress"
    progress_dir.mkdir(parents=True, exist_ok=True)
    zip_path = progress_dir / f"{upload_id}.zip"

    with open(zip_path, "wb") as out:
        for i in range(meta["totalChunks"]):
            chunk_path = chunk_dir / f"chunk_{i}"
            out.write(chunk_path.read_bytes())

    import_id = upload_id
    cancel_event = threading.Event()
    ACTIVE_IMPORTS[import_id] = cancel_event

    _write_progress(import_id, {"total": 0, "completed": 0, "status": "processing"})

    def _run():
        db = SessionLocal()
        local_repo = DetectionRepository(db)
        try:
            detection_ids = do_import(db, local_repo, str(zip_path), meta["format"], cancel_event)
            _write_progress(
                import_id,
                {
                    "total": len(detection_ids),
                    "completed": len(detection_ids),
                    "status": "completed",
                    "detectionIds": detection_ids,
                },
            )
        except Exception as exc:
            logger.exception("Dataset import failed")
            _write_progress(
                import_id,
                {"total": 0, "completed": 0, "status": "failed", "error": str(exc)},
            )
        finally:
            db.close()
            zip_path.unlink(missing_ok=True)
            # Clean up chunks
            shutil.rmtree(chunk_dir, ignore_errors=True)
            ACTIVE_IMPORTS.pop(import_id, None)

    t = threading.Thread(target=_run, name=f"import-{import_id[:8]}", daemon=True)
    t.start()

    return APIResponse(data={"importId": import_id, "status": "processing"})


@router.post("/datasets/import/chunk/{upload_id}/cancel")
def chunk_cancel(upload_id: str) -> APIResponse:
    """Cancel a chunked upload and clean up."""
    chunk_dir = CHUNK_DIR / upload_id
    if chunk_dir.exists():
        shutil.rmtree(chunk_dir, ignore_errors=True)
    # Also cancel any running import
    cancel_event = ACTIVE_IMPORTS.pop(upload_id, None)
    if cancel_event:
        cancel_event.set()
    return APIResponse(data={"ok": True})


# ── Direct upload (small files) ─────────────────────


@router.post("/datasets/import", status_code=201)
def import_dataset(
    file: UploadFile = File(...),
    fmt: str = Form("yolo", alias="format"),
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    """Upload a ZIP dataset and import annotations (direct, for smaller files)."""
    from ...services.dataset_import import import_dataset as do_import

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(400, "Only .zip files are supported")

    max_size = 200 * 1024 * 1024  # 200MB for direct upload
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_size:
        raise HTTPException(
            400,
            f"File exceeds 200MB limit. "
            f"Use chunked upload for files up to {settings.max_import_size_mb // 1024}GB.",
        )

    import_id = uuid.uuid4().hex
    progress_dir = Path(settings.project_root) / "import_progress"
    progress_dir.mkdir(parents=True, exist_ok=True)

    zip_path = progress_dir / f"{import_id}.zip"
    with open(zip_path, "wb") as f:
        f.write(file.file.read())

    cancel_event = threading.Event()
    ACTIVE_IMPORTS[import_id] = cancel_event

    _write_progress(import_id, {"total": 0, "completed": 0, "status": "processing"})

    def _run():
        db = SessionLocal()
        local_repo = DetectionRepository(db)
        try:
            detection_ids = do_import(db, local_repo, str(zip_path), fmt, cancel_event)
            _write_progress(
                import_id,
                {
                    "total": len(detection_ids),
                    "completed": len(detection_ids),
                    "status": "completed",
                    "detectionIds": detection_ids,
                },
            )
        except Exception as exc:
            logger.exception("Dataset import failed")
            _write_progress(
                import_id,
                {"total": 0, "completed": 0, "status": "failed", "error": str(exc)},
            )
        finally:
            db.close()
            zip_path.unlink(missing_ok=True)
            ACTIVE_IMPORTS.pop(import_id, None)

    t = threading.Thread(target=_run, name=f"import-{import_id[:8]}", daemon=True)
    t.start()

    return APIResponse(data={"importId": import_id, "status": "processing"})


# ── Progress & cancel (shared) ──────────────────────


@router.get("/datasets/import/{import_id}/progress")
def import_progress(import_id: str) -> APIResponse:
    """Get import progress."""
    data = _read_progress(import_id)
    if data is None:
        raise HTTPException(404, "Import not found")
    return APIResponse(data=data)


@router.post("/datasets/import/{import_id}/cancel")
def cancel_import(import_id: str) -> APIResponse:
    """Cancel a running import."""
    cancel_event = ACTIVE_IMPORTS.get(import_id)
    if cancel_event is None:
        raise HTTPException(404, "Import not found or already completed")
    cancel_event.set()
    return APIResponse(data={"ok": True})


# ── Helpers ─────────────────────────────────────────


def _progress_path(import_id: str) -> Path:
    return Path(settings.project_root) / "import_progress" / f"{import_id}.json"


def _write_progress(import_id: str, data: dict) -> None:
    _progress_path(import_id).write_text(json.dumps(data))


def _read_progress(import_id: str) -> dict | None:
    p = _progress_path(import_id)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except (json.JSONDecodeError, OSError):
        return None
