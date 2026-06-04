from __future__ import annotations

import logging

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

logger = logging.getLogger(__name__)

# Check if we are using SQLite
is_sqlite = settings.resolved_database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.resolved_database_url,
    pool_size=5 if not is_sqlite else 0, # pool_size doesn't apply cleanly to SQLite in all configs
    max_overflow=10 if not is_sqlite else 0,
    pool_pre_ping=True if not is_sqlite else False,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Run database migrations via Alembic at startup, falling back to create_all."""
    import os

    from alembic.config import Config

    import app.models  # noqa: F401
    from alembic import command

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ini_path = os.path.join(base_dir, "alembic.ini")

    if os.path.exists(ini_path):
        try:
            logger.info("Running database migrations via Alembic...")
            alembic_cfg = Config(ini_path)
            alembic_cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully")
        except Exception as e:
            logger.error("Failed to run database migrations: %s. Falling back to create_all()", e)
            Base.metadata.create_all(bind=engine)
    else:
        logger.warning("alembic.ini not found at %s. Falling back to create_all()", ini_path)
        Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
