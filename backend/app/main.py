from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api.routes.detection import router as detection_router
from .api.routes.export import router as export_router
from .api.routes.train import router as train_router
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
    title="YOLO 自动标注训练平台 API",
    version="0.1.0",
    lifespan=lifespan,
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
    return JSONResponse(
        status_code=exc.status_code,
        content={"data": None, "error": {"code": type(exc).__name__, "message": exc.detail}},
    )


app.include_router(detection_router)
app.include_router(export_router)
app.include_router(train_router)


@app.get("/api/health")
async def health() -> dict:
    return {"status": "ok", "version": "0.1.0"}
