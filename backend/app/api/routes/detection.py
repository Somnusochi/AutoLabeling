from __future__ import annotations

import json
import logging
import shutil
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from ...core.config import settings
from ...core.database import get_db
from ...core.exceptions import AppError, NotFoundError
from ...schemas.common import APIResponse
from ...schemas.detection import DetectionListOut, DetectionOut
from ...services.locate_anything import detect
from ..deps import get_repo, get_request_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["detection"])


def _save_upload(file: UploadFile) -> tuple[str, str]:
    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"  # type: ignore[arg-type]
    filepath = str(settings.upload_dir / safe_name)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return filepath, safe_name


@router.post("/detect", status_code=201)
async def create_detection(
    file: UploadFile = File(...),
    categories: str = Form(...),
    repo: "DetectionRepository" = Depends(get_repo),  # noqa: F821
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, detail="File must be an image")

    file.file.seek(0, 2)
    size_mb = file.file.tell() / (1024 * 1024)
    file.file.seek(0)
    if size_mb > settings.max_upload_size_mb:
        raise HTTPException(400, detail=f"File exceeds {settings.max_upload_size_mb}MB limit")

    try:
        cat_list: list[str] = json.loads(categories)
    except json.JSONDecodeError:
        raise HTTPException(400, detail="categories must be a JSON array")
    if not cat_list:
        raise HTTPException(400, detail="categories cannot be empty")

    filepath, safe_name = _save_upload(file)
    original_name = Path(file.filename).name  # type: ignore[arg-type]

    t0 = time.perf_counter()
    try:
        result = detect(filepath, cat_list)
    except AppError as exc:
        logger.exception("Inference failed")
        raise HTTPException(exc.status_code, detail=exc.detail) from exc

    # ── persistence via repository ──
    detection = repo.create(
        image_path=filepath,
        image_name=original_name,
        image_width=result["img_w"],
        image_height=result["img_h"],
        categories=json.dumps(cat_list),
    )
    box_dicts: list[dict] = [
        {
            "class_name": b.get("class_name") or cat_list[0] or "object",
            "x1": b["x1"], "y1": b["y1"],
            "x2": b["x2"], "y2": b["y2"],
        }
        for b in result["boxes"]
    ]
    repo.add_boxes(detection.id, box_dicts)
    repo.db.commit()
    repo.db.refresh(detection)

    elapsed_ms = int((time.perf_counter() - t0) * 1000)

    return APIResponse(
        data=DetectionOut.model_validate(detection).model_dump(),
        meta={"request_id": request_id, "elapsed_ms": elapsed_ms},
    )


@router.get("/detections")
def list_detections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    repo: "DetectionRepository" = Depends(get_repo),  # noqa: F821
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    items, total = repo.list(page=page, page_size=page_size)
    return APIResponse(
        data=DetectionListOut(
            total=total,
            items=[DetectionOut.model_validate(d) for d in items],
        ).model_dump(),
        meta={"request_id": request_id, "page": page, "page_size": page_size},
    )


@router.get("/detections/{detection_id}")
def get_detection(
    detection_id: str,
    repo: "DetectionRepository" = Depends(get_repo),  # noqa: F821
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    return APIResponse(
        data=DetectionOut.model_validate(det).model_dump(),
        meta={"request_id": request_id},
    )


@router.post("/detections/{detection_id}/delete", status_code=204)
def delete_detection(
    detection_id: str,
    repo: "DetectionRepository" = Depends(get_repo),  # noqa: F821
) -> None:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    try:
        Path(det.image_path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete image file: %s", det.image_path)
    repo.delete(det)
    repo.db.commit()


@router.post("/detections/{detection_id}/boxes/{box_id}/delete", status_code=204)
def delete_box(
    detection_id: str,
    box_id: str,
    db: "Session" = Depends(get_db),  # noqa: F821
) -> None:
    from ...models.detection import DetectionBox

    box = db.query(DetectionBox).filter(
        DetectionBox.id == box_id,
        DetectionBox.detection_id == detection_id,
    ).first()
    if not box:
        raise NotFoundError("DetectionBox", box_id)
    db.delete(box)
    db.commit()


@router.get("/detections/{detection_id}/image")
def get_detection_image(
    detection_id: str,
    repo: "DetectionRepository" = Depends(get_repo),  # noqa: F821
):
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    path = Path(det.image_path)
    if not path.exists():
        raise HTTPException(404, "Image file not found")
    return FileResponse(str(path))
