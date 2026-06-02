"""Video data-access layer."""
from __future__ import annotations

import uuid
from typing import Sequence

from sqlalchemy.orm import Session, joinedload

from ..models.video import KeyFrame, Video


class VideoRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ── Video ──────────────────────────────────────

    def create_video(
        self,
        *,
        file_path: str,
        file_name: str,
        duration: float | None = None,
        fps: float | None = None,
        total_frames: int | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> Video:
        video = Video(
            file_path=file_path,
            file_name=file_name,
            duration=duration,
            fps=fps,
            total_frames=total_frames,
            width=width,
            height=height,
        )
        self.db.add(video)
        self.db.flush()
        return video

    def get_video(self, video_id: str) -> Video | None:
        return (
            self.db.query(Video)
            .options(joinedload(Video.keyframes))
            .filter(Video.id == video_id)
            .first()
        )

    def list_videos(self, *, page: int = 1, page_size: int = 20) -> tuple[Sequence[Video], int]:
        q = self.db.query(Video).options(joinedload(Video.keyframes))
        total = q.count()
        items = (
            q.order_by(Video.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return items, total

    def update_video_status(self, video_id: str, status: str) -> None:
        video = self.db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.status = status
            self.db.flush()

    def delete_video(self, video: Video) -> None:
        self.db.delete(video)
        self.db.flush()

    # ── KeyFrames ──────────────────────────────────

    def add_keyframes(self, video_id: str, frames: list[dict]) -> list[KeyFrame]:
        entities = [
            KeyFrame(
                video_id=video_id,
                frame_number=f["frame_number"],
                timestamp_seconds=f["timestamp_seconds"],
                image_path=f["image_path"],
                scene_score=f.get("scene_score"),
            )
            for f in frames
        ]
        self.db.add_all(entities)
        self.db.flush()
        return entities

    def get_keyframes(self, video_id: str) -> list[KeyFrame]:
        return (
            self.db.query(KeyFrame)
            .filter(KeyFrame.video_id == video_id)
            .order_by(KeyFrame.frame_number)
            .all()
        )

    def delete_all_keyframes(self, video_id: str) -> None:
        self.db.query(KeyFrame).filter(KeyFrame.video_id == video_id).delete()
        self.db.flush()
