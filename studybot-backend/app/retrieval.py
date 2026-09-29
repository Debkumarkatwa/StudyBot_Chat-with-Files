import uuid
import asyncio

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chunk import Chunk
from app.models.document import Document, DocumentStatus
from app.embeddings_jina import embed_query
from app.config import CHAT_MAX_COSINE_DISTANCE, CHAT_TOP_K


async def retrieve_relevant_chunks(
    db: AsyncSession,
    user_id: uuid.UUID,
    question: str,
    document_ids: list[uuid.UUID] | None = None,
) -> list[tuple[Chunk, str]]:
    """
    Embeds the question and retrieves the top-K most similar chunks,
    scoped STRICTLY to documents owned by user_id with status='active'.

    If document_ids is provided, further restricts retrieval to just
    those documents (still re-checked against owner_id + active status —
    a user can't scope into someone else's document by passing its id).
    """
    query_embedding = await asyncio.to_thread(embed_query, question)

    filters = [
        Document.owner_id == user_id,
        Document.status == DocumentStatus.active,
    ]

    if document_ids:
        filters.append(Document.id.in_(document_ids))

    distance = Chunk.embedding.cosine_distance(query_embedding)

    await db.execute(text("SET LOCAL hnsw.iterative_scan = strict_order"))
    result = await db.execute(
        select(Chunk, Document.filename)
        .join(Document, Chunk.document_id == Document.id)
        .where(*filters, distance <= CHAT_MAX_COSINE_DISTANCE)
        .order_by(distance)
        .limit(CHAT_TOP_K)
    )

    return result.all()