"""Pascal VOC XML format exporter."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .yolo_format import _get_filtered_boxes

if TYPE_CHECKING:
    from ..models.detection import Detection


def detection_to_voc(detection: Detection, class_map: dict[str, int]) -> str:
    """Convert a detection record to Pascal VOC XML string."""
    img_w = detection.image_width or 1
    img_h = detection.image_height or 1
    boxes = _get_filtered_boxes(detection)

    lines = ['<annotation>', f'  <filename>{detection.image_name}</filename>']
    lines.append("  <size>")
    lines.append(f"    <width>{img_w}</width>")
    lines.append(f"    <height>{img_h}</height>")
    lines.append("    <depth>3</depth>")
    lines.append("  </size>")

    for box in boxes:
        x1, y1, x2, y2 = box["x1"], box["y1"], box["x2"], box["y2"]
        lines.append("  <object>")
        lines.append(f"    <name>{box['class_name']}</name>")
        lines.append("    <pose>Unspecified</pose>")
        lines.append("    <truncated>0</truncated>")
        lines.append("    <difficult>0</difficult>")
        lines.append("    <bndbox>")
        lines.append(f"      <xmin>{x1}</xmin>")
        lines.append(f"      <ymin>{y1}</ymin>")
        lines.append(f"      <xmax>{x2}</xmax>")
        lines.append(f"      <ymax>{y2}</ymax>")
        lines.append("    </bndbox>")
        lines.append("  </object>")

    lines.append("</annotation>")
    return "\n".join(lines)
