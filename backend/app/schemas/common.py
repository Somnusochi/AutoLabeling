"""Unified API response envelope with camelCase serialization."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel
from pydantic.alias_generators import to_camel


class BaseSchema(BaseModel):
    """All API schemas inherit from this to serialize fields as camelCase."""

    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
    }


class APIResponse(BaseSchema):
    """Standard API response envelope.

    Single:  {"data": {...}}
    List:    {"data": [...], "total": 100, "page": 1, "pageSize": 20}
    Error:   {"error": {"code": "...", "message": "..."}}
    """

    data: Any = None
    error: dict[str, str] | None = None
    total: int | None = None
    page: int | None = None
    page_size: int | None = None

    model_config = {
        "alias_generator": to_camel,
        "populate_by_name": True,
        "exclude_none": True,
    }


import uuid

def _coerce_uuid(v: Any) -> str:
    return str(v) if isinstance(v, uuid.UUID) else v
