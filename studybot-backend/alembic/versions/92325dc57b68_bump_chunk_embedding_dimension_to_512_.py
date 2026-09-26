"""bump chunk embedding dimension to 512 for jina v5

Revision ID: 92325dc57b68
Revises: 1a95e75f2f93
Create Date: 2026-08-18 06:08:37.122170

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '92325dc57b68'
down_revision: Union[str, Sequence[str], None] = '1a95e75f2f93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # No production data exists yet — truncate rather than attempting an
    # incompatible vector(384) -> vector(512) cast on existing rows.
    op.execute("TRUNCATE TABLE chunks")

    op.drop_index(
        "ix_chunks_embedding_hnsw",
        table_name="chunks",
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(512)")
    op.create_index(
        "ix_chunks_embedding_hnsw",
        "chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("TRUNCATE TABLE chunks")

    op.drop_index(
        "ix_chunks_embedding_hnsw",
        table_name="chunks",
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
    op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(384)")
    op.create_index(
        "ix_chunks_embedding_hnsw",
        "chunks",
        ["embedding"],
        unique=False,
        postgresql_using="hnsw",
        postgresql_with={"m": 16, "ef_construction": 64},
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )
