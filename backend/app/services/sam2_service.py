"""SAM2 segmentation service — bbox → mask via Segment Anything Model 2."""

from __future__ import annotations

import logging
import threading
import time

import numpy as np
import torch
from PIL import Image

from ..core.config import settings

logger = logging.getLogger(__name__)

_sam_worker: SegmentAnythingWorker | None = None
_last_activity: float = 0.0
_watchdog_thread: threading.Thread | None = None
_watchdog_stop: threading.Event | None = None
_lock: threading.Lock = threading.Lock()


class SegmentAnythingWorker:
    def __init__(self, model_id: str = "facebook/sam2.1-hiera-base-plus", device: str | None = None):
        from sam2.build_sam import build_sam2_hf
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        self.device = device or settings.resolved_device
        logger.info("Loading SAM2 (%s) to %s...", model_id, self.device)

        sam2_model = build_sam2_hf(model_id, device="cpu")
        if self.device != "cpu":
            sam2_model = sam2_model.to(self.device)
        sam2_model.eval()
        self.predictor = SAM2ImagePredictor(sam2_model)

        logger.info("SAM2 ready on %s", self.device)

    @torch.no_grad()
    def segment(self, image: Image.Image, boxes: list[dict]) -> list[list[list[float]]]:
        """Generate polygon masks for each bounding box.

        Returns:
            List of polygons, one per box. [[x,y], [x,y], ...] or [].
        """
        np_image = np.array(image.convert("RGB"))
        self.predictor.set_image(np_image)

        polygons: list[list[list[float]]] = []
        for box in boxes:
            bbox = np.array([box["x1"], box["y1"], box["x2"], box["y2"]])
            masks, scores, _ = self.predictor.predict(
                point_coords=None, point_labels=None,
                box=bbox[None, :], multimask_output=False,
            )
            if masks is None or masks.shape[0] == 0:
                polygons.append([])
                continue
            mask = masks[0].astype(np.uint8)
            mask = _clean_mask(mask)
            contours = _find_contours(mask)
            if contours:
                largest = max(contours, key=lambda c: _contour_area(c))
                if len(largest) >= 3:
                    poly = largest.squeeze(1).tolist()
                    polygons.append([[float(p[0]), float(p[1])] for p in poly])
                    continue
            polygons.append([])

        return polygons


def _clean_mask(mask: np.ndarray) -> np.ndarray:
    try:
        import cv2
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        return cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    except ImportError:
        return mask


def _contour_area(contour: np.ndarray) -> float:
    try:
        import cv2
        return cv2.contourArea(contour)
    except ImportError:
        return len(contour)


def _find_contours(mask: np.ndarray):
    try:
        import cv2
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return contours
    except ImportError:
        return []


# ── Module-level singleton ────────────────────────────


def _watchdog_loop():
    while _watchdog_stop is not None and not _watchdog_stop.is_set():
        _watchdog_stop.wait(timeout=30)
        if _watchdog_stop is None or _watchdog_stop.is_set():
            break
        with _lock:
            idle = time.monotonic() - _last_activity
        if idle >= settings.model_idle_timeout_seconds:
            logger.info("SAM unloaded after %.0fs idle", idle)
            unload_sam()
            break


def _start_watchdog():
    global _watchdog_thread, _watchdog_stop
    if _watchdog_thread is not None and _watchdog_thread.is_alive():
        return
    _watchdog_stop = threading.Event()
    _watchdog_thread = threading.Thread(target=_watchdog_loop, daemon=True, name="sam-idle-watchdog")
    _watchdog_thread.start()


def _stop_watchdog():
    global _watchdog_thread, _watchdog_stop
    if _watchdog_stop is not None:
        _watchdog_stop.set()
    _watchdog_thread = None
    _watchdog_stop = None


def _bump_activity():
    global _last_activity
    with _lock:
        _last_activity = time.monotonic()


def _get_sam_worker() -> SegmentAnythingWorker:
    global _sam_worker
    if _sam_worker is None:
        _sam_worker = SegmentAnythingWorker()
        _bump_activity()
        _start_watchdog()
    return _sam_worker


def segment_image(image: Image.Image, boxes: list[dict]) -> list[list[list[float]]]:
    worker = _get_sam_worker()
    _bump_activity()
    return worker.segment(image, boxes)


def is_sam_loaded() -> bool:
    return _sam_worker is not None


def unload_sam() -> None:
    global _sam_worker
    _stop_watchdog()
    if _sam_worker is not None:
        del _sam_worker.model
        del _sam_worker.processor
        _sam_worker = None
    import gc
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
    elif torch.backends.mps.is_available():
        torch.mps.empty_cache()
    logger.info("SAM unloaded")
