from datetime import datetime

from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    title: str
    message: str
    category: str
    payload: str | None = None
    created_at: datetime
    read_at: datetime | None = None

    class Config:
        from_attributes = True


class NotificationUnreadCount(BaseModel):
    unread_count: int
