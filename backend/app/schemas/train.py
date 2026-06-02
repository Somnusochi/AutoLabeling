from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


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
    detection_ids: str
    status: str
    metrics: str | None = None
    model_path: str | None = None
    error_message: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class TrainingJobListOut(BaseModel):
    total: int
    items: list[TrainingJobOut]
