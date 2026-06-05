"""add_model_type_to_detections

Revision ID: 04f67c773c3f
Revises: edb779c5d941
Create Date: 2026-06-05 23:43:46.500825
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = '04f67c773c3f'
down_revision: Union[str, None] = 'edb779c5d941'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("detections", sa.Column("model_type", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("detections", "model_type")
