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
) -> tuple[int, dict[str, int]]:
    """Copy images + write YOLO labels into a dataset directory.

    Returns (num_samples, class_map).
    """
    from ..models.detection import Detection

    img_dir = work_dir / "images"
    lbl_dir = work_dir / "labels"
    img_dir.mkdir(parents=True)
    lbl_dir.mkdir(parents=True)

    class_map: dict[str, int] = {}
    samples: list[tuple["Detection", Path]] = []
    sample_count = 0

    for det_id in detection_ids:
        det = db.query(Detection).filter(Detection.id == det_id).first()
        if not det or det.status != "completed":
            continue

        # Copy image
        src = Path(det.image_path)
        if not src.exists():
            continue
        dst_img = img_dir / f"{det.id}{src.suffix}"
        shutil.copy2(src, dst_img)

        # Build class map
        for box in det.boxes:
            if box.class_name not in class_map:
                class_map[box.class_name] = len(class_map)

        samples.append((det, lbl_dir / f"{det.id}.txt"))
        sample_count += 1

    for det, dst_lbl in samples:
        dst_lbl.write_text(_detection_to_yolo(det, class_map))

    return sample_count, class_map


def _detection_to_yolo(detection: "Detection", class_map: dict[str, int]) -> str:
    """Convert a detection record to labels using this training run's class map."""
    img_w = detection.image_width or 1
    img_h = detection.image_height or 1
    lines: list[str] = []

    for box in detection.boxes:
        class_id = class_map[box.class_name]
        x_center = ((box.x1 + box.x2) / 2) / img_w
        y_center = ((box.y1 + box.y2) / 2) / img_h
        bw = (box.x2 - box.x1) / img_w
        bh = (box.y2 - box.y1) / img_h
        lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {bw:.6f} {bh:.6f}")

    return "\n".join(lines)


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
        f"train: images\n"
        f"val: images\n"
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
) -> str:
    """Run YOLO training synchronously. Returns the path to the trained model.

    Call this inside a background thread or task queue.
    """
    from ultralytics import YOLO

    work_dir = settings.project_root / "training_runs" / job_id
    work_dir.mkdir(parents=True, exist_ok=True)
    models_dir = settings.project_root / "trained_models"
    models_dir.mkdir(parents=True, exist_ok=True)

    # 1. Build dataset
    sample_count, class_map = _build_dataset(detection_ids, db, work_dir)
    if sample_count == 0:
        raise ValueError("No valid training samples found")
    if len(class_map) == 0:
        raise ValueError("No classes found in training data")

    _write_data_yaml(work_dir, class_map)
    logger.info(
        "Training dataset built: %d samples, %d classes → %s",
        sample_count, len(class_map), work_dir,
    )

    # 2. Train — with progress tracking
    progress_file = work_dir / "progress.json"

    def on_fit_epoch_end(trainer):
        """Callback: write progress after each epoch."""
        data = {
            "epoch": trainer.epoch + 1,
            "total_epochs": trainer.epochs,
            "loss": float(trainer.loss_items.mean()) if hasattr(trainer, "loss_items") else 0,
        }
        # Extract metrics if available
        trainer_metrics = getattr(trainer, "metrics", None)
        if trainer_metrics:
            rd = _metrics_dict(trainer_metrics)
            data["mAP50"] = float(rd.get("metrics/mAP50(B)", 0))
            data["mAP50_95"] = float(rd.get("metrics/mAP50-95(B)", 0))
        progress_file.write_text(json.dumps(data))

    model = YOLO(f"{model_variant}.pt")
    model.add_callback("on_fit_epoch_end", on_fit_epoch_end)

    # Write initial progress
    progress_file.write_text(json.dumps({"epoch": 0, "total_epochs": epochs, "loss": 0}))

    results = model.train(
        data=str(work_dir / "data.yaml"),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=settings.device,
        verbose=False,
    )

    # 3. Save trained model
    output_path = models_dir / f"{job_id}.pt"
    shutil.copy2(Path(results.save_dir) / "weights" / "best.pt", output_path)

    # 4. Collect metrics (handle old and new Ultralytics APIs)
    metrics = _training_metrics(results, sample_count, class_map)

    # 5. Update DB
    from ..models.train import TrainingJob

    job = db.query(TrainingJob).filter(TrainingJob.id == job_id).first()
    if job:
        job.status = "completed"
        job.metrics = json.dumps(metrics)
        job.model_path = str(output_path)
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    logger.info("Training completed: %s → %s", job_id, output_path)
    return str(output_path)
