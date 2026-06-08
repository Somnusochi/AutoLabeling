from __future__ import annotations

import contextlib
import logging
import shutil
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from ...core.config import settings
from ...core.database import get_db
from ...core.exceptions import NotFoundError
from ...repositories.video import VideoRepository
from ...schemas.common import APIResponse
from ...schemas.video import ExtractKeyframesIn, VideoOut
from ...services import video_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["video"])


def _get_video_repo(db: Session = Depends(get_db)) -> VideoRepository:
    return VideoRepository(db)


def _save_video_file(file: UploadFile) -> tuple[str, str, str]:
    """Save uploaded video and return (filepath, safe_name, extension)."""
    ext = Path(file.filename).suffix.lower()  # type: ignore[arg-type]
    safe_name = f"{uuid.uuid4().hex}_{Path(file.filename).name}"  # type: ignore[arg-type]
    filepath = settings.upload_dir / safe_name
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return str(filepath), safe_name, ext


ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


@router.post("/videos/upload", status_code=201)
async def upload_video(
    file: UploadFile = File(...),
    repo: VideoRepository = Depends(_get_video_repo),
) -> APIResponse:
    ext = Path(file.filename).suffix.lower()  # type: ignore[arg-type]
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(
            400, detail=f"Unsupported format: {ext}. Supported: {', '.join(ALLOWED_VIDEO_EXTS)}"
        )

    file.file.seek(0, 2)
    size_mb = file.file.tell() / (1024 * 1024)
    file.file.seek(0)
    if size_mb > settings.max_video_upload_size_mb:
        raise HTTPException(400, detail=f"File exceeds {settings.max_video_upload_size_mb}MB limit")

    filepath, safe_name, _ = _save_video_file(file)

    meta = video_service.get_video_metadata(filepath)
    video = repo.create_video(
        file_path=filepath,
        file_name=file.filename,  # type: ignore[arg-type]
        duration=meta.get("duration"),
        fps=meta.get("fps"),
        total_frames=meta.get("total_frames"),
        width=meta.get("width"),
        height=meta.get("height"),
    )
    repo.db.commit()

    return APIResponse(data=VideoOut.model_validate(video).model_dump(by_alias=True))


@router.get("/videos")
def list_videos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, validation_alias="pageSize"),
    repo: VideoRepository = Depends(_get_video_repo),
) -> APIResponse:
    items, total = repo.list_videos(page=page, page_size=page_size)
    return APIResponse(
        data=[VideoOut.model_validate(v).model_dump(by_alias=True) for v in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/videos/{video_id}")
def get_video(
    video_id: UUID,
    repo: VideoRepository = Depends(_get_video_repo),
) -> APIResponse:
    video = repo.get_video(video_id)
    if not video:
        raise NotFoundError("Video", video_id)
    return APIResponse(data=VideoOut.model_validate(video).model_dump(by_alias=True))


@router.post("/videos/{video_id}/extract-keyframes")
def extract_keyframes(
    video_id: UUID,
    body: ExtractKeyframesIn,
    repo: VideoRepository = Depends(_get_video_repo),
) -> APIResponse:
    video = repo.get_video(video_id)
    if not video:
        raise NotFoundError("Video", video_id)

    repo.update_video_status(video_id, "extracting")
    repo.db.commit()

    try:
        frames = video_service.extract_keyframes(
            video.file_path,
            method=body.method,
            threshold=body.threshold,
            interval_seconds=body.interval_seconds,
            max_frames=body.max_frames,
            ssim_threshold=body.ssim_threshold,
        )
    except Exception as exc:
        repo.update_video_status(video_id, "error")
        repo.db.commit()
        logger.exception("Keyframe extraction failed")
        raise HTTPException(500, detail=f"Extraction failed: {exc}") from exc

    repo.delete_all_keyframes(video_id)
    repo.add_keyframes(video_id, frames)
    repo.update_video_status(video_id, "completed")
    repo.db.commit()

    # Refresh to include keyframes
    video = repo.get_video(video_id)
    return APIResponse(data=VideoOut.model_validate(video).model_dump(by_alias=True))


@router.get("/videos/{video_id}/file")
def get_video_file(
    video_id: UUID,
    repo: VideoRepository = Depends(_get_video_repo),
):
    """Serve the original uploaded video file."""
    from fastapi.responses import FileResponse

    video = repo.get_video(video_id)
    if not video:
        raise NotFoundError("Video", video_id)
    path = Path(video.file_path)
    if not path.exists():
        raise HTTPException(404, "Video file not found on disk")
    return FileResponse(str(path), media_type="video/mp4")


@router.get("/videos/{video_id}/keyframes/{keyframe_id}/image")
def get_keyframe_image(
    video_id: UUID,
    keyframe_id: UUID,
    repo: VideoRepository = Depends(_get_video_repo),
):
    from fastapi.responses import FileResponse

    video = repo.get_video(video_id)
    if not video:
        raise NotFoundError("Video", video_id)

    for kf in video.keyframes:
        if kf.id == keyframe_id:
            path = Path(kf.image_path)
            if not path.exists():
                raise HTTPException(404, "Keyframe image file not found")
            return FileResponse(str(path))

    raise NotFoundError("KeyFrame", keyframe_id)


@router.post("/videos/{video_id}/delete", status_code=204)
def delete_video(
    video_id: UUID,
    repo: VideoRepository = Depends(_get_video_repo),
) -> None:
    video = repo.get_video(video_id)
    if not video:
        raise NotFoundError("Video", video_id)

    # Clean up video file
    try:
        Path(video.file_path).unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not delete video file: %s", video.file_path)

    # Clean up keyframe images
    for kf in video.keyframes:
        with contextlib.suppress(OSError):
            Path(kf.image_path).unlink(missing_ok=True)

    repo.delete_video(video)
    repo.db.commit()
