from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.database_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create all tables. Called at application startup."""
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
