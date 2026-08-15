from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.user import User
from app.models.document import Document, DocumentStatus
from app.schemas.document import DocumentResponse
from app.dependencies import get_current_user
from app.storage import build_storage_path, upload_file, delete_file
from app.config import ALLOWED_MIME_TYPES, MAX_ACTIVE_DOCUMENTS, MAX_FILE_SIZE, MAX_BIN_DOCUMENTS, RECYCLE_BIN_RETENTION_DAYS
from app.processing import process_document_pipeline

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
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
    await db.commit()
    await db.refresh(new_document)

    # --- 6. Trigger the parse -> chunk -> embed pipeline ---
    #
    # PRIMARY (active): background execution via FastAPI's BackgroundTasks.
    # The upload request returns immediately with status 'processing';
    # the user/frontend can poll or refresh to see when it flips to 'active'.
    # Trade-off: no persistence/retry if the server restarts mid-task —
    # acceptable at solo-project scale, revisit with a real task queue
    # (Celery/arq + Redis) if this ever needs to be production-grade.
    background_tasks.add_task(process_document_pipeline, new_document.id, file_bytes, file.content_type)

    # ALTERNATIVE (commented out): synchronous execution.
    # Uncomment this line and comment out the background_tasks line above
    # to switch to synchronous processing — the upload request will then
    # wait until parsing/chunking/embedding fully completes before
    # returning a response (document will come back as 'active' or
    # 'failed' immediately, never 'processing').
    #
    # await process_document_pipeline(new_document.id, file_bytes, file.content_type)

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
            delete_file(doc.storage_path)
        except Exception:
            # Don't let a storage hiccup block the DB purge — an orphaned
            # storage file is cheap; a bin stuck past its retention isn't.
            pass
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
    for document in result.scalars().all():
        try:
            await asyncio.to_thread(delete_file, document.storage_path)
        except Exception:
            pass  # bulk clear shouldn't halt on one bad file
        await db.delete(document)

    await db.commit()


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
                pass
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

    document.status = DocumentStatus.active
    document.deleted_at = None
    await db.commit()
    await db.refresh(document)
    return document

