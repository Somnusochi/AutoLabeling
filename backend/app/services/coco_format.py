"""COCO JSON format exporter."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from .yolo_format import _get_filtered_boxes

if TYPE_CHECKING:
    from ..models.detection import Detection


def _build_coco(detections: list[Detection], class_map: dict[str, int]) -> dict:
    images = []
    annotations = []
    ann_id = 1

    for img_id, det in enumerate(detections, start=1):
        img_w = det.image_width or 1
        img_h = det.image_height or 1

        images.append(
            {
                "id": img_id,
                "file_name": det.image_name,
                "width": img_w,
                "height": img_h,
            }
        )

        for box in _get_filtered_boxes(det):
            x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
            w, h = x2 - x1, y2 - y1
            ann = {
                "id": ann_id,
                "image_id": img_id,
                "category_id": class_map[box["class_name"]],
                "bbox": [x1, y1, w, h],
                "area": w * h,
                "iscrowd": 0,
            }
            poly = box.get("mask_polygon")
            if poly and len(poly) >= 3:
                ann["segmentation"] = [[c for p in poly for c in p]]
            else:
                ann["segmentation"] = [[x1, y1, x1, y2, x2, y2, x2, y1]]
            annotations.append(ann)
            ann_id += 1

    categories = [
        {"id": cls_id, "name": name, "supercategory": "none"}
        for name, cls_id in sorted(class_map.items(), key=lambda x: x[1])
    ]

    return {"images": images, "annotations": annotations, "categories": categories}


def export_coco_json(detections: list[Detection], class_map: dict[str, int]) -> str:
    return json.dumps(_build_coco(detections, class_map), ensure_ascii=False, indent=2)
