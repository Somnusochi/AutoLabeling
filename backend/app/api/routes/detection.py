from __future__ import annotations

import asyncio
import json
import logging
import shutil
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from ...core.config import settings
from ...core.exceptions import AppError, NotFoundError
from ...repositories.detection import DetectionRepository
from ...schemas.common import APIResponse, BaseSchema
from ...schemas.detection import DetectionListItem, DetectionOut
from ...services.detection_strategy import create_strategy
from ...services.locate_anything import get_model_status, is_model_loaded, unload_model
from ...services.sam2_service import get_sam2_status, is_sam_loaded, unload_sam
from ...services.sam3_client import is_sam3_running, stop_sam3_server
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
    use_sam3: bool = Form(False),
    sam2_score_threshold: float = Form(0.0, ge=0.0, le=1.0),
    sam3_text: str = Form(""),
    use_sam3_seg: bool = Form(True),
    sam3_threshold: float = Form(0.5, ge=0.0, le=1.0),
    sam3_mask_threshold: float = Form(0.5, ge=0.0, le=1.0),
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

    # Unload the competing model to free GPU memory
    if use_sam3:
        if is_model_loaded():
            unload_model()
        if is_sam_loaded():
            unload_sam()
    else:
        if is_sam3_running():
            stop_sam3_server()

    t0 = time.perf_counter()

    strategy = create_strategy(use_sam2=use_sam2, use_sam3=use_sam3)
    strategy_kwargs = {
        "sam2_score_threshold": sam2_score_threshold,
        "use_sam3_seg": use_sam3_seg,
        "sam3_threshold": sam3_threshold,
        "sam3_mask_threshold": sam3_mask_threshold,
    }
    try:
        result = await asyncio.to_thread(strategy.detect, filepath, cat_list, **strategy_kwargs)
    except AppError as exc:
        logger.exception("Inference failed")
        raise HTTPException(exc.status_code, detail=exc.detail) from exc

    # ── persistence via repository ──
    if use_sam3:
        model_type = "sam3"
    elif use_sam2:
        model_type = "vlm+sam2"
    else:
        model_type = "vlm"

    detection = repo.create(
        image_path=filepath,
        image_name=original_name,
        image_width=result.img_w,
        image_height=result.img_h,
        categories=cat_list,
    )
    detection.model_type = model_type
    detection.elapsed_ms = int((time.perf_counter() - t0) * 1000)
    polys = result.polygons
    box_dicts: list[dict] = [
        {
            "class_name": b.get("class_name") or cat_list[0] or "object",
            "x1": b["x1"],
            "y1": b["y1"],
            "x2": b["x2"],
            "y2": b["y2"],
            "confidence": b.get("confidence"),
            "mask_polygon": polys[i] if i < len(polys) else None,
        }
        for i, b in enumerate(result.boxes)
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
        data=[DetectionListItem.model_validate(d).model_dump(by_alias=True) for d in items],
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


@router.get("/model/sam3/status")
def sam3_status() -> APIResponse:
    import urllib.request

    try:
        resp = urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=2)
        import json as _json

        data = _json.loads(resp.read())
        status = data.get("status", "unloaded")
        return APIResponse(data={"loaded": status == "loaded", "status": status})
    except Exception:
        return APIResponse(data={"loaded": False, "status": "unloaded"})


@router.get("/model/events")
async def model_events():
    """SSE endpoint that pushes combined model status for VLM, SAM2, and SAM3."""

    async def event_stream():
        import urllib.request

        prev = ""
        # Fast poll during startup, slow down once all models are stable
        fast_interval = 1.5
        slow_interval = 10.0
        stable_count = 0

        while True:
            # VLM status
            vlm = get_model_status()

            # SAM2 status
            sam2 = get_sam2_status()

            # SAM3 status
            sam3_data: dict = {"loaded": False, "status": "unloaded"}
            try:
                resp = urllib.request.urlopen("http://127.0.0.1:8002/health", timeout=1)
                import json as _json

                data = _json.loads(resp.read())
                sam3_data = {
                    "loaded": data.get("status") == "loaded",
                    "status": data.get("status", "unloaded"),
                }
            except Exception:
                pass

            payload = json.dumps({"vlm": vlm, "sam2": sam2, "sam3": sam3_data})
            if payload != prev:
                prev = payload
                yield f"data: {payload}\n\n"

            # Use fast interval while any model is in transition, slow otherwise
            all_stable = all(
                s in ("loaded", "unloaded")
                for s in (vlm.get("state", ""), sam2.get("state", ""), sam3_data.get("status", ""))
            )
            if all_stable:
                stable_count += 1
            else:
                stable_count = 0

            interval = slow_interval if stable_count > 3 else fast_interval
            await asyncio.sleep(interval)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/model/sam3/unload", status_code=204)
def sam3_unload() -> None:
    if is_sam3_running():
        stop_sam3_server()
