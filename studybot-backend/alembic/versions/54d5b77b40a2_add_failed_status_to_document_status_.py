"""add failed status to document_status enum

Revision ID: 54d5b77b40a2
Revises: 94cb446b0564
Create Date: 2026-08-08 12:26:13.407545

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '54d5b77b40a2'
down_revision: Union[str, Sequence[str], None] = '94cb446b0564'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE document_status ADD VALUE 'failed'")
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
