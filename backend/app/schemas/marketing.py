"""Trend & AB Testing schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TrendResponse(BaseModel):
    id: uuid.UUID
    keyword: str
    platform: str
    description: str | None
    volume_score: float
    sentiment_score: float
    related_hashtags: list | None
    detected_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}


class ABTestCreate(BaseModel):
    workspace_id: uuid.UUID
    name: str = Field(max_length=200)
    description: str | None = None
    variant_a_body: str
    variant_b_body: str
    platform: str


class ABTestResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    description: str | None
    variant_a_content_id: uuid.UUID
    variant_b_content_id: uuid.UUID
    winning_variant: str | None
    is_active: bool
    started_at: datetime
    ended_at: datetime | None

    model_config = {"from_attributes": True}
