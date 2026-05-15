"""Workspace schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import WorkspaceRole


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    brand_voice: str | None = None
    brand_colors: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    brand_voice: str | None = None
    brand_colors: str | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    owner_id: uuid.UUID
    brand_voice: str | None
    brand_colors: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceMemberAdd(BaseModel):
    email: str
    role: WorkspaceRole = WorkspaceRole.EDITOR


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: WorkspaceRole
    invited_email: str | None
    joined_at: datetime

    model_config = {"from_attributes": True}
