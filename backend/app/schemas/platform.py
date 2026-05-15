"""Platform & OAuth schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.constants import Platform


class PlatformAccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    platform: Platform
    platform_user_id: str
    platform_username: str | None
    is_active: bool
    connected_at: datetime
    last_synced_at: datetime | None

    model_config = {"from_attributes": True}


class OAuthURLResponse(BaseModel):
    authorization_url: str


class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class OAuthCallbackResponse(BaseModel):
    success: bool
    platform: Platform
    platform_username: str | None
    message: str
