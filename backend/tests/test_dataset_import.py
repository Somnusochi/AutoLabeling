"""Unit tests for dataset import parsers — no backend needed."""

import io
import json
import os
import tempfile
import zipfile
from pathlib import Path

import pytest
from PIL import Image

from app.services.dataset_import.coco import parse_coco_zip
from app.services.dataset_import.createml import parse_createml_zip
from app.services.dataset_import.helpers import read_image_size, save_image
from app.services.dataset_import.voc import parse_voc_zip
from app.services.dataset_import.yolo import _parse_yolo_line, _read_yolo_names, parse_yolo_zip
from app.services.dataset_import.yolo_seg import _parse_yolo_seg_line


def _make_zip(spec: dict) -> str:
    """Create a temp ZIP file from {filename: content} dict. Returns path."""
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        with zipfile.ZipFile(tmp, "w") as zf:
            for name, content in spec.items():
                zf.writestr(name, content)
        return tmp.name


def _make_image() -> bytes:
    """Create a tiny 10x10 white JPEG."""
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, "JPEG")
    return buf.getvalue()


# ── YOLO ────────────────────────────────────────────


class TestParseYoloLine:
    def test_single_box(self):
        names = {0: "cat"}
        box = _parse_yolo_line("0 0.5 0.5 0.2 0.3", names, 100, 100)
        assert box is not None
        assert box["class_name"] == "cat"
        assert box["x1"] >= 0 and box["x2"] <= 100

    def test_clamp_oob(self):
        names = {0: "dog"}
        box = _parse_yolo_line("0 0.0 0.0 2.0 2.0", names, 100, 100)
        # bw/bh clamped to 1.0, so x2 = (cx + bw/2) * 100 = (0 + 0.5) * 100 = 50
        assert box["x1"] == 0
        assert box["y1"] == 0
        assert box["x2"] == 50
        assert box["y2"] == 50

    def test_invalid_line(self):
        assert _parse_yolo_line("bad line", {0: "x"}, 100, 100) is None
        assert _parse_yolo_line("0 0.5", {0: "x"}, 100, 100) is None


class TestYoloZip:
    def test_extract_and_parse(self):
        """Full YOLO parse via zip extraction."""
        names = json.dumps({"0": "cat"})
        img_bytes = _make_image()
        zip_path = _make_zip(
            {
                "data.yaml": f"names: {names}\nnc: 1",
                "images/img1.jpg": img_bytes,
                "labels/img1.txt": "0 0.5 0.5 0.3 0.4\n",
            }
        )
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_yolo_zip(d)
                assert len(items) == 1
                assert items[0]["image_name"] == "img1.jpg"
                assert len(items[0]["boxes"]) == 1
                assert items[0]["boxes"][0]["class_name"] == "cat"
                assert items[0]["boxes"][0]["x1"] >= 0
        finally:
            os.unlink(zip_path)

    def test_no_images_raises(self):
        zip_path = _make_zip(
            {
                "labels/img1.txt": "0 0.5 0.5 0.1 0.1\n",
            }
        )
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                with pytest.raises(ValueError, match="labels.*images"):
                    parse_yolo_zip(d)
        finally:
            os.unlink(zip_path)


class TestReadYoloNames:
    def test_json_style(self):
        extract = Path(tempfile.mkdtemp())
        (extract / "data.yaml").write_text('names: {"0": "cat", "1": "dog"}\nnc: 2')
        names = _read_yolo_names(extract)
        assert names == {0: "cat", 1: "dog"}

    def test_multiline_style(self):
        extract = Path(tempfile.mkdtemp())
        (extract / "data.yaml").write_text("names:\n  0: cat\n  1: dog\nnc: 2")
        names = _read_yolo_names(extract)
        assert names == {0: "cat", 1: "dog"}

    def test_fallback_from_labels(self):
        extract = Path(tempfile.mkdtemp())
        (extract / "labels").mkdir()
        (extract / "labels" / "a.txt").write_text("2 0.5 0.5 0.1 0.1\n")
        names = _read_yolo_names(extract)
        assert names == {0: "class_0", 1: "class_1", 2: "class_2"}


# ── YOLO Segmentation ───────────────────────────────


class TestParseYoloSegLine:
    def test_polygon(self):
        names = {0: "cat"}
        box = _parse_yolo_seg_line("0 0.1 0.1 0.3 0.1 0.3 0.3 0.1 0.3", names, 100, 100)
        assert box is not None
        assert box["class_name"] == "cat"
        assert box["mask_polygon"] is not None
        assert len(box["mask_polygon"]) == 4

    def test_odd_coords_fallback(self):
        names = {0: "cat"}
        box = _parse_yolo_seg_line("0 0.1 0.1 0.3 0.1 0.3 0.3", names, 100, 100)
        assert box is not None

    def test_fallback_to_bbox(self):
        names = {0: "cat"}
        box = _parse_yolo_seg_line("0 0.5 0.5 0.2 0.3", names, 100, 100)
        assert box is not None
        assert box["class_name"] == "cat"
        assert box["mask_polygon"] is None


# ── COCO ────────────────────────────────────────────


class TestCocoZip:
    def test_basic(self):
        img = _make_image()
        coco = {
            "images": [{"id": 1, "file_name": "img1.jpg", "width": 100, "height": 100}],
            "annotations": [
                {
                    "id": 1,
                    "image_id": 1,
                    "category_id": 1,
                    "bbox": [10, 10, 50, 50],
                    "area": 2500,
                }
            ],
            "categories": [{"id": 1, "name": "cat"}],
        }
        zip_path = _make_zip(
            {
                "annotations.json": json.dumps(coco),
                "images/img1.jpg": img,
            }
        )
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_coco_zip(d)
                assert len(items) == 1
                assert items[0]["image_name"] == "img1.jpg"
                assert len(items[0]["boxes"]) == 1
                assert items[0]["boxes"][0]["class_name"] == "cat"
                assert items[0]["boxes"][0]["x1"] == 10
                assert items[0]["boxes"][0]["y1"] == 10
        finally:
            os.unlink(zip_path)

    def test_skip_zero_area(self):
        img = _make_image()
        coco = {
            "images": [{"id": 1, "file_name": "img1.jpg", "width": 100, "height": 100}],
            "annotations": [
                {"id": 1, "image_id": 1, "category_id": 1, "bbox": [0, 0, 0, 0], "area": 0},
            ],
            "categories": [{"id": 1, "name": "cat"}],
        }
        zip_path = _make_zip({"annotations.json": json.dumps(coco), "images/img1.jpg": img})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_coco_zip(d)
                assert items[0]["boxes"] == []
        finally:
            os.unlink(zip_path)

    def test_no_json_raises(self):
        zip_path = _make_zip({"foo.txt": "bar"})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                with pytest.raises(ValueError, match="COCO"):
                    parse_coco_zip(d)
        finally:
            os.unlink(zip_path)


# ── Pascal VOC ──────────────────────────────────────


class TestVocZip:
    def test_basic(self):
        img = _make_image()
        xml = (
            "<annotation><filename>img1.jpg</filename>"
            "<size><width>100</width><height>100</height></size>"
            "<object><name>cat</name><bndbox>"
            "<xmin>10</xmin><ymin>20</ymin><xmax>50</xmax><ymax>60</ymax>"
            "</bndbox></object></annotation>"
        )
        zip_path = _make_zip({"img1.xml": xml, "images/img1.jpg": img})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_voc_zip(d)
                assert len(items) == 1
                assert items[0]["image_name"] == "img1.jpg"
                assert len(items[0]["boxes"]) == 1
                assert items[0]["boxes"][0]["class_name"] == "cat"
                assert items[0]["boxes"][0]["x1"] == 10
                assert items[0]["boxes"][0]["y1"] == 20
        finally:
            os.unlink(zip_path)

    def test_no_xml_raises(self):
        zip_path = _make_zip({"foo.txt": "bar"})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                with pytest.raises(ValueError, match="VOC"):
                    parse_voc_zip(d)
        finally:
            os.unlink(zip_path)


# ── CreateML ────────────────────────────────────────


class TestCreateMLZip:
    def test_basic(self):
        img = _make_image()
        createml = [
            {
                "image": "img1.jpg",
                "annotations": [
                    {"label": "cat", "coordinates": {"x": 10, "y": 20, "width": 40, "height": 50}}
                ],
            }
        ]
        zip_path = _make_zip({"annotations.json": json.dumps(createml), "images/img1.jpg": img})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_createml_zip(d)
                assert len(items) == 1
                assert items[0]["image_name"] == "img1.jpg"
                assert len(items[0]["boxes"]) == 1
                assert items[0]["boxes"][0]["class_name"] == "cat"
                assert items[0]["boxes"][0]["x1"] == 10
        finally:
            os.unlink(zip_path)

    def test_no_json_raises(self):
        zip_path = _make_zip({"foo.txt": "bar"})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                with pytest.raises(ValueError):
                    parse_createml_zip(d)
        finally:
            os.unlink(zip_path)

    def test_skip_zero_size(self):
        img = _make_image()
        zero_ann = [{"label": "cat", "coordinates": {"x": 0, "y": 0, "width": 0, "height": 0}}]
        createml = [{"image": "img1.jpg", "annotations": zero_ann}]
        zip_path = _make_zip({"annotations.json": json.dumps(createml), "images/img1.jpg": img})
        try:
            with tempfile.TemporaryDirectory() as d:
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(d)
                items = parse_createml_zip(d)
                assert items[0]["boxes"] == []
        finally:
            os.unlink(zip_path)


# ── Helpers ─────────────────────────────────────────


def testread_image_size():
    img = _make_image()
    w, h = read_image_size(None)
    assert w == 0
    assert h == 0

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(img)
        f.flush()
        w, h = read_image_size(f.name)
        os.unlink(f.name)
    assert w == 10
    assert h == 10


def testsave_image():
    img = _make_image()
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as src:
        src.write(img)
        src.flush()
        dst = save_image(src.name, "test.jpg")
        try:
            assert os.path.exists(dst)
            assert dst.endswith("_test.jpg")
        finally:
            os.unlink(src.name)
            os.unlink(dst)
