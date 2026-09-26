"""widen documents.file_type column to varchar 255

Revision ID: 2e14e02c5a16
Revises: 92325dc57b68
Create Date: 2026-08-26 17:32:27.704320

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e14e02c5a16'
down_revision: Union[str, Sequence[str], None] = '92325dc57b68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('documents', 'file_type', type_=sa.String(255))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('documents', 'file_type', type_=sa.String(50))
