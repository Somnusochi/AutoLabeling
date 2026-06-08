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
    pool_size=5 if not is_sqlite else 0,  # pool_size doesn't apply cleanly to SQLite in all configs
    max_overflow=10 if not is_sqlite else 0,
    pool_pre_ping=bool(not is_sqlite),
    connect_args=connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Run database migrations via Alembic at startup.

    Falls back to create_all() only when alembic.ini is missing (dev/SQLite).
    Migration failures in production (PostgreSQL) will fail fast.
    """
    import os

    from alembic.config import Config

    import app.models  # noqa: F401
    from alembic import command

    is_production = settings.resolved_database_url.startswith("postgresql")

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    ini_path = os.path.join(base_dir, "alembic.ini")

    if not os.path.exists(ini_path):
        if is_production:
            raise RuntimeError(
                "alembic.ini not found — required for PostgreSQL production deployment"
            )
        logger.warning("alembic.ini not found. Creating tables via create_all()")
        Base.metadata.create_all(bind=engine)
        return

    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    alembic_cfg = Config(ini_path)
    alembic_cfg.set_main_option("sqlalchemy.url", settings.resolved_database_url)
    alembic_cfg.set_main_option("script_location", os.path.join(base_dir, "alembic"))

    script = ScriptDirectory.from_config(alembic_cfg)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        current = ctx.get_current_revision()
    head = script.get_current_head()

    if current == head:
        logger.info("Database migrations are up to date")
    else:
        logger.info("Running database migrations via Alembic...")
        try:
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations applied successfully")
        except Exception:
            logger.exception("Database migration failed — cannot start service")
            raise


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
