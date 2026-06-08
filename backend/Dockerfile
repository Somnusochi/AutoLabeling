# Build stage
FROM python:3.12-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt requirements-sam3.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt \
    && python -m venv /sam3-venv \
    && /sam3-venv/bin/pip install --no-cache-dir -r requirements-sam3.txt

# Production stage
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy decord stub (decord is Linux-only, not needed by LocateAnything-3B)
COPY decord_stub.py /usr/local/lib/python3.12/site-packages/decord.py

# Copy Python packages from builder
COPY --from=builder /install /usr/local
# Copy SAM3 venv
COPY --from=builder /sam3-venv /app/sam3-venv

# Create non-root user and data directories
RUN useradd -m -u 1000 appuser \
    && mkdir -p /app/uploads /app/model /app/training_runs \
    && chown -R appuser:appuser /app
USER appuser

# Copy application code
COPY --chown=appuser:appuser app ./app
COPY --chown=appuser:appuser sam3_server.py .
COPY --chown=appuser:appuser alembic.ini .
COPY --chown=appuser:appuser alembic ./alembic

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
