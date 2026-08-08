from pydantic import BaseModel

class ChatRequest(BaseModel):
    question: str

class SourceInfo(BaseModel):
    filename: str
    chunk_preview: str

class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceInfo]