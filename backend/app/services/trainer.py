"""YOLO training service.

Takes a set of detection records → assembles YOLO dataset → trains → exports model.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

from . import yolo_format
from ..core.config import settings
if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from ..models.detection import Detection

logger = logging.getLogger(__name__)

YOLO_SERIES = {
    "yolo26": {
        "label": "YOLOv26 (2026, latest)",
        "variants": {
            "yolo26n": "Nano (fastest)",
            "yolo26s": "Small",
            "yolo26m": "Medium",
            "yolo26l": "Large",
            "yolo26x": "XLarge (most accurate)",
        },
    },
    "yolo11": {
        "label": "YOLOv11 (2024, stable)",
        "variants": {
            "yolo11n": "Nano",
            "yolo11s": "Small",
            "yolo11m": "Medium",
            "yolo11l": "Large",
            "yolo11x": "XLarge",
        },
    },
    "yolov8": {
        "label": "YOLOv8 (2023, classic)",
        "variants": {
            "yolov8n": "Nano",
            "yolov8s": "Small",
            "yolov8m": "Medium",
            "yolov8l": "Large",
            "yolov8x": "XLarge",
        },
    },
    "yolov5": {
        "label": "YOLOv5 (legacy)",
        "variants": {
            "yolov5n": "Nano",
            "yolov5s": "Small",
            "yolov5m": "Medium",
            "yolov5l": "Large",
            "yolov5x": "XLarge",
        },
    },
}


def _build_dataset(
    detection_ids: list[str],
    db: "Session",
    work_dir: Path,
    train_ratio: float = 0.8,
    val_ratio: float = 0.2,
) -> tuple[int, dict[str, int], int, int, int]:
    """Copy images + write YOLO labels into train/val(/test) split.

    test = 1 - train_ratio - val_ratio. When test=0, only train/val are created.
    Returns (total_samples, class_map, train_count, val_count, test_count).
    """
    import random

    from ..models.detection import Detection
    from .yolo_format import _get_filtered_boxes

    random.seed(42)

    test_ratio = max(0, 1.0 - train_ratio - val_ratio)
    has_test = test_ratio > 0

    subsets = ["images/train", "images/val", "labels/train", "labels/val"]
    if has_test:
        subsets += ["images/test", "labels/test"]
    for sub in subsets:
        (work_dir / sub).mkdir(parents=True, exist_ok=True)

    class_map: dict[str, int] = {}
    detections: list["Detection"] = []

    for det_id in detection_ids:
        det = db.query(Detection).filter(Detection.id == det_id).first()
        if not det or det.status != "completed":
            continue
        src = Path(det.image_path)
        if not src.exists():
            continue
        for box in _get_filtered_boxes(det):
            if box["class_name"] not in class_map:
                class_map[box["class_name"]] = len(class_map)
        detections.append(det)

    if not detections:
        return 0, class_map, 0, 0, 0

    random.shuffle(detections)
    n = len(detections)
    train_end = max(1, int(n * train_ratio))
    val_end = max(train_end + 1, int(n * (train_ratio + val_ratio))) if has_test else n
    train_dets = detections[:train_end]
    val_dets = detections[train_end:val_end]
    test_dets = detections[val_end:] if has_test else []

    def _write_set(dets: list["Detection"], subset: str) -> int:
        for det in dets:
            src = Path(det.image_path)
            dst_img = work_dir / "images" / subset / f"{det.id}{src.suffix}"
            shutil.copy2(src, dst_img)
            dst_lbl = work_dir / "labels" / subset / f"{det.id}.txt"
            dst_lbl.write_text(yolo_format.detection_to_yolo(det, class_map))
        return len(dets)

    train_n = _write_set(train_dets, "train")
    val_n = _write_set(val_dets, "val")
    test_n = _write_set(test_dets, "test") if has_test else 0
    return train_n + val_n + test_n, class_map, train_n, val_n, test_n


def _metrics_dict(metrics_obj: object | None) -> dict[str, float]:
    """Return Ultralytics metrics without touching removed DetMetrics.results."""
    if metrics_obj is None:
        return {}

    results_dict = getattr(metrics_obj, "results_dict", None)
    if isinstance(results_dict, dict):
        return results_dict

    if isinstance(metrics_obj, dict):
        return metrics_obj

    mean_results = getattr(metrics_obj, "mean_results", None)
    keys = getattr(metrics_obj, "keys", None)
    if callable(mean_results) and isinstance(keys, list):
        try:
            return dict(zip(keys, mean_results(), strict=False))
        except (TypeError, ValueError):
            return {}

    return {}


def _training_metrics(metrics_obj: object | None, sample_count: int, class_map: dict[str, int]) -> dict:
    rd = _metrics_dict(metrics_obj)
    return {
        "mAP50": float(rd.get("metrics/mAP50(B)", 0)),
        "mAP50-95": float(rd.get("metrics/mAP50-95(B)", 0)),
        "precision": float(rd.get("metrics/precision(B)", 0)),
        "recall": float(rd.get("metrics/recall(B)", 0)),
        "num_samples": sample_count,
        "num_classes": len(class_map),
        "class_map": {v: k for k, v in class_map.items()},
    }


def _write_data_yaml(work_dir: Path, class_map: dict[str, int]) -> Path:
    """Write a YOLO data.yaml."""
    names = {v: k for k, v in sorted(class_map.items(), key=lambda x: x[1])}
    yaml_path = work_dir / "data.yaml"
    yaml_path.write_text(
        f"path: {work_dir}\n"
        f"train: images/train\n"
        f"val: images/val\n"
        f"nc: {len(names)}\n"
        f"names: {json.dumps(names)}\n"
    )
    return yaml_path


def run_training(
    *,
    job_id: str,
    detection_ids: list[str],
    db: "Session",
    model_variant: str = "yolo26n",
    epochs: int = 100,
    imgsz: int = 640,
    batch: int = 16,
    train_ratio: float = 0.8,
    val_ratio: float = 0.2,
) -> str:
    """Run YOLO training synchronously. Returns the path to the trained model.

    Call this inside a background thread or task queue.
    """
    from ultralytics import YOLO

    work_dir = settings.project_root / "training_runs" / job_id
    work_dir.mkdir(parents=True, exist_ok=True)
    models_dir = settings.project_root / "trained_models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build dataset with train/val(/test) split
    sample_count, class_map, train_n, val_n, test_n = _build_dataset(
        detection_ids, db, work_dir, train_ratio, val_ratio,
    )
    if sample_count == 0:
        raise ValueError("No valid training samples found")
    if len(class_map) == 0:
        raise ValueError("No classes found in training data")

    _write_data_yaml(work_dir, class_map)
    parts = [f"{train_n} train / {val_n} val"]
    if test_n > 0:
        parts.append(f"{test_n} test")
    logger.info(
        "Training dataset built: %d samples (%s), %d classes → %s",
        sample_count, " / ".join(parts), len(class_map), work_dir,
    )

    # 2. Train — with progress tracking
    progress_file = work_dir / "progress.json"

    def on_fit_epoch_end(trainer):
        """Callback: write progress after each epoch."""
        data = {
            "epoch": trainer.epoch + 1,
            "totalEpochs": trainer.epochs,
            "loss": float(trainer.loss_items.mean()) if hasattr(trainer, "loss_items") else 0,
        }
        trainer_metrics = getattr(trainer, "metrics", None)
        if trainer_metrics:
            rd = _metrics_dict(trainer_metrics)
            data["mAP50"] = float(rd.get("metrics/mAP50(B)", 0))
            data["mAP50_95"] = float(rd.get("metrics/mAP50-95(B)", 0))
        progress_file.write_text(json.dumps(data))

    pretrained_dir = settings.project_root / "pretrained"
    pretrained_dir.mkdir(exist_ok=True)
    model = YOLO(str(pretrained_dir / f"{model_variant}.pt"))
    model.add_callback("on_fit_epoch_end", on_fit_epoch_end)

    # Write initial progress
    progress_file.write_text(json.dumps({"epoch": 0, "totalEpochs": epochs, "loss": 0}))

    results = model.train(
        data=str(work_dir / "data.yaml"),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=settings.resolved_device,
        verbose=False,
    )

    # 3. Save trained model
    output_path = models_dir / f"{job_id}.pt"
    shutil.copy2(Path(results.save_dir) / "weights" / "best.pt", output_path)

    # 4. Collect metrics
    metrics = _training_metrics(results, sample_count, class_map)

    # 5. Update DB
    from ..models.train import TrainingJob

    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if job:
        job.status = "completed"
        job.metrics = metrics
        job.class_map = class_map
        job.model_path = str(output_path)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    logger.info("Training completed: %s → %s", job_id, output_path)
    return str(output_path)


def predict_trained_model(
    model_path: str,
    image_path: str,
    *,
    device: str = "cpu",
    conf: float = 0.25,
    iou: float = 0.45,
) -> dict:
    """Run inference with a trained YOLO model.

    Returns: {"image_width", "image_height", "boxes": [{"class_name","confidence","x1","y1","x2","y2"}]}
    """
    from ultralytics import YOLO

    model = YOLO(model_path)
    results = model.predict(image_path, device=device, imgsz=640, conf=conf, iou=iou, verbose=False)

    boxes_out: list[dict] = []
    if results and results[0].boxes is not None:
        r = results[0]
        for i in range(len(r.boxes)):
            x1, y1, x2, y2 = r.boxes.xyxy[i].tolist()
            conf_val = float(r.boxes.conf[i])
            cls_id = int(r.boxes.cls[i])
            cls_name = r.names.get(cls_id, str(cls_id)) if r.names else str(cls_id)
            boxes_out.append({
                "class_name": cls_name,
                "confidence": round(conf_val, 4),
                "x1": int(x1), "y1": int(y1),
                "x2": int(x2), "y2": int(y2),
            })

    w, h = 0, 0
    if results:
        shape = results[0].orig_shape
        h, w = shape if shape else (0, 0)

    return {"image_width": w, "image_height": h, "boxes": boxes_out}


def run_training_safe(
    job_id: str,
    detection_ids: list[str],
    model_variant: str,
    epochs: int,
    imgsz: int,
    batch: int,
    train_ratio: float = 0.8,
    val_ratio: float = 0.2,
) -> None:
    """Run training in background, updating DB status on completion/failure."""
    from ...core.database import SessionLocal
    from ..models.train import TrainingJob

    db = SessionLocal()
    try:
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "running"
            db.commit()

        run_training(
            job_id=job_id,
            detection_ids=detection_ids,
            db=db,
            model_variant=model_variant,
            epochs=epochs,
            imgsz=imgsz,
            batch=batch,
            train_ratio=train_ratio,
            val_ratio=val_ratio,
        )
    except Exception as exc:
        logger.exception("Training job %s failed", job_id)
        job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()
