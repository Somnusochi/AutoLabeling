"""Apple CreateML JSON format exporter."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from .yolo_format import _get_filtered_boxes

if TYPE_CHECKING:
    from ..models.detection import Detection


def _build_createml(detections: list[Detection], class_map: dict[str, int]) -> list[dict]:
    """Build CreateML object detection annotations.

    Format: [{"imagefilename": "...", "annotations": [{"label": "...", "coordinates": {...}}]}]
    """
    results = []

    for det in detections:
        img_w = det.image_width or 1
        img_h = det.image_height or 1

        annotations = []
        for box in _get_filtered_boxes(det):
            x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
            annotations.append(
                {
                    "label": box["class_name"],
                    "coordinates": {
                        "x": x1,
                        "y": y1,
                        "width": x2 - x1,
                        "height": y2 - y1,
                    },
                }
            )

        results.append(
            {
                "imagefilename": det.image_name,
                "annotations": annotations,
            }
        )

    return results


def export_createml_json(detections: list[Detection], class_map: dict[str, int]) -> str:
    return json.dumps(_build_createml(detections, class_map), ensure_ascii=False, indent=2)
