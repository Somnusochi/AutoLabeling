"""Unified API response envelope."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class APIResponse(BaseModel):
    """Standard API response envelope.

    Success:  {"data": {...}, "meta": {"request_id": "abc"}}
    Error:    {"data": null, "error": {"code": "...", "message": "..."}}
    """

    data: Any = None
    error: dict[str, str] | None = None
    meta: dict[str, Any] = {}
