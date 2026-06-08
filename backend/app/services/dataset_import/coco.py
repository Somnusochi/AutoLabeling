"""COCO JSON format parser."""

import json
import logging
from pathlib import Path

from .helpers import find_file, find_image_by_name, read_image_size, save_image

logger = logging.getLogger(__name__)


def parse_coco_zip(extract_dir: str) -> list[dict]:
    """Parse COCO JSON format dataset."""
    extract = Path(extract_dir)
    ann_path = find_file(extract, "annotations.json") or find_file(extract, "*.json")
    if not ann_path:
        raise ValueError(
            "COCO dataset must contain an annotations JSON file (e.g., annotations.json)"
        )

    data = json.loads(ann_path.read_text())
    images_list = data.get("images", [])
    annotations = data.get("annotations", [])
    categories = data.get("categories", [])

    cat_map: dict[int, str] = {c["id"]: c["name"] for c in categories}

    img_map: dict[int, dict] = {}
    for img in images_list:
        img_file = find_image_by_name(extract, img["file_name"])
        if img_file:
            w = img.get("width", 0) or 0
            h = img.get("height", 0) or 0
            if w == 0 or h == 0:
                w, h = read_image_size(str(img_file))
            img_map[img["id"]] = {
                "path": img_file,
                "name": Path(img["file_name"]).name,
                "width": w,
                "height": h,
            }

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

        saved_path = save_image(str(img_info["path"]), img_info["name"])
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
