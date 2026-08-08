from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.document import Document, DocumentStatus
from app.schemas.document import DocumentResponse
from app.dependencies import get_current_user
from app.storage import build_storage_path, upload_file
from app.config import ALLOWED_MIME_TYPES, MAX_ACTIVE_DOCUMENTS, MAX_FILE_SIZE
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
        upload_file(storage_path, file_bytes, file.content_type)
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
        status=DocumentStatus.processing,  # will flip to 'active' once parsing/chunking/embedding is done
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