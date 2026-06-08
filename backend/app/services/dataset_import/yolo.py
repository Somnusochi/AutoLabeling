"""YOLO detection format parser."""

import json
import logging
import re
from pathlib import Path

from .helpers import find_dir, find_image_for_stem, read_image_size, save_image

logger = logging.getLogger(__name__)


def parse_yolo_zip(extract_dir: str) -> list[dict]:
    """Parse YOLO-format dataset: images/ + labels/ + data.yaml."""
    extract = Path(extract_dir)
    class_names = _read_yolo_names(extract)

    labels_dir = find_dir(extract, "labels")
    images_dir = find_dir(extract, "images")
    if not labels_dir or not images_dir:
        raise ValueError("YOLO dataset must contain 'labels/' and 'images/' directories")

    items: list[dict] = []
    for label_file in sorted(labels_dir.glob("*.txt")):
        stem = label_file.stem
        img_path = find_image_for_stem(images_dir, stem)
        if not img_path:
            logger.warning("No image found for label %s, skipping", label_file.name)
            continue

        w, h = read_image_size(str(img_path))
        if w == 0 or h == 0:
            logger.warning("Invalid image size for %s, skipping", img_path.name)
            continue

        boxes = []
        for line in label_file.read_text().strip().splitlines():
            box = _parse_yolo_line(line, class_names, w, h)
            if box:
                boxes.append(box)

        saved_path = save_image(str(img_path), img_path.name)
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
        names_match = re.search(r"names\s*:\s*(\{[^}]+\})", content)
        if names_match:
            try:
                raw = names_match.group(1)
                names = json.loads(raw)
                return {int(k): v for k, v in names.items()}
            except (json.JSONDecodeError, ValueError):
                pass

        names_section = re.search(r"names\s*:\s*\n((?:\s*.+\n)+)", content)
        if names_section:
            for line in names_section.group(1).strip().splitlines():
                m = re.match(r"\s*(\d+)\s*:\s*(.+)", line)
                if m:
                    names[int(m.group(1))] = m.group(2).strip().strip("\"'")

    if not names:
        labels_dir = find_dir(extract, "labels")
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
