from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from .common import BaseSchema


def _coerce_uuid(v: Any) -> str:
    return str(v) if isinstance(v, uuid.UUID) else v


class TrainRequest(BaseSchema):
    detection_ids: list[str] = Field(..., min_length=1)
    model_variant: str = Field(default="yolo26n")
    epochs: int = Field(default=100, ge=1, le=1000)
    imgsz: int = Field(default=640, ge=320, le=1920)
    batch: int = Field(default=16, ge=1, le=128)
    split_ratio: float = Field(default=0.8, ge=0.1, le=1.0, description="train/val split ratio")
    task_type: str = Field(default="detect", description="detect | segment | classify")


class TrainingJobOut(BaseSchema):
    id: str
    model_variant: str
    epochs: int
    imgsz: int
    batch: int
    split_ratio: float = 0.8
    task_type: str = "detect"
    detection_ids: list[str] = []
    class_map: dict | None = None
    status: str
    metrics: dict | None = None
    model_path: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return _coerce_uuid(v)
