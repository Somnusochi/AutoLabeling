"""Training job management routes."""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import tempfile
import threading
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.responses import StreamingResponse

from ...core.config import settings
from ...core.database import get_db
from ...models.train import TrainingDetection, TrainingJob
from ...schemas.common import APIResponse
from ...schemas.train import TrainingJobOut, TrainRequest
from ...services.trainer import YOLO_SERIES, run_training_safe
from ..deps import get_request_id

logger = logging.getLogger(__name__)
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
        db.add(
            TrainingDetection(
                training_job_id=job.id,
                detection_id=UUID(det_id),
            )
        )
    db.commit()
    db.refresh(job)

    # Run training in background thread
    thread = threading.Thread(
        target=run_training_safe,
        args=(
            str(job.id),
            body.detection_ids,
            body.model_variant,
            body.epochs,
            body.imgsz,
            body.batch,
            body.train_ratio,
            body.val_ratio,
            body.task_type,
        ),
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
                    if (
                        data.get("epoch", 0) >= data.get("totalEpochs", 0)
                        and data.get("totalEpochs", 0) > 0
                    ):
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

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    try:
        base = shutil.make_archive(str(tmp_path.with_suffix("")), "zip", work_dir)
        return FileResponse(
            base,
            media_type="application/zip",
            filename=f"dataset_{job.model_variant}.zip",
        )
    except Exception as exc:
        tmp_path.unlink(missing_ok=True)
        raise HTTPException(500, "Failed to create dataset archive") from exc


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
        onnx = (
            str(export_path) if isinstance(export_path, str) else str(pt_path.with_suffix(".onnx"))
        )
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


@router.post("/jobs/{job_id}/retrain")
def retrain_job(
    job_id: UUID,
    db: Session = Depends(get_db),
):
    """Re-run training with the same detection_ids and settings."""
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, "Training job not found")

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
        db.add(
            TrainingDetection(
                training_job_id=new_job.id,
                detection_id=link.detection_id,
            )
        )
    db.commit()
    db.refresh(new_job)

    detection_ids = [str(link.detection_id) for link in new_job.detection_links]
    thread = threading.Thread(
        target=run_training_safe,
        args=(
            str(new_job.id),
            detection_ids,
            new_job.model_variant,
            new_job.epochs,
            new_job.imgsz,
            new_job.batch,
            new_job.train_ratio,
            new_job.val_ratio,
            new_job.task_type,
        ),
        daemon=True,
    )
    thread.start()

    return APIResponse(data=TrainingJobOut.model_validate(new_job).model_dump(by_alias=True))
