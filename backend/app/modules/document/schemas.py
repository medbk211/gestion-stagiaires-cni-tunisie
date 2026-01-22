from  pydantic import BaseModel
from app.shared.enums import DocumentTypeEnum
from datetime import datetime


class DocumentCreate(BaseModel):
    type: DocumentTypeEnum
    file_path: str   

class DocumentRead(BaseModel):
    id: int
    type: DocumentTypeEnum
    file_path: str
    created_at: datetime

    class Config:
        from_attributes = True