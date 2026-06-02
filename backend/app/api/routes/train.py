from __future__ import annotations

import json
import threading

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...models.train import TrainingJob
from ...schemas.common import APIResponse
from ...schemas.train import TrainingJobListOut, TrainingJobOut, TrainRequest
from ...services.trainer import YOLO_SERIES, run_training_safe
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
        detection_ids=json.dumps(body.detection_ids),
        status="pending",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Run training in background thread
    thread = threading.Thread(
        target=run_training_safe,
        args=(job.id, body.detection_ids, body.model_variant,
              body.epochs, body.imgsz, body.batch),
        daemon=True,
    )
    thread.start()

    return APIResponse(
        data=TrainingJobOut.model_validate(job).model_dump(),
        meta={"request_id": request_id},
    )


@router.get("/jobs/{job_id}/progress")
def get_progress(job_id: str) -> APIResponse:
    """Read training progress from the work directory."""
    import json
    from pathlib import Path

    from ...core.config import settings

    progress_file = settings.project_root / "training_runs" / job_id / "progress.json"
    if not progress_file.exists():
        return APIResponse(data={"epoch": 0, "total_epochs": 0, "loss": 0})

    try:
        data = json.loads(progress_file.read_text())
    except (json.JSONDecodeError, OSError):
        data = {"epoch": 0, "total_epochs": 0, "loss": 0}
    return APIResponse(data=data)


@router.get("/jobs/{job_id}/progress/stream")
async def stream_progress(job_id: str):
    """SSE endpoint: pushes training progress in real time."""
    import asyncio
    import json
    from pathlib import Path

    from starlette.responses import StreamingResponse

    from ...core.config import settings

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
                    if data.get("epoch", 0) >= data.get("total_epochs", 0) and data["total_epochs"] > 0:
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
    page: int = 1,
    page_size: int = 20,
) -> APIResponse:
    q = db.query(TrainingJob)
    total = q.count()
    items = (
        q.order_by(TrainingJob.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return APIResponse(data=TrainingJobListOut(
        total=total,
        items=[TrainingJobOut.model_validate(j) for j in items],
    ).model_dump())


@router.get("/jobs/{job_id}")
def get_job(
    job_id: str,
    db: Session = Depends(get_db),
) -> APIResponse:
    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, f"Training job {job_id} not found")
    return APIResponse(data=TrainingJobOut.model_validate(job).model_dump())


@router.post("/jobs/{job_id}/delete", status_code=204)
def delete_job(
    job_id: str,
    db: Session = Depends(get_db),
) -> None:
    from pathlib import Path

    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job:
        raise HTTPException(404, f"Training job {job_id} not found")
    if job.model_path:
        Path(job.model_path).unlink(missing_ok=True)
    db.delete(job)
    db.commit()


@router.get("/jobs/{job_id}/download")
def download_model(
    job_id: str,
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


@router.post("/jobs/{job_id}/predict")
async def predict_with_model(
    job_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    conf: float = Form(0.25),
    iou: float = Form(0.45),
):
    """Run inference with a trained YOLO model on an uploaded image."""
    import io
    import json
    import tempfile
    from pathlib import Path

    from PIL import Image

    from ...core.config import settings
    from ...services.trainer import predict_trained_model

    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if not job or not job.model_path:
        raise HTTPException(404, "Trained model not found")
    if job.status != "completed":
        raise HTTPException(400, "Training not completed yet")
    if not Path(job.model_path).exists():
        raise HTTPException(404, "Model file not found on disk")

    img_bytes = await file.read()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        Image.open(io.BytesIO(img_bytes)).save(tmp.name)

    try:
        result = predict_trained_model(job.model_path, tmp.name, device=settings.device, conf=conf, iou=iou)
    except Exception as exc:
        raise HTTPException(500, f"Inference failed: {exc}") from exc
    finally:
        Path(tmp.name).unlink(missing_ok=True)

    class_map = {}
    if job.metrics:
        try:
            class_map = json.loads(job.metrics).get("class_map", {})
        except json.JSONDecodeError:
            pass

    return APIResponse(data={**result, "model_variant": job.model_variant, "class_map": class_map})


