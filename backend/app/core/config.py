from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings

# ── CUDA memory allocator tuning ───────────────────
# Use expandable segments (PyTorch 2.1+) for dynamic memory management;
# much better than the legacy max_split_size_mb for varying tensor sizes
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    # Database
    database_url: str = "postgresql+psycopg2://somnusochi:somnusochi@localhost:5432/autolabeling"

    # Model (auto-detect: cuda → mps; CPU is not supported)
    model_dir: str = ""
    device: str = ""
    model_id: str = "nvidia/LocateAnything-3B"

    @property
    def resolved_device(self) -> str:
        from .gpu_memory import _detect_device

        return _detect_device(self.device)

    # Model idle timeout (seconds) — auto-unload to free GPU memory
    model_idle_timeout_seconds: int = 600

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # Upload
    max_upload_size_mb: int = 20

    @property
    def project_root(self) -> Path:
        return Path(__file__).resolve().parent.parent.parent

    @property
    def upload_dir(self) -> Path:
        d = self.project_root / "uploads"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def resolved_model_dir(self) -> str:
        return self.model_dir or str(self.project_root / "model")


settings = Settings()
