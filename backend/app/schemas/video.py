from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field, field_validator

from .common import BaseSchema, _coerce_uuid


class KeyFrameOut(BaseSchema):
    id: str
    video_id: str
    frame_number: int
    timestamp_seconds: float
    scene_score: float | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("id", "video_id", mode="before")
    @classmethod
    def coerce_ids(cls, v: Any) -> str:
        return _coerce_uuid(v)


class VideoOut(BaseSchema):
    id: str
    file_name: str
    duration: float | None = None
    fps: float | None = None
    total_frames: int | None = None
    width: int | None = None
    height: int | None = None
    status: str
    created_at: datetime
    keyframes: list[KeyFrameOut] = []

    model_config = {"from_attributes": True}

    @field_validator("id", mode="before")
    @classmethod
    def coerce_id(cls, v: Any) -> str:
        return _coerce_uuid(v)


class ExtractKeyframesIn(BaseSchema):
    method: str = Field("scene", description="scene | motion | interval")
    threshold: float = Field(
        15.0, ge=0.5, le=50.0,
        description="scene: chi-sqr sensitivity (1-100); motion: min displacement px (0.5-50)",
    )
    interval_seconds: float = Field(2.0, ge=0.5, le=60.0, description="interval seconds (interval method only)")
    max_frames: int = Field(200, ge=1, le=1000, description="max raw candidate frames")
    ssim_threshold: float = Field(
        0.95, ge=0.5, le=1.0,
        description="SSIM dedup threshold (0.5-1.0). 1.0 = no dedup. Default 0.95.",
    )
