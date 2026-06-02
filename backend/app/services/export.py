from __future__ import annotations

import io
import uuid
import zipfile
from pathlib import Path
from typing import TYPE_CHECKING

from ..core.exceptions import NotFoundError

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from ..models.detection import Detection


CLASS_MAP: dict[str, int] = {}
_next_class_id = 0


def _get_or_assign_class_id(class_name: str) -> int:
    global _next_class_id
    if class_name not in CLASS_MAP:
        CLASS_MAP[class_name] = _next_class_id
        _next_class_id += 1
    return CLASS_MAP[class_name]


def detection_to_yolo(detection: "Detection") -> str:
    """Convert one detection record into YOLO-format .txt.

    Format: class_id x_center y_center width height  (normalized 0–1)
    """
    img_w = detection.image_width or 1
    img_h = detection.image_height or 1
    lines: list[str] = []

    for box in detection.boxes:
        class_id = _get_or_assign_class_id(box.class_name)
        x_center = ((box.x1 + box.x2) / 2) / img_w
        y_center = ((box.y1 + box.y2) / 2) / img_h
        bw = (box.x2 - box.x1) / img_w
        bh = (box.y2 - box.y1) / img_h
        lines.append(f"{class_id} {x_center:.6f} {y_center:.6f} {bw:.6f} {bh:.6f}")

    return "\n".join(lines)


def export_single(db: "Session", detection_id: str) -> tuple[str, str]:
    """Return (yolo_content, image_name) for a single detection."""
    from ..models.detection import Detection

    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise NotFoundError("Detection", detection_id)

    return detection_to_yolo(det), det.image_name


def export_batch(db: "Session", detection_ids: list[str]) -> bytes:
    """Export multiple detections as a YOLO-format zip file.

    Directory structure inside the zip:
        images/
            001.jpg
            002.jpg
        labels/
            001.txt
            002.txt
    """
    from ..models.detection import Detection

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        seen_names: dict[str, int] = {}

        for det_id in detection_ids:
            det = db.query(Detection).filter(Detection.id == det_id).first()
            if not det:
                continue

            base = Path(det.image_name).stem or str(uuid.uuid4())[:8]
            if base in seen_names:
                seen_names[base] += 1
                base = f"{base}_{seen_names[base]}"
            else:
                seen_names[base] = 1

            yolo_txt = detection_to_yolo(det)
            zf.writestr(f"labels/{base}.txt", yolo_txt)
            zf.write(det.image_path, f"images/{base}{Path(det.image_name).suffix}")

    buf.seek(0)
    return buf.getvalue()
