from __future__ import annotations

from app.services.locate_anything import parse_boxes


def test_parse_boxes_single():
    raw = "<ref>cat</ref><box><100><200><300><400></box>"
    boxes = parse_boxes(raw, 1000, 1000)
    assert len(boxes) == 1
    assert boxes[0] == {
        "class_name": "cat",
        "x1": 100,
        "y1": 200,
        "x2": 300,
        "y2": 400,
        "confidence": None,
    }


def test_parse_boxes_multiple_boxes_same_ref():
    raw = "<ref>dog</ref><box><100><200><300><400></box><box><500><600><700><800></box>"
    boxes = parse_boxes(raw, 1000, 1000)
    assert len(boxes) == 2
    assert boxes[0] == {
        "class_name": "dog",
        "x1": 100,
        "y1": 200,
        "x2": 300,
        "y2": 400,
        "confidence": None,
    }
    assert boxes[1] == {
        "class_name": "dog",
        "x1": 500,
        "y1": 600,
        "x2": 700,
        "y2": 800,
        "confidence": None,
    }


def test_parse_boxes_switched_refs():
    raw = (
        "<ref>cat</ref><box><100><200><300><400></box>"
        "<ref>bird</ref><box><500><600><700><800></box>"
    )
    boxes = parse_boxes(raw, 1000, 1000)
    assert len(boxes) == 2
    assert boxes[0]["class_name"] == "cat"
    assert boxes[1]["class_name"] == "bird"


def test_parse_boxes_empty_or_invalid():
    assert parse_boxes("", 1000, 1000) == []
    assert parse_boxes("some random text without tags", 1000, 1000) == []
    assert parse_boxes("<ref>empty box</ref>", 1000, 1000) == []
    assert parse_boxes("<box><1><2><3><4></box>", 1000, 1000) == []
