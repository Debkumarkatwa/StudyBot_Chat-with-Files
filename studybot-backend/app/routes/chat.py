from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.dependencies import get_current_user
from app.retrieval import retrieve_relevant_chunks
from app.llm import generate_answer, is_hybrid_answer, LLMUnavailableError
from app.schemas.chat import ChatRequest, ChatResponse, SourceInfo
from app.config import HYBRID_MODE_ENABLED

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/ask", response_model=ChatResponse)
async def ask_question(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # payload.hybrid omitted (None) -> fall back to the .env default
    effective_hybrid = payload.hybrid if payload.hybrid is not None else HYBRID_MODE_ENABLED

    results = await retrieve_relevant_chunks(
        db, current_user.id, payload.question, document_ids=payload.document_ids
    )

    chunks_with_sources = [(chunk.content, filename) for chunk, filename in results]
    try:
        answer = await generate_answer(payload.question, chunks_with_sources, effective_hybrid)
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI service is temporarily unavailable. Please try again in a moment.",
        ) from exc
    hybrid_used = effective_hybrid and is_hybrid_answer(answer)

    sources = [
        SourceInfo(filename=filename, chunk_preview=chunk.content[:150])
        for chunk, filename in results
    ]

    return ChatResponse(answer=answer, sources=sources, hybrid_used=hybrid_used)