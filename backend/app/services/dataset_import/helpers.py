"""Shared helpers for dataset import parsers."""

import logging
import shutil
import uuid
from pathlib import Path

from PIL import Image

from ...core.config import settings

logger = logging.getLogger(__name__)


def find_dir(extract: Path, name: str) -> Path | None:
    """Find a directory by name, case-insensitive."""
    name_lower = name.lower()
    for p in extract.iterdir():
        if p.is_dir() and p.name.lower() == name_lower:
            return p
    return None


def find_file(extract: Path, pattern: str) -> Path | None:
    """Find a file by name or glob pattern."""
    if "*" in pattern:
        results = sorted(extract.rglob(pattern))
        return results[0] if results else None
    for p in extract.rglob(pattern):
        if p.is_file():
            return p
    return None


def find_image_for_stem(images_dir: Path, stem: str) -> Path | None:
    """Find image file matching a stem, trying common extensions."""
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".JPG", ".JPEG", ".PNG"):
        p = images_dir / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def find_image_by_name(extract: Path, filename: str) -> Path | None:
    """Find image file by filename, searching images/ subdir first then recursively."""
    name = Path(filename).name
    images_dir = find_dir(extract, "images")
    if images_dir:
        for ext in ("", ".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            p = images_dir / f"{name}{ext}"
            if p.exists():
                return p
            for f in images_dir.iterdir():
                if f.is_file() and f.name.lower() == name.lower():
                    return f
    for p in extract.rglob(name):
        if p.is_file():
            return p
    return None


def read_image_size(path: str) -> tuple[int, int]:
    """Read image dimensions without fully decoding."""
    try:
        with Image.open(path) as img:
            return img.size
    except Exception:
        return 0, 0


def save_image(src: str, original_name: str) -> str:
    """Copy image to upload_dir with UUID prefix to avoid name collisions."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    dst_name = f"{uuid.uuid4().hex}_{original_name}"
    dst = upload_dir / dst_name
    shutil.copy2(src, dst)
    return str(dst)
