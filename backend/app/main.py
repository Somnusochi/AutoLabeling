from __future__ import annotations

from contextlib import asynccontextmanager

import logging

from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


def _strip_none(obj: Any) -> Any:
    """Recursively strip None values from dicts to keep responses clean."""
    if isinstance(obj, dict):
        return {k: _strip_none(v) for k, v in obj.items() if v is not None}
    if isinstance(obj, list):
        return [_strip_none(v) for v in obj]
    return obj


class CleanJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return super().render(_strip_none(content))

from .api.routes.detection import router as detection_router
from .api.routes.export import router as export_router
from .api.routes.train import router as train_router
from .api.routes.video import router as video_router
from .core.config import settings
from .core.database import init_db
from .core.exceptions import AppError
from .core.logging import setup_logging
from .core.middleware import RequestTracingMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()
    yield


app = FastAPI(
    title="LocateAnything 预标注训练系统 API",
    version="0.1.0",
    lifespan=lifespan,
    default_response_class=CleanJSONResponse,
)

# ── Middleware (order matters: last-added runs first for request) ──
app.add_middleware(RequestTracingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return CleanJSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": type(exc).__name__, "message": exc.detail}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_request: Request, exc: StarletteHTTPException) -> CleanJSONResponse:
    return CleanJSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> CleanJSONResponse:
    errors = exc.errors()
    messages = [f"{'.'.join(str(loc) for loc in e['loc'])}: {e['msg']}" for e in errors]
    return CleanJSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "; ".join(messages)}},
    )


@app.exception_handler(Exception)
async def general_exception_handler(_request: Request, exc: Exception) -> CleanJSONResponse:
    logger.exception("Unhandled exception")
    return CleanJSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "Internal server error"}},
    )


app.include_router(detection_router)
app.include_router(export_router)
app.include_router(train_router)
app.include_router(video_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
