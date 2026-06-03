from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from .common import BaseSchema, _coerce_uuid


class DetectionBoxOut(BaseSchema):
    id: str
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float | None = None

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return _coerce_uuid(v)


class DetectionOut(BaseSchema):
    id: str
    image_name: str
    categories: list[str] = []
    model_name: str
    image_width: int
    image_height: int
    elapsed_ms: int | None = None
    filter_mode: str | None = None
    filter_nms_iou: float | None = None
    status: str
    created_at: datetime
    boxes: list[DetectionBoxOut] = []

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return _coerce_uuid(v)


class ExportBatchIn(BaseSchema):
    detection_ids: list[str] = Field(..., min_length=1)
