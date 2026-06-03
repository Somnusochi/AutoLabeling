"""Image/video prediction and model validation routes."""
from __future__ import annotations

import asyncio
import io
import json
import subprocess
import tempfile
import uuid
from pathlib import Path
from uuid import UUID

from PIL import Image
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from starlette.responses import StreamingResponse

from ...core.config import settings
from ...core.database import SessionLocal, get_db
from ...models.train import TrainingJob
from ...models.video import Video
from ...schemas.common import APIResponse
from ...services.trainer import predict_trained_model
from ...services.video_service import _ffprobe
from ...services.frame_utils import draw_frame, predict_frame
from sqlalchemy.orm import Session

router = APIRouter(prefix="/api/v1/train", tags=["predict"])


# ── External model storage ────────────────────────────

_external_models_dir = Path(__file__).resolve().parent.parent.parent.parent / "external_models"
_external_models_dir.mkdir(exist_ok=True)


def _token_path(token: str) -> Path:
    return _external_models_dir / f"{token}.pt"


@router.post("/upload-model")
async def upload_external_model(file: UploadFile = File(...)):
    """Upload an external YOLO .pt model, return a token for MJPEG validation."""
    if not file.filename or not file.filename.endswith(".pt"):
        raise HTTPException(400, "Only .pt files are accepted")

    token = uuid.uuid4().hex
    dst = _token_path(token)
    content = await file.read()
    dst.write_bytes(content)

    return APIResponse(data={"token": token, "fileName": file.filename})


# ── Single image prediction ────────────────────────────

@router.post("/jobs/{job_id}/predict")
async def predict_with_model(
    job_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
):
    """Run inference with a trained YOLO model on an uploaded image."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Trained model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed yet")
    if not Path(job.model_path).exists():
        raise HTTPException(404, "Model file not found on disk")

    img_bytes = await file.read()
    try:
        img = Image.open(io.BytesIO(img_bytes))
        result = predict_trained_model(job.model_path, img, device=settings.resolved_device, conf=conf, iou=iou)
    except Exception as exc:
        raise HTTPException(500, f"Inference failed: {exc}") from exc

    class_map = {}
    if job.metrics and isinstance(job.metrics, dict):
        class_map = job.metrics.get("class_map", {})

    boxes_camel = [
        {
            "className": b["class_name"],
            "confidence": b["confidence"],
            "x1": b["x1"], "y1": b["y1"],
            "x2": b["x2"], "y2": b["y2"],
        }
        for b in result["boxes"]
    ]
    return APIResponse(data={
        "imageWidth": result["image_width"],
        "imageHeight": result["image_height"],
        "boxes": boxes_camel,
        "modelVariant": job.model_variant,
        "classMap": class_map,
    })


@router.post("/validate-image/{token}")
async def predict_external_model(
    token: str,
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
):
    """Run inference with an uploaded external YOLO model (via token) on an image."""
    model_path = _token_path(token)
    if not model_path.exists():
        raise HTTPException(404, "Model token not found or expired")

    img_bytes = await file.read()
    try:
        img = Image.open(io.BytesIO(img_bytes))
        result = predict_trained_model(str(model_path), img, device=settings.resolved_device, conf=conf, iou=iou)
    except Exception as exc:
        raise HTTPException(500, f"Inference failed: {exc}") from exc

    boxes_camel = [
        {
            "className": b["class_name"],
            "confidence": b["confidence"],
            "x1": b["x1"], "y1": b["y1"],
            "x2": b["x2"], "y2": b["y2"],
        }
        for b in result["boxes"]
    ]
    return APIResponse(data={
        "imageWidth": result["image_width"],
        "imageHeight": result["image_height"],
        "boxes": boxes_camel,
    })


# ── MJPEG video validation ────────────────────────────

@router.get("/validate-mjpeg/{token}/{video_id}")
async def validate_mjpeg_external(
    token: str,
    video_id: UUID,
    conf: float = Query(0.25),
    iou: float = Query(0.45),
):
    """MJPEG validation with an external model (token from upload-model)."""
    model_path = _token_path(token)
    if not model_path.exists():
        raise HTTPException(404, "Model token not found or expired")
    model_path = str(model_path)

    db = SessionLocal()
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(404, "Video not found")
        vp = Path(video.file_path)
        if not vp.exists():
            raise HTTPException(404, "Video file not found")
        video_path = str(vp)
    finally:
        db.close()

    meta = _ffprobe(video_path)
    fps = meta["fps"]

    async def mjpeg_stream():
        proc = subprocess.Popen(
            ["ffmpeg", "-y", "-i", video_path, "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        assert proc.stdout is not None
        buf, frame_num = b"", 0
        try:
            while True:
                chunk = await asyncio.to_thread(proc.stdout.read, 4096)
                if not chunk:
                    break
                buf += chunk
                end = buf.find(b"\xff\xd9")
                if end == -1:
                    continue
                jpg = buf[:end + 2]; buf = buf[end + 2:]
                annotated = await asyncio.to_thread(draw_frame, model_path, jpg, settings.resolved_device, conf, iou, frame_num, fps)
                if annotated:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + annotated + b"\r\n")
                    await asyncio.sleep(0)
                frame_num += 1
        except BaseException:
            proc.terminate()
            raise
        finally:
            proc.terminate()

    return StreamingResponse(mjpeg_stream(), media_type="multipart/x-mixed-replace; boundary=frame",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/jobs/{job_id}/validate-mjpeg/{video_id}")
async def validate_mjpeg(
    job_id: UUID,
    video_id: UUID,
    db: Session = Depends(get_db),
    conf: float = Query(0.25),
    iou: float = Query(0.45),
):
    """MJPEG endpoint: process every video frame, draw boxes, stream as MJPEG."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Trained model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed")
    if not Path(job.model_path).exists():
        raise HTTPException(404, "Model file not found on disk")

    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(404, "Video not found")
    if not Path(video.file_path).exists():
        raise HTTPException(404, "Video file not found on disk")

    video_path = video.file_path
    meta = _ffprobe(video_path)
    fps = meta["fps"]

    async def mjpeg_stream():
        proc = subprocess.Popen(
            ["ffmpeg", "-y", "-i", video_path,
             "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        assert proc.stdout is not None
        buf = b""
        frame_num = 0

        try:
            while True:
                chunk = await asyncio.to_thread(proc.stdout.read, 4096)
                if not chunk:
                    break
                buf += chunk
                end = buf.find(b"\xff\xd9")
                if end == -1:
                    continue
                jpg = buf[:end + 2]
                buf = buf[end + 2:]

                annotated = await asyncio.to_thread(
                    draw_frame, job.model_path, jpg, settings.resolved_device, conf, iou, frame_num, fps
                )
                if annotated:
                    yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + annotated + b"\r\n")
                    await asyncio.sleep(0)
                frame_num += 1
        except BaseException:
            proc.terminate()
            raise
        finally:
            proc.terminate()

    return StreamingResponse(
        mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── SSE video prediction ──────────────────────────────

@router.post("/jobs/{job_id}/predict-video-stream")
async def predict_video_stream(
    job_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
):
    """SSE endpoint: process every video frame and stream YOLO results in real-time."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Trained model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed")
    if not Path(job.model_path).exists():
        raise HTTPException(404, "Model file not found on disk")

    tmp_video = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_video.write(await file.read())
    tmp_video.close()

    meta = _ffprobe(tmp_video.name)
    fps = meta["fps"]
    total_frames = meta["total_frames"]

    async def event_stream():
        frame_num = 0

        proc = subprocess.Popen(
            ["ffmpeg", "-y", "-i", tmp_video.name,
             "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "5", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        assert proc.stdout is not None

        buf = b""
        start_time = None
        processed = 0

        try:
            while True:
                chunk = await asyncio.to_thread(proc.stdout.read, 4096)
                if not chunk:
                    break
                buf += chunk
                end = buf.find(b"\xff\xd9")
                if end == -1:
                    continue
                jpg_data = buf[:end + 2]
                buf = buf[end + 2:]

                if start_time is None:
                    start_time = asyncio.get_running_loop().time()

                result = await asyncio.to_thread(
                    predict_frame,
                    job.model_path,
                    jpg_data,
                    settings.resolved_device,
                    conf,
                    iou,
                )

                timestamp = round(frame_num / fps, 3) if fps > 0 else frame_num
                boxes_camel = [{
                    "className": b["class_name"],
                    "confidence": b["confidence"],
                    "x1": b["x1"], "y1": b["y1"],
                    "x2": b["x2"], "y2": b["y2"],
                } for b in result["boxes"]]

                yield f"data: {json.dumps({'frame': frame_num, 'fps': fps, 'totalFrames': total_frames, 'timestamp': timestamp, 'imageWidth': result['image_width'], 'imageHeight': result['image_height'], 'boxes': boxes_camel})}\n\n"

                frame_num += 1
                processed += 1
                await asyncio.sleep(0)
        except BaseException:
            proc.terminate()
            raise
        finally:
            proc.terminate()
            elapsed = asyncio.get_running_loop().time() - start_time if start_time else 0
            yield f"data: {json.dumps({'done': True, 'frames': processed, 'elapsed': round(elapsed, 2)})}\n\n"
            Path(tmp_video.name).unlink(missing_ok=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Sync video prediction ──────────────────────────────

@router.post("/jobs/{job_id}/predict-video")
def predict_video(
    job_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
    interval: float = Form(2.0),
    max_frames: int = Form(100),
):
    """Validate model on a video: extract frames, run inference, return results."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Trained model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed")
    if not Path(job.model_path).exists():
        raise HTTPException(404, "Model file not found on disk")

    tmp_video = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_video.write(file.file.read())
    tmp_video.close()

    try:
        meta = _ffprobe(tmp_video.name)
        fps = meta["fps"]
        frame_step = max(1, int(interval * fps))

        proc = subprocess.Popen(
            ["ffmpeg", "-y", "-i", tmp_video.name,
             "-vf", f"select='not(mod(n,{frame_step}))'",
             "-vsync", "vfr", "-f", "image2pipe", "-vcodec", "mjpeg", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        )
        results: list[dict] = []
        frame_num = 0
        buf = b""
        assert proc.stdout is not None

        while len(results) < max_frames:
            chunk = proc.stdout.read(4096)
            if not chunk:
                break
            buf += chunk
            end = buf.find(b"\xff\xd9")
            if end == -1:
                continue
            jpg_data = buf[:end + 2]
            buf = buf[end + 2:]

            img = Image.open(io.BytesIO(jpg_data))
            r = predict_trained_model(job.model_path, img, device=settings.resolved_device, conf=conf, iou=iou)

            boxes_camel = [{
                "className": b["class_name"],
                "confidence": b["confidence"],
                "x1": b["x1"], "y1": b["y1"],
                "x2": b["x2"], "y2": b["y2"],
            } for b in r["boxes"]]
            results.append({
                "frameNumber": frame_num,
                "timestampSeconds": round(frame_num / fps * frame_step, 3),
                "imageWidth": r["image_width"],
                "imageHeight": r["image_height"],
                "boxes": boxes_camel,
            })
            frame_num += 1

        proc.terminate()
        return APIResponse(data={
            "modelVariant": job.model_variant,
            "frameCount": len(results),
            "frames": results,
        })
    finally:
        Path(tmp_video.name).unlink(missing_ok=True)
