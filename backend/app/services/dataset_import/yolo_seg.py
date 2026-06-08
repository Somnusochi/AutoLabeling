"""YOLO segmentation format parser."""

import logging
from pathlib import Path

from .helpers import find_dir, find_image_for_stem, read_image_size, save_image
from .yolo import _read_yolo_names

logger = logging.getLogger(__name__)


def parse_yolo_seg_zip(extract_dir: str) -> list[dict]:
    """Parse YOLO segmentation dataset."""
    extract = Path(extract_dir)
    class_names = _read_yolo_names(extract)

    labels_dir = find_dir(extract, "labels")
    images_dir = find_dir(extract, "images")
    if not labels_dir or not images_dir:
        raise ValueError("YOLO Seg dataset must contain 'labels/' and 'images/' directories")

    items: list[dict] = []
    for label_file in sorted(labels_dir.glob("*.txt")):
        stem = label_file.stem
        img_path = find_image_for_stem(images_dir, stem)
        if not img_path:
            logger.warning("No image found for label %s, skipping", label_file.name)
            continue

        w, h = read_image_size(str(img_path))
        if w == 0 or h == 0:
            continue

        boxes = []
        for line in label_file.read_text().strip().splitlines():
            box = _parse_yolo_seg_line(line, class_names, w, h)
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
        raise ValueError("No valid image-label pairs found in YOLO Seg dataset")
    return items


def _parse_yolo_seg_line(
    line: str, class_names: dict[int, str], img_w: int, img_h: int
) -> dict | None:
    """Parse a YOLO seg label line. Fall back to bbox if too few points."""
    from .yolo import _parse_yolo_line

    parts = line.strip().split()
    if len(parts) < 3:
        return None
    try:
        cid = int(parts[0])
    except ValueError:
        return None

    coords = parts[1:]
    if len(coords) % 2 != 0:
        coords = coords[:-1]

    if len(coords) < 6:
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
