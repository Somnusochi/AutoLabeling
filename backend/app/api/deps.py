"""Shared FastAPI dependencies."""
from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..repositories.detection import DetectionRepository


def get_repo(db: Session = Depends(get_db)) -> DetectionRepository:
    return DetectionRepository(db)


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "-")
