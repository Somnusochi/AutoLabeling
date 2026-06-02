"""add_train_val_ratio_task_type

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-03 01:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('training_jobs', sa.Column('train_ratio', sa.Float(), nullable=False, server_default='0.7'))
    op.add_column('training_jobs', sa.Column('val_ratio', sa.Float(), nullable=False, server_default='0.2'))
    op.add_column('training_jobs', sa.Column('task_type', sa.String(length=16), nullable=False, server_default='detect'))


def downgrade() -> None:
    op.drop_column('training_jobs', 'task_type')
    op.drop_column('training_jobs', 'val_ratio')
    op.drop_column('training_jobs', 'train_ratio')
