"""add_video_tables

Revision ID: a1b2c3d4e5f6
Revises: 5baeca04aab3
Create Date: 2026-06-02 20:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = '5baeca04aab3'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('videos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('file_path', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(length=512), nullable=False),
        sa.Column('duration', sa.Float(), nullable=True),
        sa.Column('fps', sa.Float(), nullable=True),
        sa.Column('total_frames', sa.Integer(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_videos_created_at', 'videos', ['created_at'], unique=False)
    op.create_index('ix_videos_status', 'videos', ['status'], unique=False)

    op.create_table('keyframes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('video_id', sa.UUID(), nullable=False),
        sa.Column('frame_number', sa.Integer(), nullable=False),
        sa.Column('timestamp_seconds', sa.Float(), nullable=False),
        sa.Column('image_path', sa.Text(), nullable=False),
        sa.Column('scene_score', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['video_id'], ['videos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_keyframes_video_id', 'keyframes', ['video_id'], unique=False)
    op.create_index('ix_keyframes_frame_number', 'keyframes', ['video_id', 'frame_number'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_keyframes_frame_number', table_name='keyframes')
    op.drop_index('ix_keyframes_video_id', table_name='keyframes')
    op.drop_table('keyframes')
    op.drop_index('ix_videos_status', table_name='videos')
    op.drop_index('ix_videos_created_at', table_name='videos')
    op.drop_table('videos')
