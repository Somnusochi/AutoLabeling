from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_name: Mapped[str] = mapped_column(String(512), nullable=False)
    categories: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    model_name: Mapped[str] = mapped_column(String(256), default="LocateAnything-3B")
    image_width: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    filter_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    filter_nms_iou: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(32),
        default="completed",
        # check constraint added via migration
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    boxes: Mapped[list[DetectionBox]] = relationship(
        "DetectionBox",
        back_populates="detection",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_detections_created_at", "created_at"),
        Index("ix_detections_status", "status"),
    )


class DetectionBox(Base):
    __tablename__ = "detection_boxes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    detection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("detections.id", ondelete="CASCADE"),
        nullable=False,
    )
    class_name: Mapped[str] = mapped_column(String(256), nullable=False)
    x1: Mapped[int] = mapped_column(Integer, nullable=False)
    y1: Mapped[int] = mapped_column(Integer, nullable=False)
    x2: Mapped[int] = mapped_column(Integer, nullable=False)
    y2: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    mask_polygon: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
    )

    detection: Mapped[Detection] = relationship("Detection", back_populates="boxes")

    __table_args__ = (Index("ix_detection_boxes_detection_id", "detection_id"),)
