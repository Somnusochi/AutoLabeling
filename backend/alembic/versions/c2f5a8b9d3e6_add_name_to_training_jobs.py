"""add_name_to_training_jobs

Revision ID: c2f5a8b9d3e6
Revises: edb779c5d941
Create Date: 2026-06-08 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision: str = 'c2f5a8b9d3e6'
down_revision: Union[str, None] = '04f67c773c3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('training_jobs', sa.Column('name', sa.String(128), nullable=True))


def downgrade() -> None:
    op.drop_column('training_jobs', 'name')
