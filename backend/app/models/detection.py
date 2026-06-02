from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    image_path: Mapped[str] = mapped_column(Text, nullable=False)
    image_name: Mapped[str] = mapped_column(String(512), nullable=False)
    categories: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    model_name: Mapped[str] = mapped_column(String(256), default="LocateAnything-3B")
    image_width: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), default="completed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    boxes: Mapped[list["DetectionBox"]] = relationship(
        "DetectionBox", back_populates="detection", cascade="all, delete-orphan"
    )


class DetectionBox(Base):
    __tablename__ = "detection_boxes"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    detection_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("detections.id", ondelete="CASCADE"), nullable=False
    )
    class_name: Mapped[str] = mapped_column(String(256), nullable=False)
    x1: Mapped[int] = mapped_column(Integer, nullable=False)
    y1: Mapped[int] = mapped_column(Integer, nullable=False)
    x2: Mapped[int] = mapped_column(Integer, nullable=False)
    y2: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    detection: Mapped["Detection"] = relationship("Detection", back_populates="boxes")
