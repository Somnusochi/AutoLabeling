"""Training job queue — runs jobs sequentially in a background process."""

from __future__ import annotations

import contextlib
import logging
import multiprocessing
import threading

from ..core.database import SessionLocal
from ..models.train import TrainingJob

logger = logging.getLogger(__name__)

# CUDA cannot be re-initialized after fork(). Use 'spawn' to start a fresh
# process that imports CUDA from scratch. Must be set before any Process() call.
_multiprocessing_initialized = False


def _ensure_spawn_method():
    global _multiprocessing_initialized
    if not _multiprocessing_initialized:
        with contextlib.suppress(RuntimeError):
            multiprocessing.set_start_method("spawn", force=True)
        _multiprocessing_initialized = True

_queue_lock = threading.Lock()
_worker_thread: threading.Thread | None = None
_running_process: multiprocessing.Process | None = None
_running_job_id: str | None = None


def _run_training_in_subprocess(
    job_id: str,
    detection_ids: list[str],
    model_variant: str,
    epochs: int,
    imgsz: int,
    batch: int,
    train_ratio: float,
    val_ratio: float,
    task_type: str,
) -> None:
    """Entry point for the training subprocess."""
    from .trainer import run_training_safe

    run_training_safe(
        job_id,
        detection_ids,
        model_variant,
        epochs,
        imgsz,
        batch,
        train_ratio,
        val_ratio,
        task_type,
    )


def _worker_loop() -> None:
    """Background worker: picks up pending jobs and runs them one at a time."""
    global _running_process, _running_job_id

    while True:
        with _queue_lock:
            db = SessionLocal()
            try:
                job = (
                    db.query(TrainingJob)
                    .filter(TrainingJob.status == "pending")
                    .order_by(TrainingJob.created_at.asc())
                    .first()
                )

                if job is None:
                    # No more pending jobs — exit worker
                    _running_job_id = None
                    return

                job.status = "running"
                db.commit()

                job_id = str(job.id)
                detection_ids = job.detection_ids
                model_variant = job.model_variant
                epochs = job.epochs
                imgsz = job.imgsz
                batch = job.batch
                train_ratio = job.train_ratio
                val_ratio = job.val_ratio
                task_type = job.task_type

                _running_job_id = job_id
            finally:
                db.close()

        logger.info("Starting training job %s (%s, %d epochs)", job_id, model_variant, epochs)

        _ensure_spawn_method()
        proc = multiprocessing.Process(
            target=_run_training_in_subprocess,
            args=(
                job_id,
                detection_ids,
                model_variant,
                epochs,
                imgsz,
                batch,
                train_ratio,
                val_ratio,
                task_type,
            ),
            name=f"train-{job_id[:8]}",
            daemon=True,
        )
        _running_process = proc
        proc.start()
        proc.join()

        with _queue_lock:
            _running_process = None
            _running_job_id = None

        # If process was terminated (cancelled), update status
        if proc.exitcode != 0:
            db = SessionLocal()
            try:
                job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
                if job and job.status == "running":
                    job.status = "cancelled"
                    db.commit()
            finally:
                db.close()


def _ensure_worker() -> None:
    """Start the queue worker if not already running."""
    global _worker_thread
    with _queue_lock:
        if _worker_thread is not None and _worker_thread.is_alive():
            return
        _worker_thread = threading.Thread(target=_worker_loop, name="training-queue", daemon=True)
        _worker_thread.start()
        logger.info("Training queue worker started")


def enqueue_job() -> None:
    """Notify the queue that a new job is pending. Starts worker if needed."""
    _ensure_worker()


def cancel_job(job_id: str) -> bool:
    """Cancel a pending or running training job. Returns True if cancelled."""
    global _running_process, _running_job_id

    with _queue_lock:
        if _running_job_id == job_id and _running_process is not None:
            proc = _running_process
        else:
            proc = None

    if proc is not None:
        # Kill the running training process
        logger.info("Cancelling running training job %s (pid=%d)", job_id, proc.pid)
        proc.terminate()
        # Give it a moment to clean up, then force kill
        proc.join(timeout=5)
        if proc.is_alive():
            logger.warning("Training process %d did not terminate, force killing", proc.pid)
            proc.kill()
            proc.join(timeout=2)

        # Update DB status
        db = SessionLocal()
        try:
            job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
            if job and job.status in ("pending", "running"):
                job.status = "cancelled"
                db.commit()
        finally:
            db.close()

        # After cancellation, trigger worker to pick up next job
        _ensure_worker()
        return True

    # Check if it's a pending job
    db = SessionLocal()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job and job.status == "pending":
            job.status = "cancelled"
            db.commit()
            return True
        return False
    finally:
        db.close()


def get_active_job_id() -> str | None:
    """Return the currently running job ID, or None."""
    return _running_job_id


def is_job_running(job_id: str) -> bool:
    return _running_job_id == job_id
