from __future__ import annotations

from app.services.box_filter import nms, best_per_class, apply_filter


def _box(x1: int, y1: int, x2: int, y2: int, class_name: str = "obj") -> dict:
    return {"x1": x1, "y1": y1, "x2": x2, "y2": y2, "class_name": class_name}


# ── NMS ───────────────────────────────────────────────

def test_nms_no_overlap():
    boxes = [_box(0, 0, 10, 10), _box(20, 20, 30, 30)]
    assert len(nms(boxes, 0.5)) == 2


def test_nms_full_overlap():
    boxes = [_box(0, 0, 10, 10), _box(0, 0, 10, 10)]
    kept = nms(boxes, 0.5)
    assert len(kept) == 1


def test_nms_partial_overlap_below_threshold():
    # Two boxes with ~25% overlap, threshold 0.5 → both kept
    boxes = [_box(0, 0, 10, 10), _box(5, 0, 15, 10)]
    assert len(nms(boxes, 0.5)) == 2


def test_nms_partial_overlap_above_threshold():
    # Two boxes with ~50% overlap, threshold 0.3 → second suppressed
    boxes = [_box(0, 0, 10, 10), _box(3, 0, 13, 10)]
    kept = nms(boxes, 0.3)
    assert len(kept) == 1


def test_nms_empty():
    assert nms([], 0.5) == []


# ── best_per_class ────────────────────────────────────

def test_best_per_class_keeps_first_of_each():
    boxes = [
        _box(0, 0, 10, 10, "cat"),
        _box(20, 20, 30, 30, "dog"),
        _box(40, 40, 50, 50, "cat"),
    ]
    kept = best_per_class(boxes)
    assert len(kept) == 2
    assert kept[0]["class_name"] == "cat"
    assert kept[0]["x1"] == 0  # first cat kept
    assert kept[1]["class_name"] == "dog"


def test_best_per_class_single_class():
    boxes = [_box(0, 0, 10, 10, "cat"), _box(20, 20, 30, 30, "cat")]
    assert len(best_per_class(boxes)) == 1


def test_best_per_class_all_different():
    boxes = [_box(0, 0, 10, 10, "a"), _box(0, 0, 10, 10, "b"), _box(0, 0, 10, 10, "c")]
    assert len(best_per_class(boxes)) == 3


# ── apply_filter ──────────────────────────────────────

def test_apply_filter_none_mode():
    boxes = [_box(0, 0, 10, 10), _box(0, 0, 10, 10)]
    assert len(apply_filter(boxes, None)) == 2
    assert len(apply_filter(boxes, "all")) == 2


def test_apply_filter_best_mode():
    boxes = [_box(0, 0, 10, 10, "cat"), _box(20, 20, 30, 30, "cat")]
    assert len(apply_filter(boxes, "best")) == 1


def test_apply_filter_nms_mode():
    boxes = [_box(0, 0, 10, 10), _box(0, 0, 10, 10)]
    assert len(apply_filter(boxes, "nms", nms_iou=0.5)) == 1


def test_apply_filter_empty():
    assert apply_filter([], "best") == []
    assert apply_filter([], "nms", 0.5) == []
