"""Apple CreateML JSON format parser."""

import json
import logging
from pathlib import Path

from .helpers import find_file, find_image_by_name, read_image_size, save_image

logger = logging.getLogger(__name__)


def parse_createml_zip(extract_dir: str) -> list[dict]:
    """Parse Apple CreateML JSON annotations."""
    extract = Path(extract_dir)
    ann_path = find_file(extract, "annotations.json") or find_file(extract, "*.json")
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

        img_file = find_image_by_name(extract, img_name)
        if not img_file:
            logger.warning("Image not found: %s, skipping", img_name)
            continue

        w, h = read_image_size(str(img_file))
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

        saved_path = save_image(str(img_file), Path(img_name).name)
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
