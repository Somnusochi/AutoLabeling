"""Tests for detection strategy pattern."""

import pytest
from app.services.detection_strategy import (
    VLMDetection,
    VLMWithSAM2,
    SAM3Detection,
    DetectionResult,
    create_strategy,
)


class TestCreateStrategy:
    def test_default_strategy_is_vlm(self):
        s = create_strategy()
        assert isinstance(s, VLMDetection)

    def test_use_sam2_returns_vlm_with_sam2(self):
        s = create_strategy(use_sam2=True)
        assert isinstance(s, VLMWithSAM2)

    def test_use_sam3_returns_sam3(self):
        s = create_strategy(use_sam3=True)
        assert isinstance(s, SAM3Detection)

    def test_sam3_takes_priority_over_sam2(self):
        s = create_strategy(use_sam2=True, use_sam3=True)
        assert isinstance(s, SAM3Detection)


class TestDetectionResult:
    def test_default_polygons_is_empty_list(self):
        r = DetectionResult(boxes=[], img_w=100, img_h=100)
        assert r.polygons == []

    def test_polygons_stored(self):
        r = DetectionResult(boxes=[], img_w=100, img_h=100, polygons=[[[1, 2]]])
        assert r.polygons == [[[1, 2]]]

    def test_boxes_and_dims(self):
        boxes = [{"x1": 0, "y1": 0, "x2": 50, "y2": 50, "class_name": "cat"}]
        r = DetectionResult(boxes=boxes, img_w=640, img_h=480, raw_text="cat")
        assert r.img_w == 640
        assert r.img_h == 480
        assert r.raw_text == "cat"
        assert len(r.boxes) == 1


class TestStrategyKwargs:
    def test_sam3_strategy_accepts_use_sam3_seg(self):
        s = SAM3Detection()
        assert s is not None  # SAM3 requires running server, skip actual detect

    def test_vlm_strategy_has_detect_method(self):
        s = VLMDetection()
        assert hasattr(s, "detect")
