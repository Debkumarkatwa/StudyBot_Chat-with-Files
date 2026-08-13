import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.document import DocumentStatus


class DocumentResponse(BaseModel):
    id: uuid.UUID
    filename: str
    file_type: str
    file_size: int | None
    status: DocumentStatus
    uploaded_at: datetime
    deleted_at: datetime | None

    class Config:
        from_attributes = True