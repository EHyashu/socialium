"""Notification schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: str
    title: str
    body: str | None
    is_read: bool
    action_url: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationCount(BaseModel):
    total: int
    unread: int
