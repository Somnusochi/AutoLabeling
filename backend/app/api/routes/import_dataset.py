"""Dataset import routes."""

from __future__ import annotations

import json
import logging
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ...core.config import settings
from ...core.database import SessionLocal
from ...repositories.detection import DetectionRepository
from ...schemas.common import APIResponse
from ..deps import get_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["import"])

ACTIVE_IMPORTS: dict[str, threading.Event] = {}


@router.post("/datasets/import", status_code=201)
def import_dataset(
    file: UploadFile = File(...),
    fmt: str = Form("yolo", alias="format"),
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    """Upload a ZIP dataset and import annotations."""
    from ...services.dataset_import import import_dataset as do_import

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(400, "Only .zip files are supported")

    max_size = 1024 * 1024 * 1024  # 1GB for dataset ZIPs
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > max_size:
        raise HTTPException(400, "File exceeds 1GB limit")

    import_id = uuid.uuid4().hex
    progress_dir = Path(settings.project_root) / "import_progress"
    progress_dir.mkdir(parents=True, exist_ok=True)

    # Save ZIP to temp location
    zip_path = progress_dir / f"{import_id}.zip"
    with open(zip_path, "wb") as f:
        f.write(file.file.read())

    cancel_event = threading.Event()
    ACTIVE_IMPORTS[import_id] = cancel_event

    # Write initial progress
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
