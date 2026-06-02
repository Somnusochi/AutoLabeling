"""Data-access layer for Detection / DetectionBox.

All DB queries live here — routes and services never touch Session directly.
"""
from __future__ import annotations

from typing import Sequence

from sqlalchemy.orm import Session

from ..models.detection import Detection, DetectionBox


class DetectionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── write ──────────────────────────────────────────

    def create(
        self,
        *,
        image_path: str,
        image_name: str,
        image_width: int,
        image_height: int,
        categories: str,       # JSON array string
        model_name: str = "LocateAnything-3B",
    ) -> Detection:
        det = Detection(
            image_path=image_path,
            image_name=image_name,
            image_width=image_width,
            image_height=image_height,
            categories=categories,
            model_name=model_name,
        )
        self.db.add(det)
        self.db.flush()  # get id without committing
        return det

    def add_boxes(self, detection_id: str, boxes: list[dict]) -> list[DetectionBox]:
        """boxes: [{"x1","y1","x2","y2","class_name","confidence"}, ...]"""
        entities = [
            DetectionBox(
                detection_id=detection_id,
                class_name=b["class_name"],
                x1=b["x1"], y1=b["y1"], x2=b["x2"], y2=b["y2"],
                confidence=b.get("confidence"),
            )
            for b in boxes
        ]
        self.db.add_all(entities)
        self.db.flush()
        return entities

    # ── read ───────────────────────────────────────────

    def get_by_id(self, detection_id: str) -> Detection | None:
        return (
            self.db.query(Detection)
            .filter(Detection.id == detection_id)
            .first()
        )

    def list(
        self, *, page: int = 1, page_size: int = 20,
    ) -> tuple[Sequence[Detection], int]:
        q = self.db.query(Detection)
        total = q.count()
        items = (
            q.order_by(Detection.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    # ── delete ─────────────────────────────────────────

    def delete(self, detection: Detection) -> None:
        self.db.delete(detection)
        self.db.flush()
