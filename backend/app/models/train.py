from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    model_variant: Mapped[str] = mapped_column(String(32), default="yolo11n")
    epochs: Mapped[int] = mapped_column(Integer, default=100)
    imgsz: Mapped[int] = mapped_column(Integer, default=640)
    batch: Mapped[int] = mapped_column(Integer, default=16)
    detection_ids: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array
    status: Mapped[str] = mapped_column(
        String(32), default="pending"
    )  # pending | running | completed | failed
    metrics: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    model_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
