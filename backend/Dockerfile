# Build stage — SAM3 support is opt-in to keep default image size small
FROM python:3.12-slim as builder

WORKDIR /app

ARG INSTALL_SAM3=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-sam3.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt \
    && mkdir -p /sam3-venv \
    && if [ "$INSTALL_SAM3" = "true" ]; then \
         python -m venv /sam3-venv \
         && /sam3-venv/bin/pip install --no-cache-dir -r requirements-sam3.txt; \
       fi

# Production stage
FROM python:3.12-slim

WORKDIR /app

ARG INSTALL_SAM3=false

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY decord_stub.py /usr/local/lib/python3.12/site-packages/decord.py

COPY --from=builder /install /usr/local
COPY --from=builder /sam3-venv /app/sam3-venv

RUN useradd -m -u 1000 appuser \
    && mkdir -p /app/uploads /app/model /app/training_runs \
    && chown -R appuser:appuser /app
USER appuser

COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser sam3_server.py .
COPY --chown=appuser:appuser alembic.ini .
COPY --chown=appuser:appuser alembic ./alembic

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000 8002

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
