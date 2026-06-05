"""Detection strategy pattern — VLM, VLM+SAM2, or SAM3."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod

from PIL import Image

logger = logging.getLogger(__name__)


class DetectionResult:
    """Uniform output regardless of which model produced it."""

    def __init__(
        self,
        boxes: list[dict],
        img_w: int,
        img_h: int,
        raw_text: str = "",
        polygons: list | None = None,
    ):
        self.boxes = boxes
        self.img_w = img_w
        self.img_h = img_h
        self.raw_text = raw_text
        self.polygons = polygons or []


class DetectionStrategy(ABC):
    @abstractmethod
    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        """Return unified DetectionResult."""


class VLMDetection(DetectionStrategy):
    """LocateAnything-3B only, no segmentation."""

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        from .locate_anything import detect as vlm_detect

        result = vlm_detect(filepath, categories)
        boxes = result["boxes"]
        detect_w, detect_h = result["img_w"], result["img_h"]
        orig_w = result.get("orig_w", detect_w)
        orig_h = result.get("orig_h", detect_h)

        # Scale boxes from detection space back to original image space
        scale_x = orig_w / detect_w if detect_w != orig_w else 1.0
        scale_y = orig_h / detect_h if detect_h != orig_h else 1.0
        if scale_x != 1.0 or scale_y != 1.0:
            boxes = [
                {
                    **b,
                    "x1": int(b["x1"] * scale_x),
                    "y1": int(b["y1"] * scale_y),
                    "x2": int(b["x2"] * scale_x),
                    "y2": int(b["y2"] * scale_y),
                }
                for b in boxes
            ]

        return DetectionResult(
            boxes=boxes,
            img_w=orig_w,
            img_h=orig_h,
            raw_text=result.get("raw_text", ""),
        )


class VLMWithSAM2(DetectionStrategy):
    """VLM detection + SAM2 mask refinement."""

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        from .locate_anything import detect as vlm_detect
        from .sam2_service import segment_image

        score_threshold = kwargs.get("sam2_score_threshold", 0.0)

        result = vlm_detect(filepath, categories)
        boxes = result["boxes"]
        detect_w, detect_h = result["img_w"], result["img_h"]
        orig_w = result.get("orig_w", detect_w)
        orig_h = result.get("orig_h", detect_h)

        # Scale boxes from detection space back to original image space
        scale_x = orig_w / detect_w if detect_w != orig_w else 1.0
        scale_y = orig_h / detect_h if detect_h != orig_h else 1.0
        if scale_x != 1.0 or scale_y != 1.0:
            boxes = [
                {
                    **b,
                    "x1": int(b["x1"] * scale_x),
                    "y1": int(b["y1"] * scale_y),
                    "x2": int(b["x2"] * scale_x),
                    "y2": int(b["y2"] * scale_y),
                }
                for b in boxes
            ]

        polygons = []

        if boxes:
            try:
                img = Image.open(filepath).convert("RGB")
                try:
                    polygons = segment_image(img, boxes, score_threshold=score_threshold)
                finally:
                    img.close()
            except Exception:
                logger.exception("SAM2 segmentation failed, falling back to bbox-only")

        return DetectionResult(
            boxes=boxes,
            img_w=orig_w,
            img_h=orig_h,
            raw_text=result.get("raw_text", ""),
            polygons=polygons,
        )


class SAM3Detection(DetectionStrategy):
    """SAM3 via standalone HTTP server — detection + segmentation in one call."""

    def detect(self, filepath: str, categories: list[str], **kwargs) -> DetectionResult:
        from .sam3_client import segment_sam3

        text = " ".join(categories) if categories else ""
        use_seg = kwargs.get("use_sam3_seg", True)
        threshold = kwargs.get("sam3_threshold", 0.5)
        mask_threshold = kwargs.get("sam3_mask_threshold", 0.5)
        sam3_boxes = segment_sam3(
            filepath,
            text,
            segmentation=use_seg,
            threshold=threshold,
            mask_threshold=mask_threshold,
        )

        img = Image.open(filepath)
        w, h = img.size
        img.close()

        polygons = [b.pop("mask_polygon", None) for b in sam3_boxes]

        return DetectionResult(
            boxes=sam3_boxes,
            img_w=w,
            img_h=h,
            polygons=polygons,
        )


def create_strategy(use_sam2: bool = False, use_sam3: bool = False) -> DetectionStrategy:
    if use_sam3:
        return SAM3Detection()
    if use_sam2:
        return VLMWithSAM2()
    return VLMDetection()
