from __future__ import annotations

from app.services.trainer import _metrics_dict
from app.services.yolo_format import detection_to_yolo


class DummyBox:
    def __init__(self, x1, y1, x2, y2, class_name):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.class_name = class_name


class DummyDetection:
    def __init__(self, boxes, image_width, image_height, filter_mode=None, filter_nms_iou=None):
        self.boxes = boxes
        self.image_width = image_width
        self.image_height = image_height
        self.filter_mode = filter_mode
        self.filter_nms_iou = filter_nms_iou


def test_metrics_dict_none():
    assert _metrics_dict(None) == {}


def test_metrics_dict_raw_dict():
    raw = {"map50": 0.95, "map50-95": 0.75}
    assert _metrics_dict(raw) == raw


def test_metrics_dict_results_dict():
    class MockMetrics:
        results_dict = {"map50": 0.88}

    assert _metrics_dict(MockMetrics()) == {"map50": 0.88}


def test_metrics_dict_keys_and_mean():
    class MockMetrics:
        keys = ["map50", "map50-95"]
        def mean_results(self):
            return [0.90, 0.70]

    assert _metrics_dict(MockMetrics()) == {"map50": 0.90, "map50-95": 0.70}


def test_detection_to_yolo_single_box():
    boxes = [DummyBox(100, 200, 300, 400, "cat")]
    det = DummyDetection(boxes, 1000, 1000)
    class_map = {"cat": 0}

    yolo_str = detection_to_yolo(det, class_map)
    # x_center = (100 + 300) / 2 / 1000 = 0.2
    # y_center = (200 + 400) / 2 / 1000 = 0.3
    # w = (300 - 100) / 1000 = 0.2
    # h = (400 - 200) / 1000 = 0.2
    assert yolo_str == "0 0.200000 0.300000 0.200000 0.200000"


def test_detection_to_yolo_multiple_boxes():
    boxes = [
        DummyBox(100, 200, 300, 400, "cat"),
        DummyBox(500, 500, 700, 900, "dog"),
    ]
    det = DummyDetection(boxes, 1000, 1000)
    class_map = {"cat": 0, "dog": 1}

    yolo_str = detection_to_yolo(det, class_map)
    lines = yolo_str.split("\n")
    assert len(lines) == 2
    assert lines[0] == "0 0.200000 0.300000 0.200000 0.200000"
    assert lines[1] == "1 0.600000 0.700000 0.200000 0.400000"
