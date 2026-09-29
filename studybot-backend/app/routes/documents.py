import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.document import Document, DocumentStatus
from app.models.chunk import Chunk
from app.schemas.document import DocumentResponse
from app.dependencies import get_current_user
from app.storage import build_storage_path, upload_file, delete_file
from app.config import ALLOWED_MIME_TYPES, MAX_ACTIVE_DOCUMENTS, MAX_FILE_SIZE, MAX_BIN_DOCUMENTS, RECYCLE_BIN_RETENTION_DAYS
from app.processing import process_document_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):    
    # --- 0. Filename check ---
    if not file.filename or not file.filename.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file must have a name.",
        )
    if len(file.filename) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File name is too long (maximum 255 characters).",
        )
    
    # --- 1. MIME type check ---
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{file.content_type}' is not supported.",
        )

    # --- 2. Read file into memory and check size ---
    # NOTE: for very large files this isn't the most memory-efficient approach
    # (streaming would be better), but for study documents under MAX_FILE_SIZE_MB
    # this is simple and fine at our current scale.
    file_bytes = await file.read(MAX_FILE_SIZE + 1)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the maximum allowed size.",
        )

    # --- 3. Active document count check ---
    # Counts BOTH 'processing' and 'active' — a document isn't "gone" from
    # the user's quota just because it hasn't finished embedding yet.
    count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.owner_id == current_user.id,
            Document.status.in_([DocumentStatus.processing, DocumentStatus.active]),
        )
    )
    active_count = count_result.scalar_one()

    if active_count >= MAX_ACTIVE_DOCUMENTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You've reached the maximum of {MAX_ACTIVE_DOCUMENTS} active documents. "
                   f"Delete or move a document to the recycle bin first.",
        )

    # --- 4. Upload to Supabase Storage ---
    storage_path = build_storage_path(current_user.id, file.filename)
    try:
        await asyncio.to_thread(upload_file, storage_path, file_bytes, file.content_type)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to upload file to storage. Please try again.",
        )

    # --- 5. Create the Document row ---
    new_document = Document(
        owner_id=current_user.id,
        filename=file.filename,
        file_type=file.content_type,
        storage_path=storage_path,
        file_size=len(file_bytes),
        status=DocumentStatus.processing,
    )
    db.add(new_document)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        try:
            await asyncio.to_thread(delete_file, storage_path)
        except Exception:
            logger.exception(
                f"Could not clean up storage file after document commit failure: {storage_path}"
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not save document metadata. Please try uploading again.",
        )
    await db.refresh(new_document)

    # --- 6. Run the parse -> chunk -> embed pipeline synchronously ---
    # The request waits for this to fully complete before responding.
    # Chosen over FastAPI's BackgroundTasks for card-free free-tier hosting
    # (Render), where the process can sleep on idle — a background task
    # started right before sleep would be silently killed mid-run, leaving
    # the document stuck at 'processing' forever with no way to know it
    # failed. Running synchronously means there's no "in-flight background
    # work" to lose: the response only returns once the pipeline has
    # already finished, so a mid-request sleep either finishes the request
    # normally or fails it outright (visible error, not a silent orphan).
    #
    # Trade-off: upload requests are slower (no fire-and-forget), and the
    # frontend never actually sees a 'processing' status from THIS call —
    # the document comes back as already 'active' or 'failed'.
    try:
        await process_document_pipeline(new_document.id, file_bytes, file.content_type)
    except Exception:
        # process_document_pipeline already has its OWN try/except that
        # normally catches pipeline errors (bad parse, embedding API
        # failure, etc.) and flips status -> failed using its own DB
        # session. This outer catch is a safety net for failures OUTSIDE
        # that inner handling — e.g. the pipeline's own DB session failing
        # to even open (a transient Neon connection blip) — which would
        # otherwise leave this document stuck at 'processing' forever with
        # an orphaned file sitting in Supabase Storage.
        logger.exception(
            f"process_document_pipeline crashed outside its own error handling "
            f"for document {new_document.id}"
        )

        # Best-effort: mark the document failed using THIS request's own
        # DB session, so it doesn't stay stuck at 'processing'.
        try:
            new_document.status = DocumentStatus.failed
            await db.commit()
        except Exception:
            logger.exception(
                f"Could not mark document {new_document.id} as failed after pipeline crash"
            )

        # Best-effort: clean up the orphaned Supabase file so it doesn't
        # linger with no usable DB record pointing at it.
        try:
            await asyncio.to_thread(delete_file, storage_path)
        except Exception:
            logger.exception(
                f"Could not clean up orphaned storage file for document {new_document.id}"
            )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Document processing failed. Please try uploading again.",
        )

    # MANDATORY when running synchronously: process_document_pipeline uses
    # its OWN DB session (see processing.py) to flip status -> active/failed.
    # `new_document` here is still bound to THIS request's session, which
    # doesn't know about that write. Without this refresh, the API response
    # would incorrectly report status: "processing" even though the DB
    # already has "active" or "failed".
    await db.refresh(new_document)

    if new_document.status == DocumentStatus.failed:
        try:
            await asyncio.to_thread(delete_file, storage_path)
        except Exception:
            logger.exception(
                f"Could not clean up storage file for failed document {new_document.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Document processing failed. Please try uploading again.",
            )

        await db.delete(new_document)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Document processing failed. Please try uploading again.",
        )

    return new_document


async def _purge_expired_bin_items(db: AsyncSession, owner_id: uuid.UUID) -> None:
    """
    Lazy purge — called at the top of every bin-touching endpoint instead of
    running as a scheduled job. No task queue at solo-project scale, so this
    is the pragmatic tradeoff: bin only gets cleaned when someone actually
    hits a bin endpoint, not on a fixed schedule.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECYCLE_BIN_RETENTION_DAYS)
    result = await db.execute(
        select(Document).where(
            Document.owner_id == owner_id,
            Document.status == DocumentStatus.deleted,
            Document.deleted_at < cutoff,
        )
    )
    expired = result.scalars().all()

    for doc in expired:
        try:
            await asyncio.to_thread(delete_file, doc.storage_path)
        except Exception:
            logger.exception(
                f"Could not purge storage file for expired document {doc.id}; keeping record for retry"
            )
            continue
        await db.delete(doc)

    if expired:
        await db.commit()


@router.get("", response_model=list[DocumentResponse])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document)
        .where(
            Document.owner_id == current_user.id,
            Document.status.in_([DocumentStatus.processing, DocumentStatus.active, DocumentStatus.failed]),
        )
        .order_by(Document.uploaded_at)
    )
    return result.scalars().all()


@router.get("/bin", response_model=list[DocumentResponse])
async def list_bin_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _purge_expired_bin_items(db, current_user.id)

    result = await db.execute(
        select(Document)
        .where(Document.owner_id == current_user.id, Document.status == DocumentStatus.deleted)
        .order_by(Document.deleted_at.desc())
    )
    return result.scalars().all()


@router.delete("/bin/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_from_bin(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.owner_id == current_user.id,
            Document.status == DocumentStatus.deleted,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in Recycle Bin.")

    try:
        await asyncio.to_thread(delete_file, document.storage_path)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to delete file from storage. Please try again.",
        )

    await db.delete(document)  # chunks cascade automatically via FK ondelete
    await db.commit()


@router.delete("/bin", status_code=status.HTTP_204_NO_CONTENT)
async def clear_bin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(Document.owner_id == current_user.id, Document.status == DocumentStatus.deleted)
    )
    failed_documents = []
    for document in result.scalars().all():
        try:
            await asyncio.to_thread(delete_file, document.storage_path)
        except Exception:
            logger.exception(
                f"Could not delete recycle-bin file {document.id}; keeping record for retry"
            )
            failed_documents.append(document.id)
            continue
        await db.delete(document)

    await db.commit()

    if failed_documents:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Could not permanently delete {len(failed_documents)} recycle-bin file(s). "
                "They remain available for retry."
            ),
        )


@router.delete("/{document_id}", response_model=DocumentResponse)
async def soft_delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.owner_id == current_user.id,
            Document.status.in_([DocumentStatus.processing, DocumentStatus.active, DocumentStatus.failed]),
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    await _purge_expired_bin_items(db, current_user.id)

    # Bin capacity check — evict oldest bin item if we're about to overflow,
    # same auto-evict behavior your frontend already had, now enforced server-side.
    bin_count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.owner_id == current_user.id,
            Document.status == DocumentStatus.deleted,
        )
    )
    if bin_count_result.scalar_one() >= MAX_BIN_DOCUMENTS:
        oldest_result = await db.execute(
            select(Document)
            .where(Document.owner_id == current_user.id, Document.status == DocumentStatus.deleted)
            .order_by(Document.deleted_at)
            .limit(1)
        )
        oldest = oldest_result.scalar_one_or_none()
        if oldest is not None:
            try:
                await asyncio.to_thread(delete_file, oldest.storage_path)
            except Exception:
                logger.exception(
                    f"Could not evict oldest recycle-bin file {oldest.id}; refusing to lose its record"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not free recycle-bin space. Please try again later.",
                )
            await db.delete(oldest)

    document.status = DocumentStatus.deleted
    document.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(document)
    return document


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _purge_expired_bin_items(db, current_user.id)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.owner_id == current_user.id,
            Document.status == DocumentStatus.deleted,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found in Recycle Bin.")

    active_count_result = await db.execute(
        select(func.count(Document.id)).where(
            Document.owner_id == current_user.id,
            Document.status.in_([DocumentStatus.processing, DocumentStatus.active]),
        )
    )
    if active_count_result.scalar_one() >= MAX_ACTIVE_DOCUMENTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your active documents are full ({MAX_ACTIVE_DOCUMENTS} max). Remove one before restoring.",
        )

    chunk_count_result = await db.execute(
        select(func.count(Chunk.id)).where(Chunk.document_id == document.id)
    )
    document.status = (
        DocumentStatus.active
        if chunk_count_result.scalar_one() > 0
        else DocumentStatus.failed
    )
    document.deleted_at = None
    await db.commit()
    await db.refresh(document)
    return document

