import uuid

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=10000)
    hybrid: bool | None = None  # None = fall back to HYBRID_MODE_ENABLED env default
    document_ids: list[uuid.UUID] | None = Field(default=None, max_length=50)  # None = search all active documents


class SourceInfo(BaseModel):
    filename: str
    chunk_preview: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]
    hybrid_used: bool  # tells frontend what was actually applied, for the source-tag UI