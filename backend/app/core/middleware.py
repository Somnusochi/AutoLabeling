"""HTTP middleware: request ID, timing, access log."""
from __future__ import annotations

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("api.access")
REQUEST_ID_HEADER = "X-Request-ID"


class RequestTracingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex[:12]
        request.state.request_id = request_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            elapsed = time.perf_counter() - start
            logger.error(
                "%s %s [%s] 500 %.3fs",
                request.method, request.url.path, request_id, elapsed,
            )
            raise

        elapsed = time.perf_counter() - start
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "%s %s [%s] %d %.3fs",
            request.method, request.url.path, request_id,
            response.status_code, elapsed,
        )
        return response
