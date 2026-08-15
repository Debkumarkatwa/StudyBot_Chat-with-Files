import uuid
import logging
import asyncio

from app.database import AsyncSessionLocal
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk
from app.parsing import extract_text
from app.chunking import chunk_text
from app.embeddings import generate_embeddings
from sqlalchemy import select

logger = logging.getLogger(__name__)


async def process_document_pipeline(document_id: uuid.UUID, file_bytes: bytes, mime_type: str) -> None:
    """
    Full processing pipeline for a single uploaded document:
    extract text -> chunk -> embed -> save Chunk rows -> flip status to 'active'.

    On any failure, the document's status is set to 'failed' rather than
    left silently stuck at 'processing' — this is what makes errors visible.

    IMPORTANT: this function creates its OWN DB session (AsyncSessionLocal)
    rather than reusing a request-scoped session. This is required because
    when called as a background task, the original request (and its `db`
    dependency) may already be closed by the time this actually runs.
    """
    async with AsyncSessionLocal() as db:
        try:
            text = await asyncio.to_thread(extract_text, file_bytes, mime_type)
            if not text.strip():
                raise ValueError("No text could be extracted from this document.")

            chunks = await asyncio.to_thread(chunk_text, text)
            if not chunks:
                raise ValueError("Document produced zero chunks after splitting.")

            embeddings = await asyncio.to_thread(generate_embeddings, chunks)

            # 4. Save Chunk rows
            chunk_rows = [
                Chunk(
                    document_id=document_id,
                    content=chunk_content,
                    embedding=embedding,
                    chunk_index=i,
                )
                for i, (chunk_content, embedding) in enumerate(zip(chunks, embeddings))
            ]
            db.add_all(chunk_rows)

            # 5. Flip status to active
            result = await db.execute(select(Document).where(Document.id == document_id))
            document = result.scalar_one()
            document.status = DocumentStatus.active

            await db.commit()
            logger.info(f"Document {document_id} processed successfully: {len(chunks)} chunks created.")

        except Exception as e:
            # Something in the pipeline broke — roll back any partial writes
            # from THIS attempt, then mark the document as failed so it's
            # visible rather than stuck at 'processing' forever.
            await db.rollback()
            logger.error(f"Document {document_id} processing failed: {e}")

            result = await db.execute(select(Document).where(Document.id == document_id))
            document = result.scalar_one_or_none()
            if document is not None:
                document.status = DocumentStatus.failed
                await db.commit()