"""Dataset import — parse annotation files from ZIP archives and create Detection records.

Supports: YOLO, YOLO Seg, COCO, Pascal VOC, CreateML.
"""

import logging
import tempfile
import threading
import zipfile
from pathlib import Path

from ...repositories.detection import DetectionRepository
from .coco import parse_coco_zip
from .createml import parse_createml_zip
from .voc import parse_voc_zip
from .yolo import parse_yolo_zip
from .yolo_seg import parse_yolo_seg_zip

logger = logging.getLogger(__name__)

IMPORT_FORMATS = {"yolo", "yolo-seg", "coco", "voc", "createml"}
BATCH_SIZE = 20

_PARSERS = {
    "yolo": parse_yolo_zip,
    "yolo-seg": parse_yolo_seg_zip,
    "coco": parse_coco_zip,
    "voc": parse_voc_zip,
    "createml": parse_createml_zip,
}


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

    parser = _PARSERS[fmt]

    with tempfile.TemporaryDirectory() as extract_dir:
        extract_path = Path(extract_dir).resolve()
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                member_path = (extract_path / member.filename).resolve()
                if not member_path.is_relative_to(extract_path):
                    logger.warning("Skipping suspicious path in ZIP: %s", member.filename)
                    continue
                zf.extract(member, extract_path)

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
