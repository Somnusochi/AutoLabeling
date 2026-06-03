"""Tests for _build_dataset train/val/test split logic."""

from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from app.services.trainer import _build_dataset


class FakeBox:
    def __init__(self, x1, y1, x2, y2, class_name):
        self.x1 = x1
        self.y1 = y1
        self.x2 = x2
        self.y2 = y2
        self.class_name = class_name


class FakeDetection:
    def __init__(
        self,
        image_path: Path,
        boxes: list[FakeBox],
        det_id=None,
        filter_mode=None,
        filter_nms_iou=None,
    ):
        self.id = det_id or uuid.uuid4()
        self.image_path = str(image_path)
        self.image_width = 100
        self.image_height = 100
        self.boxes = boxes
        self.status = "completed"
        self.filter_mode = filter_mode
        self.filter_nms_iou = filter_nms_iou


def _make_detections(tmp_path: Path, n: int, class_name: str = "obj") -> tuple[list[str], dict]:
    """Create n fake detections with real image files on disk."""
    from PIL import Image

    det_map = {}
    ids = []
    for i in range(n):
        img_path = tmp_path / f"img_{i}.jpg"
        Image.new("RGB", (100, 100), (i * 20 % 256, 0, 0)).save(img_path)
        det_id = uuid.uuid4()
        det = FakeDetection(
            image_path=img_path,
            boxes=[FakeBox(10, 10, 50, 50, class_name)],
            det_id=det_id,
        )
        det_map[str(det_id)] = det
        ids.append(str(det_id))
    return ids, det_map


def _make_mock_db(ids: list[str], det_map: dict) -> MagicMock:
    """Build a mock DB that returns detections in order via the query chain."""
    db = MagicMock()
    call_count = [0]
    det_list = [det_map[did] for did in ids]

    def query_side_effect(model):
        mock_q = MagicMock()

        def filter_side_effect(condition):
            mock_f = MagicMock()
            idx = call_count[0]
            mock_f.first.return_value = det_list[idx] if idx < len(det_list) else None
            call_count[0] += 1
            return mock_f

        mock_q.filter = filter_side_effect
        return mock_q

    db.query = query_side_effect
    return db


@pytest.fixture
def work_dir(tmp_path):
    d = tmp_path / "work"
    d.mkdir()
    return d


def test_build_dataset_no_detections(tmp_path, work_dir):
    """Empty input returns zeros."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    total, class_map, train_n, val_n, test_n = _build_dataset(["nonexistent"], db, work_dir)
    assert total == 0
    assert train_n == 0 and val_n == 0 and test_n == 0


def test_build_dataset_single_sample(tmp_path, work_dir):
    """Single sample: goes to train, val gets at least the rest."""
    ids, det_map = _make_detections(tmp_path, 1)
    db = _make_mock_db(ids, det_map)

    total, class_map, train_n, val_n, test_n = _build_dataset(ids, db, work_dir)
    assert total == 1
    assert train_n + val_n == 1
    assert (work_dir / "images" / "train").exists()
    assert (work_dir / "images" / "val").exists()


def test_build_dataset_split_ratio(tmp_path, work_dir):
    """10 samples with 0.7/0.2/0.1 split → train + val + test = 10."""
    ids, det_map = _make_detections(tmp_path, 10)
    db = _make_mock_db(ids, det_map)

    total, class_map, train_n, val_n, test_n = _build_dataset(
        ids, db, work_dir, train_ratio=0.7, val_ratio=0.2
    )
    assert total == 10
    assert train_n >= 5
    assert val_n >= 1
    assert test_n >= 1
    assert train_n + val_n + test_n == 10
    assert (work_dir / "images" / "test").exists()


def test_build_dataset_no_test_split(tmp_path, work_dir):
    """0.8/0.2 split → no test directory created."""
    ids, det_map = _make_detections(tmp_path, 5)
    db = _make_mock_db(ids, det_map)

    total, class_map, train_n, val_n, test_n = _build_dataset(
        ids, db, work_dir, train_ratio=0.8, val_ratio=0.2
    )
    assert total == 5
    assert test_n == 0
    assert not (work_dir / "images" / "test").exists()
    assert train_n + val_n == 5


def test_build_dataset_class_map(tmp_path, work_dir):
    """Multiple classes get unique integer IDs."""
    from PIL import Image

    ids = []
    det_map = {}
    for _i, cls in enumerate(["cat", "dog", "bird"]):
        img_path = tmp_path / f"img_{cls}.jpg"
        Image.new("RGB", (100, 100)).save(img_path)
        det_id = uuid.uuid4()
        det = FakeDetection(img_path, [FakeBox(10, 10, 50, 50, cls)], det_id)
        det_map[str(det_id)] = det
        ids.append(str(det_id))

    db = _make_mock_db(ids, det_map)
    total, class_map, _, _, _ = _build_dataset(ids, db, work_dir, train_ratio=0.8, val_ratio=0.2)
    assert set(class_map.keys()) == {"cat", "dog", "bird"}
    assert set(class_map.values()) == {0, 1, 2}


def test_build_dataset_two_samples(tmp_path, work_dir):
    """Two samples: at least 1 train and 1 val."""
    ids, det_map = _make_detections(tmp_path, 2)
    db = _make_mock_db(ids, det_map)

    total, class_map, train_n, val_n, test_n = _build_dataset(
        ids, db, work_dir, train_ratio=0.8, val_ratio=0.2
    )
    assert total == 2
    assert train_n >= 1
    assert val_n >= 1
