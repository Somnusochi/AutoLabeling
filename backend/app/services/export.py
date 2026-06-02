from __future__ import annotations

import io
import json
import uuid
import zipfile
from pathlib import Path
from typing import TYPE_CHECKING

from .yolo_format import detection_to_yolo

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from ..models.detection import Detection


def export_single(db: "Session", detection_id: str) -> tuple[str, str]:
    """Return (yolo_content, image_name) for a single detection."""
    from ..models.detection import Detection

    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise ValueError(f"Detection not found: {detection_id}")

    class_map = _build_class_map([det])
    return detection_to_yolo(det, class_map), det.image_name


def export_batch(db: "Session", detection_ids: list[str]) -> bytes:
    """Export multiple detections as a YOLO-format zip file with unified class map."""
    from ..models.detection import Detection

    # Pre-load all detections
    dets: list[Detection] = []
    for det_id in detection_ids:
        det = db.query(Detection).filter(Detection.id == det_id).first()
        if det:
            dets.append(det)

    # Build unified class map across ALL detections
    unified_map = _build_class_map(dets)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        seen_names: dict[str, int] = {}

        for det in dets:
            base = Path(det.image_name).stem or str(uuid.uuid4())[:8]
            if base in seen_names:
                seen_names[base] += 1
                base = f"{base}_{seen_names[base]}"
            else:
                seen_names[base] = 1

            yolo_txt = detection_to_yolo(det, unified_map)
            zf.writestr(f"labels/{base}.txt", yolo_txt)
            zf.write(det.image_path, f"images/{base}{Path(det.image_name).suffix}")

        # Include data.yaml with the unified class map
        names = {i: name for name, i in sorted(unified_map.items(), key=lambda x: x[1])}
        data_yaml = f"nc: {len(names)}\nnames: {json.dumps(names)}\n"
        zf.writestr("data.yaml", data_yaml)

    buf.seek(0)
    return buf.getvalue()


def _build_class_map(detections: list["Detection"]) -> dict[str, int]:
    """Build a unified class_name → class_id mapping across all given detections."""
    class_map: dict[str, int] = {}
    for det in detections:
        for box in det.boxes:
            if box.class_name not in class_map:
                class_map[box.class_name] = len(class_map)
    return class_map
