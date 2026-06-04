"""add_mask_polygon_to_boxes

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-04 17:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: str | None = 'b2c3d4e5f6a7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('detection_boxes', sa.Column('mask_polygon', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('detection_boxes', 'mask_polygon')
