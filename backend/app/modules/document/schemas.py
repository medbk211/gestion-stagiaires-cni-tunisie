from datetime import datetime

from pydantic import BaseModel

from app.shared.enums import DocumentTypeEnum


class DocumentCreate(BaseModel):
    type: DocumentTypeEnum
    file_path: str


class DocumentRead(BaseModel):
    id: int
    type: DocumentTypeEnum
    file_path: str
    created_at: datetime
    status: str = 'pending'
    review_comment: str | None = None
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None

    class Config:
        from_attributes = True


class DocumentStatusUpdate(BaseModel):
    status: str
    comment: str | None = None
