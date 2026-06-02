from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DetectionBoxOut(BaseModel):
    id: str
    class_name: str
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float | None = None

    model_config = {"from_attributes": True}


class DetectionOut(BaseModel):
    id: str
    image_name: str
    categories: str
    model_name: str
    image_width: int
    image_height: int
    elapsed_ms: int | None = None
    status: str
    created_at: datetime
    boxes: list[DetectionBoxOut] = []

    model_config = {"from_attributes": True}


class DetectionListOut(BaseModel):
    total: int
    items: list[DetectionOut]


class ExportBatchIn(BaseModel):
    detection_ids: list[str] = Field(..., min_length=1)
