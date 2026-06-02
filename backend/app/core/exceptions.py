from __future__ import annotations


class AppError(Exception):
    """Base application error with HTTP status code."""

    status_code: int = 500
    detail: str = "Internal server error"


class ModelNotLoadedError(AppError):
    status_code = 503
    detail = "Model is not loaded yet"


class InferenceError(AppError):
    status_code = 500
    detail = "Model inference failed"


class NotFoundError(AppError):
    status_code = 404

    def __init__(self, resource: str, resource_id: str) -> None:
        self.detail = f"{resource} not found: {resource_id}"
