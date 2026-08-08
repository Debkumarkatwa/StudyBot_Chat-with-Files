import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus
from app.embeddings import embed_query
from app.config import CHAT_TOP_K


async def retrieve_relevant_chunks(
    db: AsyncSession, user_id: uuid.UUID, question: str
) -> list[tuple[Chunk, str]]:
    """
    Embeds the question and retrieves the top-K most similar chunks,
    scoped STRICTLY to documents owned by user_id with status='active'.

    This scoping is a hard security requirement, not just a quality
    concern — without it, a user could retrieve chunks from other users'
    private documents.

    Returns a list of (Chunk, filename) tuples — filename included so
    the LLM/response can cite which source document each chunk came from.
    """
    query_embedding = embed_query(question)

    # cosine_distance: pgvector operator, lower = more similar.
    # Our HNSW index uses vector_cosine_ops, so this matches the index.
    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(
            Document.owner_id == user_id,
            Document.status == DocumentStatus.active,
        )
        .order_by(Chunk.embedding.cosine_distance(query_embedding))
        .limit(CHAT_TOP_K)
    )

    return result.all()