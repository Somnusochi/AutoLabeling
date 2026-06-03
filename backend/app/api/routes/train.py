from __future__ import annotations

import asyncio
import io
import json
import logging
import os
import shutil
import subprocess
import tempfile
import uuid
import threading
from pathlib import Path
from uuid import UUID

import cv2
import numpy as np
from PIL import Image
from starlette.responses import StreamingResponse
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import SessionLocal, get_db
from ...models.train import TrainingDetection, TrainingJob
from ...models.video import Video
from ...schemas.common import APIResponse
from ...schemas.train import TrainingJobOut, TrainRequest
from ...services.trainer import YOLO_SERIES, run_training_safe, predict_trained_model
from ...services.video_service import _ffprobe
from ..deps import get_request_id

router = APIRouter(prefix="/api/v1/train", tags=["train"])


@router.get("/variants")
def list_variants() -> APIResponse:
    """Return available YOLO model variants."""
    return APIResponse(data=YOLO_SERIES)


@router.post("/jobs", status_code=201)
def create_training_job(
    body: TrainRequest,
    db: Session = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> APIResponse:
    job = TrainingJob(
        model_variant=body.model_variant,
        epochs=body.epochs,
        imgsz=body.imgsz,
        batch=body.batch,
        train_ratio=body.train_ratio,
        val_ratio=body.val_ratio,
        task_type=body.task_type,
        status="pending",
    )
    db.add(job)
    db.flush()

    for det_id in body.detection_ids:
        db.add(TrainingDetection(
            training_job_id=job.id,
            detection_id=UUID(det_id),
        ))
    db.commit()
    db.refresh(job)

    # Run training in background thread
    thread = threading.Thread(
        target=run_training_safe,
        args=(str(job.id), body.detection_ids, body.model_variant,
              body.epochs, body.imgsz, body.batch, body.train_ratio, body.val_ratio),
        daemon=True,
    )
    thread.start()

    return APIResponse(
        data=TrainingJobOut.model_validate(job).model_dump(by_alias=True),
    )


@router.get("/jobs/{job_id}/progress")
def get_progress(job_id: str) -> APIResponse:
    """Read training progress from the work directory."""
    progress_file = settings.project_root / "training_runs" / job_id / "progress.json"
    if not progress_file.exists():
        return APIResponse(data={"epoch": 0, "totalEpochs": 0, "loss": 0})

    try:
        data = json.loads(progress_file.read_text())
    except (json.JSONDecodeError, OSError):
        data = {"epoch": 0, "total_epochs": 0, "loss": 0}
    return APIResponse(data=data)


@router.get("/jobs/{job_id}/progress/stream")
async def stream_progress(job_id: str):
    """SSE endpoint: pushes training progress in real time."""
    progress_file = settings.project_root / "training_runs" / job_id / "progress.json"

    async def event_stream():
        last = ""
        while True:
            await asyncio.sleep(1)
            if progress_file.exists():
                try:
                    current = progress_file.read_text()
                except OSError:
                    continue
                if current != last:
                    last = current
                    yield f"data: {current}\n\n"
                    data = json.loads(current)
                    if data.get("epoch", 0) >= data.get("totalEpochs", 0) and data.get("totalEpochs", 0) > 0:
                        yield f"data: {current}\n\n"
                        break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/jobs")
def list_jobs(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, validation_alias="pageSize"),
) -> APIResponse:
    q = db.query(TrainingJob)
    total = q.count()
    items = (
        q.order_by(TrainingJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return APIResponse(
        data=[TrainingJobOut.model_validate(j).model_dump(by_alias=True) for j in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/jobs/{job_id}")
def get_job(
    job_id: UUID,
    db: Session = Depends(get_db),
) -> APIResponse:
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, f"Training job {job_id} not found")
    return APIResponse(data=TrainingJobOut.model_validate(job).model_dump(by_alias=True))


@router.post("/jobs/{job_id}/delete", status_code=204)
def delete_job(
    job_id: UUID,
    db: Session = Depends(get_db),
) -> None:
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, f"Training job {job_id} not found")
    if job.model_path:
        Path(job.model_path).unlink(missing_ok=True)
    db.delete(job)
    db.commit()


@router.get("/jobs/{job_id}/dataset")
def download_dataset(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Download the training dataset (images + labels + data.yaml) as a zip."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Training job not found")

    work_dir = settings.project_root / "training_runs" / str(job_id)
    if not work_dir.exists():
        raise HTTPException(404, "Dataset not found")

    tmp = tempfile.NamedTemporaryFile(suffix=".zip", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()

    try:
        base = shutil.make_archive(str(tmp_path.with_suffix("")), "zip", work_dir)
        return FileResponse(
            base,
            media_type="application/zip",
            filename=f"dataset_{job.model_variant}.zip",
        )
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(500, "Failed to create dataset archive")


@router.get("/jobs/{job_id}/charts/{chart_name}", response_class=FileResponse)
def get_chart(
    job_id: UUID,
    chart_name: str,
    db: Session = Depends(get_db),
):
    """Serve training chart images (results.png, confusion_matrix.png, etc.)."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Training job not found")

    work_dir = (settings.project_root / "training_runs" / str(job_id)).resolve()
    chart_path = (work_dir / chart_name).resolve()
    if not chart_path.is_relative_to(work_dir):
        raise HTTPException(400, "Invalid chart name")

    if not chart_path.exists():
        raise HTTPException(404, f"Chart not found: {chart_name}")

    return FileResponse(str(chart_path), media_type="image/png")


@router.post("/jobs/{job_id}/export-onnx")
def export_onnx(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Download pre-converted ONNX model, or convert on demand."""
    from ultralytics import YOLO

    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed")

    # Use pre-converted file if available
    if job.onnx_path and Path(job.onnx_path).exists():
        return FileResponse(
            job.onnx_path,
            media_type="application/octet-stream",
            filename=f"{job.model_variant}_finetuned.onnx",
        )

    # Convert on demand
    pt_path = Path(job.model_path)
    if not pt_path.exists():
        raise HTTPException(404, "Model file not found on disk")

    try:
        model = YOLO(str(pt_path))
        export_path = model.export(format="onnx", imgsz=640, half=False)
        onnx = str(export_path) if isinstance(export_path, str) else str(pt_path.with_suffix(".onnx"))
        # Cache path for future requests
        job.onnx_path = onnx
        db.commit()
        return FileResponse(
            onnx,
            media_type="application/octet-stream",
            filename=f"{job.model_variant}_finetuned.onnx",
        )
    except Exception as exc:
        raise HTTPException(500, f"ONNX export failed: {exc}") from exc


@router.get("/jobs/{job_id}/download")
def download_model(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Model not found or training not completed")
    return FileResponse(
        job.model_path,
        media_type="application/octet-stream",
        filename=f"{job.model_variant}_finetuned.pt",
    )


# Persistent storage for uploaded external models

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
        if not video: raise HTTPException(404, "Video not found")
        vp = Path(video.file_path)
        if not vp.exists(): raise HTTPException(404, "Video file not found")
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
                if not chunk: break
                buf += chunk
                end = buf.find(b"\xff\xd9")
                if end == -1: continue
                jpg = buf[:end + 2]; buf = buf[end + 2:]
                annotated = await asyncio.to_thread(_draw_frame, model_path, jpg, settings.resolved_device, conf, iou, frame_num, fps)
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
                if not chunk: break
                buf += chunk
                end = buf.find(b"\xff\xd9")
                if end == -1: continue
                jpg = buf[:end + 2]
                buf = buf[end + 2:]

                annotated = await asyncio.to_thread(
                    _draw_frame, job.model_path, jpg, settings.resolved_device, conf, iou, frame_num, fps
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


def _draw_frame(model_path: str, jpg: bytes, device: str, conf: float, iou: float, frame_num: int, fps: float) -> bytes | None:
    """Run YOLO, draw boxes on frame, return annotated JPEG bytes."""
    try:
        img = Image.open(io.BytesIO(jpg))
        r = predict_trained_model(model_path, img, device=device, conf=conf, iou=iou)

        frame = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2BGR)
        for b in r["boxes"]:
            cv2.rectangle(frame, (b["x1"], b["y1"]), (b["x2"], b["y2"]), (0, 255, 0), 2)
            label = f"{b['class_name']} {b['confidence']:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            cv2.rectangle(frame, (b["x1"], b["y1"] - th - 4), (b["x1"] + tw + 4, b["y1"]), (0, 255, 0), -1)
            cv2.putText(frame, label, (b["x1"] + 2, b["y1"] - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

        # Add info overlay
        ts_str = f"Frame {frame_num} | {frame_num/fps:.1f}s" if fps > 0 else f"Frame {frame_num}"
        cv2.putText(frame, ts_str, (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        return buf.tobytes()
    except Exception:
        return None


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

        # Pipe every frame as JPEG (no frame skip)
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

                # Run YOLO in thread pool (CPU-bound)
                result = await asyncio.to_thread(
                    _predict_frame,
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
                await asyncio.sleep(0)  # yield to event loop
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


def _predict_frame(model_path: str, jpg_data: bytes, device: str, conf: float, iou: float) -> dict:
    """Run YOLO on a single JPEG frame. Called in thread pool."""
    img = Image.open(io.BytesIO(jpg_data))
    r = predict_trained_model(model_path, img, device=device, conf=conf, iou=iou)
    return r


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

    # Save uploaded video
    tmp_video = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_video.write(file.file.read())
    tmp_video.close()

    try:
        meta = _ffprobe(tmp_video.name)
        fps = meta["fps"]
        frame_step = max(1, int(interval * fps))

        # Extract frames via ffmpeg pipe
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
            # JPEG end marker
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


@router.post("/jobs/{job_id}/retrain")
def retrain_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Re-run training with the same detection_ids and settings."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Training job not found")

    import uuid as _uuid
    new_job = TrainingJob(
        model_variant=job.model_variant,
        epochs=job.epochs,
        imgsz=job.imgsz,
        batch=job.batch,
        train_ratio=job.train_ratio,
        val_ratio=job.val_ratio,
        task_type=job.task_type,
        status="pending",
    )
    db.add(new_job)
    db.flush()

    for link in job.detection_links:
        db.add(TrainingDetection(
            training_job_id=new_job.id,
            detection_id=link.detection_id,
        ))
    db.commit()
    db.refresh(new_job)

    detection_ids = [str(link.detection_id) for link in new_job.detection_links]
    thread = threading.Thread(
        target=run_training_safe,
        args=(str(new_job.id), detection_ids, new_job.model_variant,
              new_job.epochs, new_job.imgsz, new_job.batch,
              new_job.train_ratio, new_job.val_ratio),
        daemon=True,
    )
    thread.start()

    return APIResponse(data=TrainingJobOut.model_validate(new_job).model_dump(by_alias=True))


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

    # Convert snake_case result to camelCase for API consistency
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


