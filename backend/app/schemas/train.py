from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


def _coerce_uuid(v: Any) -> str:
    return str(v) if isinstance(v, uuid.UUID) else v


class TrainRequest(BaseModel):
    detection_ids: list[str] = Field(..., min_length=1)
    model_variant: str = Field(default="yolo26n")
    epochs: int = Field(default=100, ge=1, le=1000)
    imgsz: int = Field(default=640, ge=320, le=1920)
    batch: int = Field(default=16, ge=1, le=128)


class TrainingJobOut(BaseModel):
    id: str
    model_variant: str
    epochs: int
    imgsz: int
    batch: int
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


class TrainingJobListOut(BaseModel):
    total: int
    items: list[TrainingJobOut]
