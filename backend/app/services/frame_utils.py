"""Frame-level YOLO inference and annotation drawing.

Shared by MJPEG streaming and SSE video prediction endpoints.
"""
from __future__ import annotations

import io

import cv2
import numpy as np
from PIL import Image

from .trainer import predict_trained_model


def draw_frame(
    model_path: str,
    jpg: bytes,
    device: str,
    conf: float,
    iou: float,
    frame_num: int,
    fps: float,
) -> bytes | None:
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


def predict_frame(model_path: str, jpg_data: bytes, device: str, conf: float, iou: float) -> dict:
    """Run YOLO on a single JPEG frame. Called in thread pool."""
    img = Image.open(io.BytesIO(jpg_data))
    return predict_trained_model(model_path, img, device=device, conf=conf, iou=iou)
