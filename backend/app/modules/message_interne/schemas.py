from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.shared.enums import RoleEnum


class CommunicationContact(BaseModel):
    id: int
    nom: str
    prenom: str
    email: Optional[str] = None
    role: RoleEnum

    model_config = ConfigDict(from_attributes=True)


class MessageRead(BaseModel):
    id: int
    sender_id: int
    recipient_id: int
    subject: str
    content: str
    sent_at: datetime
    is_read: bool
    is_mine: bool


class ConversationRead(BaseModel):
    contact: CommunicationContact
    last_message: Optional[MessageRead] = None
    unread_count: int = 0


class ConversationThreadRead(BaseModel):
    contact: CommunicationContact
    messages: list[MessageRead]


class MessageCreate(BaseModel):
    recipient_id: int = Field(gt=0)
    subject: Optional[str] = Field(default=None, max_length=255)
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("subject")
    @classmethod
    def normalize_subject(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Message vide")
        return cleaned
