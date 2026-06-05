from __future__ import annotations

import asyncio
import json
import logging
import shutil
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from ...core.config import settings
from ...core.exceptions import AppError, NotFoundError
from ...repositories.detection import DetectionRepository
from ...schemas.common import APIResponse, BaseSchema
from ...schemas.detection import DetectionOut
from ...services.locate_anything import detect, get_model_status, is_model_loaded, unload_model
from ...services.sam2_service import get_sam2_status, is_sam_loaded, segment_image, unload_sam
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
    use_sam2: bool = Form(False),
    sam2_score_threshold: float = Form(0.0, ge=0.0, le=1.0),
    repo: DetectionRepository = Depends(get_repo),
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
    except json.JSONDecodeError as exc:
        raise HTTPException(400, detail="categories must be a JSON array") from exc
    if not cat_list:
        raise HTTPException(400, detail="categories cannot be empty")

    filepath, safe_name = _save_upload(file)
    original_name = Path(file.filename).name  # type: ignore[arg-type]

    t0 = time.perf_counter()
    try:
        result = await asyncio.to_thread(detect, filepath, cat_list)
    except AppError as exc:
        logger.exception("Inference failed")
        raise HTTPException(exc.status_code, detail=exc.detail) from exc

    # ── Scale boxes from detection space to original image space ──
    detect_w, detect_h = result["img_w"], result["img_h"]
    orig_w = result.get("orig_w", detect_w)
    orig_h = result.get("orig_h", detect_h)
    scale_x = orig_w / detect_w if detect_w != orig_w else 1.0
    scale_y = orig_h / detect_h if detect_h != orig_h else 1.0

    boxes_orig: list[dict] = [
        {
            **b,
            "x1": int(b["x1"] * scale_x),
            "y1": int(b["y1"] * scale_y),
            "x2": int(b["x2"] * scale_x),
            "y2": int(b["y2"] * scale_y),
        }
        for b in result["boxes"]
    ]

    # ── SAM2 segmentation (optional) ──
    polygons: list[list[list[float]]] = []
    if use_sam2 and boxes_orig:
        try:
            from PIL import Image

            img = Image.open(filepath).convert("RGB")
            try:
                polygons = segment_image(img, boxes_orig, score_threshold=sam2_score_threshold)
            finally:
                img.close()
        except Exception:
            logger.exception("SAM2 segmentation failed, falling back to bbox-only")

    # ── persistence via repository ──
    detection = repo.create(
        image_path=filepath,
        image_name=original_name,
        image_width=orig_w,
        image_height=orig_h,
        categories=cat_list,
    )
    detection.elapsed_ms = int((time.perf_counter() - t0) * 1000)
    box_dicts: list[dict] = [
        {
            "class_name": b.get("class_name") or cat_list[0] or "object",
            "x1": b["x1"],
            "y1": b["y1"],
            "x2": b["x2"],
            "y2": b["y2"],
            "confidence": b.get("confidence"),
            "mask_polygon": polygons[i] if i < len(polygons) else None,
        }
        for i, b in enumerate(boxes_orig)
    ]
    repo.add_boxes(detection.id, box_dicts)
    repo.db.commit()
    repo.db.refresh(detection)

    return APIResponse(
        data=DetectionOut.model_validate(detection).model_dump(by_alias=True),
    )


@router.get("/detections")
def list_detections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=10000, validation_alias="pageSize"),
    repo: DetectionRepository = Depends(get_repo),
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    items, total = repo.list(page=page, page_size=page_size)
    return APIResponse(
        data=[DetectionOut.model_validate(d).model_dump(by_alias=True) for d in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/detections/{detection_id}")
def get_detection(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    return APIResponse(
        data=DetectionOut.model_validate(det).model_dump(by_alias=True),
    )


@router.post("/detections/{detection_id}/delete", status_code=204)
def delete_detection(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
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
    repo: DetectionRepository = Depends(get_repo),
) -> None:
    box = repo.get_box(detection_id, box_id)
    if not box:
        raise NotFoundError("DetectionBox", box_id)
    repo.delete_box(box)
    repo.db.commit()


class AddBoxBody(BaseSchema):
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int


class UpdateBoxBody(BaseSchema):
    x1: int
    y1: int
    x2: int
    y2: int


@router.post("/detections/{detection_id}/boxes", status_code=201)
def add_box(
    detection_id: str,
    body: AddBoxBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    repo.add_boxes(
        detection_id,
        [
            {
                "class_name": body.class_name,
                "x1": body.x1,
                "y1": body.y1,
                "x2": body.x2,
                "y2": body.y2,
            }
        ],
    )
    repo.db.commit()
    return APIResponse(data={"ok": True})


class ReplaceBoxesBody(BaseSchema):
    boxes: list[dict]  # [{"x1","y1","x2","y2","class_name"}, ...]


@router.put("/detections/{detection_id}/boxes")
def replace_boxes(
    detection_id: str,
    body: ReplaceBoxesBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    repo.replace_boxes(detection_id, body.boxes)
    repo.db.commit()
    return APIResponse(data={"ok": True, "count": len(body.boxes)})


class FilterSettingsBody(BaseSchema):
    filter_mode: str  # best | nms | all
    filter_nms_iou: float | None = None


@router.put("/detections/{detection_id}/filter-settings")
def save_filter_settings(
    detection_id: str,
    body: FilterSettingsBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    det.filter_mode = body.filter_mode
    det.filter_nms_iou = body.filter_nms_iou
    repo.db.commit()
    return APIResponse(data={"ok": True})


@router.put("/detections/{detection_id}/boxes/{box_id}")
def update_box(
    detection_id: str,
    box_id: str,
    body: UpdateBoxBody,
    repo: DetectionRepository = Depends(get_repo),
) -> APIResponse:
    box = repo.get_box(detection_id, box_id)
    if not box:
        raise NotFoundError("DetectionBox", box_id)
    box.x1, box.y1, box.x2, box.y2 = body.x1, body.y1, body.x2, body.y2
    repo.db.commit()
    return APIResponse(data={"ok": True})


@router.get("/detections/{detection_id}/image")
def get_detection_image(
    detection_id: str,
    repo: DetectionRepository = Depends(get_repo),
):
    det = repo.get_by_id(detection_id)
    if not det:
        raise NotFoundError("Detection", detection_id)
    path = Path(det.image_path)
    if not path.exists():
        raise HTTPException(404, "Image file not found")
    return FileResponse(str(path))


@router.get("/model/status")
def model_status() -> APIResponse:
    status = get_model_status()
    return APIResponse(
        data={
            "loaded": status["state"] == "loaded",
            "state": status["state"],
            "stage": status["stage"],
            "progress": status["progress"],
            "error": status["error"],
        }
    )


@router.post("/model/unload", status_code=204)
def model_unload() -> None:
    if is_model_loaded():
        unload_model()


@router.get("/model/sam2/status")
def sam2_status() -> APIResponse:
    status = get_sam2_status()
    return APIResponse(
        data={
            "loaded": status["state"] == "loaded",
            "state": status["state"],
            "stage": status["stage"],
            "progress": status["progress"],
            "error": status["error"],
        }
    )


@router.post("/model/sam2/unload", status_code=204)
def sam2_unload() -> None:
    if is_sam_loaded():
        unload_sam()
