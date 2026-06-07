"""Dataset import — parse annotation files from ZIP archives and create Detection records.

Supports: YOLO, YOLO Seg, COCO, Pascal VOC, CreateML.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
import threading
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from PIL import Image

from ..core.config import settings
from ..repositories.detection import DetectionRepository

logger = logging.getLogger(__name__)

IMPORT_FORMATS = {"yolo", "yolo-seg", "coco", "voc", "createml"}
BATCH_SIZE = 20


def import_dataset(
    db,
    repo: DetectionRepository,
    zip_path: str,
    fmt: str,
    cancel_event: threading.Event | None = None,
) -> list[str]:
    """Parse a ZIP dataset and create Detection records. Returns list of detection IDs."""
    if fmt not in IMPORT_FORMATS:
        raise ValueError(f"Unsupported format: {fmt}. Must be one of {sorted(IMPORT_FORMATS)}")

    if cancel_event is None:
        cancel_event = threading.Event()

    parser = {
        "yolo": _parse_yolo_zip,
        "yolo-seg": _parse_yolo_seg_zip,
        "coco": _parse_coco_zip,
        "voc": _parse_voc_zip,
        "createml": _parse_createml_zip,
    }[fmt]

    with tempfile.TemporaryDirectory() as extract_dir:
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

        parsed = parser(extract_dir)

        detection_ids: list[str] = []
        for i, item in enumerate(parsed):
            if cancel_event.is_set():
                logger.info("Import cancelled after %d/%d images", i, len(parsed))
                break

            _import_one(db, repo, item)
            detection_ids.append(item["detection_id"])

            if (i + 1) % BATCH_SIZE == 0:
                db.commit()

        db.commit()
        return detection_ids


def _import_one(db, repo: DetectionRepository, item: dict) -> None:
    """Import a single parsed image + boxes into the database."""
    det = repo.create(
        image_path=item["image_path"],
        image_name=item["image_name"],
        image_width=item["image_width"],
        image_height=item["image_height"],
        categories=[item.get("categories", [])] if item.get("categories") else [],
        model_name="imported",
    )
    det.model_type = None
    det.filter_mode = "all"

    item["detection_id"] = str(det.id)

    if item["boxes"]:
        repo.add_boxes(str(det.id), item["boxes"])


# ── YOLO ────────────────────────────────────────────


def _parse_yolo_zip(extract_dir: str) -> list[dict]:
    """Parse YOLO-format dataset: images/ + labels/ + data.yaml."""
    extract = Path(extract_dir)
    class_names = _read_yolo_names(extract)

    labels_dir = _find_dir(extract, "labels")
    images_dir = _find_dir(extract, "images")
    if not labels_dir or not images_dir:
        raise ValueError("YOLO dataset must contain 'labels/' and 'images/' directories")

    items: list[dict] = []
    for label_file in sorted(labels_dir.glob("*.txt")):
        stem = label_file.stem
        img_path = _find_image_for_stem(images_dir, stem)
        if not img_path:
            logger.warning("No image found for label %s, skipping", label_file.name)
            continue

        w, h = _read_image_size(str(img_path))
        if w == 0 or h == 0:
            logger.warning("Invalid image size for %s, skipping", img_path.name)
            continue

        boxes = []
        for line in label_file.read_text().strip().splitlines():
            box = _parse_yolo_line(line, class_names, w, h)
            if box:
                boxes.append(box)

        saved_path = _save_image(str(img_path), img_path.name)
        items.append(
            {
                "image_path": saved_path,
                "image_name": img_path.name,
                "image_width": w,
                "image_height": h,
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-label pairs found in YOLO dataset")
    return items


def _read_yolo_names(extract: Path) -> dict[int, str]:
    """Read class names from data.yaml, or derive from label files."""
    names: dict[int, str] = {}
    yaml_path = extract / "data.yaml"
    if yaml_path.exists():
        content = yaml_path.read_text()
        # Simple YAML parsing — just extract the 'names' dict
        import re
        # Try to find names as {0: "cat", 1: "dog"} or {0: 'cat', 1: 'dog'}
        names_match = re.search(r"names\s*:\s*(\{[^}]+\})", content)
        if names_match:
            try:
                raw = names_match.group(1)
                # JSON-compatible format
                names = json.loads(raw)
                return {int(k): v for k, v in names.items()}
            except (json.JSONDecodeError, ValueError):
                pass

        # Try YAML-style names list: 0: cat, 1: dog (multiline)
        names_section = re.search(r"names\s*:\s*\n((?:\s*.+\n)+)", content)
        if names_section:
            for line in names_section.group(1).strip().splitlines():
                m = re.match(r"\s*(\d+)\s*:\s*(.+)", line)
                if m:
                    names[int(m.group(1))] = m.group(2).strip().strip("\"'")

    if not names:
        # Derive from max class_id in labels
        labels_dir = _find_dir(extract, "labels")
        if labels_dir:
            max_id = -1
            for f in labels_dir.glob("*.txt"):
                for line in f.read_text().strip().splitlines():
                    try:
                        cid = int(line.split()[0])
                        if cid > max_id:
                            max_id = cid
                    except (ValueError, IndexError):
                        continue
            names = {i: f"class_{i}" for i in range(max_id + 1)}

    return names


def _parse_yolo_line(line: str, class_names: dict[int, str], img_w: int, img_h: int) -> dict | None:
    """Parse a single YOLO label line, returning a box dict or None."""
    parts = line.strip().split()
    if len(parts) < 5:
        return None
    try:
        cid = int(parts[0])
        cx, cy, bw, bh = float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
    except (ValueError, IndexError):
        return None

    # Clamp normalized coords
    cx = max(0, min(1, cx))
    cy = max(0, min(1, cy))
    bw = max(0, min(1, bw))
    bh = max(0, min(1, bh))

    x1 = int((cx - bw / 2) * img_w)
    y1 = int((cy - bh / 2) * img_h)
    x2 = int((cx + bw / 2) * img_w)
    y2 = int((cy + bh / 2) * img_h)

    return {
        "class_name": class_names.get(cid, f"class_{cid}"),
        "x1": max(0, x1),
        "y1": max(0, y1),
        "x2": min(img_w, x2),
        "y2": min(img_h, y2),
        "confidence": None,
        "mask_polygon": None,
    }


# ── YOLO Segmentation ───────────────────────────────


def _parse_yolo_seg_zip(extract_dir: str) -> list[dict]:
    """Parse YOLO segmentation dataset."""
    extract = Path(extract_dir)
    class_names = _read_yolo_names(extract)

    labels_dir = _find_dir(extract, "labels")
    images_dir = _find_dir(extract, "images")
    if not labels_dir or not images_dir:
        raise ValueError("YOLO Seg dataset must contain 'labels/' and 'images/' directories")

    items: list[dict] = []
    for label_file in sorted(labels_dir.glob("*.txt")):
        stem = label_file.stem
        img_path = _find_image_for_stem(images_dir, stem)
        if not img_path:
            logger.warning("No image found for label %s, skipping", label_file.name)
            continue

        w, h = _read_image_size(str(img_path))
        if w == 0 or h == 0:
            continue

        boxes = []
        for line in label_file.read_text().strip().splitlines():
            box = _parse_yolo_seg_line(line, class_names, w, h)
            if box:
                boxes.append(box)

        saved_path = _save_image(str(img_path), img_path.name)
        items.append(
            {
                "image_path": saved_path,
                "image_name": img_path.name,
                "image_width": w,
                "image_height": h,
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-label pairs found in YOLO Seg dataset")
    return items


def _parse_yolo_seg_line(
    line: str, class_names: dict[int, str], img_w: int, img_h: int
) -> dict | None:
    """Parse a YOLO seg label line. Fall back to bbox if too few points."""
    parts = line.strip().split()
    if len(parts) < 3:
        return None
    try:
        cid = int(parts[0])
    except ValueError:
        return None

    coords = parts[1:]
    # If odd number, drop the last unpaired coordinate
    if len(coords) % 2 != 0:
        coords = coords[:-1]

    if len(coords) < 6:
        # Too few polygon points — try bbox format (cx, cy, w, h)
        if len(coords) == 4:
            return _parse_yolo_line(line, class_names, img_w, img_h)
        return None

    points = []
    xs, ys = [], []
    for i in range(0, len(coords), 2):
        try:
            px = float(coords[i]) * img_w
            py = float(coords[i + 1]) * img_h
        except (ValueError, IndexError):
            continue
        px = max(0, min(img_w, px))
        py = max(0, min(img_h, py))
        points.append([px, py])
        xs.append(px)
        ys.append(py)

    if len(points) < 3:
        return None

    return {
        "class_name": class_names.get(cid, f"class_{cid}"),
        "x1": int(min(xs)),
        "y1": int(min(ys)),
        "x2": int(max(xs)),
        "y2": int(max(ys)),
        "confidence": None,
        "mask_polygon": points,
    }


# ── COCO ─────────────────────────────────────────────


def _parse_coco_zip(extract_dir: str) -> list[dict]:
    """Parse COCO JSON format dataset."""
    extract = Path(extract_dir)
    ann_path = _find_file(extract, "annotations.json") or _find_file(extract, "*.json")
    if not ann_path:
        raise ValueError(
            "COCO dataset must contain an annotations JSON file (e.g., annotations.json)"
        )

    data = json.loads(ann_path.read_text())
    images_list = data.get("images", [])
    annotations = data.get("annotations", [])
    categories = data.get("categories", [])

    cat_map: dict[int, str] = {c["id"]: c["name"] for c in categories}

    # Build image_id → (file_name, w, h)
    img_map: dict[int, dict] = {}
    for img in images_list:
        img_file = _find_image_by_name(extract, img["file_name"])
        if img_file:
            w = img.get("width", 0) or 0
            h = img.get("height", 0) or 0
            if w == 0 or h == 0:
                w, h = _read_image_size(str(img_file))
            img_map[img["id"]] = {
                "path": img_file,
                "name": Path(img["file_name"]).name,
                "width": w,
                "height": h,
            }

    # Group annotations by image_id
    anns_by_image: dict[int, list[dict]] = {}
    for ann in annotations:
        if ann.get("area", 0) == 0:
            continue
        anns_by_image.setdefault(ann["image_id"], []).append(ann)

    items: list[dict] = []
    for img_id, img_info in img_map.items():
        boxes: list[dict] = []
        for ann in anns_by_image.get(img_id, []):
            bbox = ann.get("bbox", [0, 0, 0, 0])
            if len(bbox) < 4:
                continue
            x, y, bw, bh = bbox[0], bbox[1], bbox[2], bbox[3]
            mask_poly = None
            seg = ann.get("segmentation", [])
            if seg and isinstance(seg, list) and len(seg) > 0:
                poly = seg[0] if isinstance(seg[0], list) else seg
                if len(poly) >= 6:
                    mask_poly = [[poly[j], poly[j + 1]] for j in range(0, len(poly), 2)]

            boxes.append(
                {
                    "class_name": cat_map.get(ann["category_id"], f"class_{ann['category_id']}"),
                    "x1": int(x),
                    "y1": int(y),
                    "x2": int(x + bw),
                    "y2": int(y + bh),
                    "confidence": None,
                    "mask_polygon": mask_poly,
                }
            )

        saved_path = _save_image(str(img_info["path"]), img_info["name"])
        items.append(
            {
                "image_path": saved_path,
                "image_name": img_info["name"],
                "image_width": img_info["width"],
                "image_height": img_info["height"],
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-annotation pairs found in COCO dataset")
    return items


# ── Pascal VOC ──────────────────────────────────────


def _parse_voc_zip(extract_dir: str) -> list[dict]:
    """Parse Pascal VOC XML annotations."""
    extract = Path(extract_dir)
    items: list[dict] = []

    for xml_path in sorted(extract.rglob("*.xml")):
        if "images" in xml_path.parts or "__MACOSX" in str(xml_path):
            continue

        try:
            tree = ET.parse(xml_path)
            root_elem = tree.getroot()
        except ET.ParseError:
            logger.warning("Invalid XML: %s, skipping", xml_path.name)
            continue

        filename_el = root_elem.find("filename")
        if filename_el is None or not filename_el.text:
            logger.warning("No filename in %s, skipping", xml_path.name)
            continue
        img_name = filename_el.text.strip()

        img_file = _find_image_by_name(extract, img_name)
        if not img_file:
            logger.warning("Image not found: %s, skipping", img_name)
            continue

        size_el = root_elem.find("size")
        if size_el is not None:
            w_el = size_el.find("width")
            h_el = size_el.find("height")
            w = int(w_el.text) if w_el is not None and w_el.text else 0
            h = int(h_el.text) if h_el is not None and h_el.text else 0
        else:
            w, h = 0, 0
        if w == 0 or h == 0:
            w, h = _read_image_size(str(img_file))

        boxes: list[dict] = []
        for obj in root_elem.findall("object"):
            name_el = obj.find("name")
            class_name = name_el.text.strip() if name_el is not None and name_el.text else "object"
            bndbox = obj.find("bndbox")
            if bndbox is None:
                continue
            try:
                x1 = int(float(bndbox.findtext("xmin", "0")))
                y1 = int(float(bndbox.findtext("ymin", "0")))
                x2 = int(float(bndbox.findtext("xmax", "0")))
                y2 = int(float(bndbox.findtext("ymax", "0")))
            except (ValueError, TypeError):
                continue
            boxes.append(
                {
                    "class_name": class_name,
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "confidence": None,
                    "mask_polygon": None,
                }
            )

        saved_path = _save_image(str(img_file), img_name)
        items.append(
            {
                "image_path": saved_path,
                "image_name": img_name,
                "image_width": w,
                "image_height": h,
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-annotation pairs found in VOC dataset")
    return items


# ── CreateML ────────────────────────────────────────


def _parse_createml_zip(extract_dir: str) -> list[dict]:
    """Parse Apple CreateML JSON annotations."""
    extract = Path(extract_dir)
    ann_path = _find_file(extract, "annotations.json") or _find_file(extract, "*.json")
    if not ann_path:
        raise ValueError("CreateML dataset must contain an annotations JSON file")

    data = json.loads(ann_path.read_text())
    if not isinstance(data, list):
        raise ValueError("CreateML annotations must be a JSON array")

    items: list[dict] = []
    for entry in data:
        img_name = entry.get("image", entry.get("imagefilename", ""))
        if not img_name:
            continue

        img_file = _find_image_by_name(extract, img_name)
        if not img_file:
            logger.warning("Image not found: %s, skipping", img_name)
            continue

        w, h = _read_image_size(str(img_file))
        if w == 0 or h == 0:
            continue

        boxes: list[dict] = []
        for ann in entry.get("annotations", []):
            label = ann.get("label", "object")
            coords = ann.get("coordinates", {})
            if not coords:
                continue
            x = int(coords.get("x", 0))
            y = int(coords.get("y", 0))
            bw = int(coords.get("width", 0))
            bh = int(coords.get("height", 0))
            if bw <= 0 or bh <= 0:
                continue
            boxes.append(
                {
                    "class_name": label,
                    "x1": x,
                    "y1": y,
                    "x2": x + bw,
                    "y2": y + bh,
                    "confidence": None,
                    "mask_polygon": None,
                }
            )

        saved_path = _save_image(str(img_file), Path(img_name).name)
        items.append(
            {
                "image_path": saved_path,
                "image_name": Path(img_name).name,
                "image_width": w,
                "image_height": h,
                "boxes": boxes,
            }
        )

    if not items:
        raise ValueError("No valid image-annotation pairs found in CreateML dataset")
    return items


# ── Helpers ─────────────────────────────────────────


def _find_dir(extract: Path, name: str) -> Path | None:
    """Find a directory by name, case-insensitive."""
    name_lower = name.lower()
    for p in extract.iterdir():
        if p.is_dir() and p.name.lower() == name_lower:
            return p
    return None


def _find_file(extract: Path, pattern: str) -> Path | None:
    """Find a file by name or glob pattern."""
    if "*" in pattern:
        results = sorted(extract.rglob(pattern))
        return results[0] if results else None
    for p in extract.rglob(pattern):
        if p.is_file():
            return p
    return None


def _find_image_for_stem(images_dir: Path, stem: str) -> Path | None:
    """Find image file matching a stem, trying common extensions."""
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".JPG", ".JPEG", ".PNG"):
        p = images_dir / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def _find_image_by_name(extract: Path, filename: str) -> Path | None:
    """Find image file by filename, searching images/ subdir first then recursively."""
    name = Path(filename).name
    images_dir = _find_dir(extract, "images")
    if images_dir:
        for ext in ("", ".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            p = images_dir / f"{name}{ext}"
            if p.exists():
                return p
            # Case-insensitive
            for f in images_dir.iterdir():
                if f.is_file() and f.name.lower() == name.lower():
                    return f
    # Fallback: recursive search
    for p in extract.rglob(name):
        if p.is_file():
            return p
    return None


def _read_image_size(path: str) -> tuple[int, int]:
    """Read image dimensions without fully decoding."""
    try:
        with Image.open(path) as img:
            return img.size
    except Exception:
        return 0, 0


def _save_image(src: str, original_name: str) -> str:
    """Copy image to upload_dir with UUID prefix to avoid name collisions."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dst_name = f"{uuid.uuid4().hex}_{original_name}"
    dst = upload_dir / dst_name
    shutil.copy2(src, dst)
    return str(dst)
