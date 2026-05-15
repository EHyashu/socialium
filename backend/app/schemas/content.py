"""Content schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.constants import ContentStatus, ContentTone, Platform, SourceType


class ContentCreate(BaseModel):
    workspace_id: uuid.UUID
    platform: Platform | None = None
    tone: ContentTone | None = None
    title: str | None = Field(default=None, max_length=500)
    body: str | None = None
    image_urls: dict | None = None
    hashtags: list[str] | None = None
    mentions: list[str] | None = None
    link_url: str | None = None
    scheduled_at: datetime | None = None


class ContentUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    body: str | None = None
    tone: ContentTone | None = None
    hashtags: list[str] | None = None
    mentions: list[str] | None = None
    link_url: str | None = None
    image_urls: dict | None = None
    scheduled_at: datetime | None = None


class ContentGenerateRequest(BaseModel):
    workspace_id: uuid.UUID
    platforms: list[Platform] = Field(default_factory=lambda: [Platform.LINKEDIN])
    tone: ContentTone = ContentTone.PROFESSIONAL
    topic: str | None = None
    keywords: list[str] | None = None
    target_audience: str | None = None
    source_text: str | None = None
    source_url: str | None = None
    max_length: int = 500
    creativity: int = Field(default=50, ge=0, le=100)
    content_length: str = "medium"  # short / medium / long
    include_hashtags: bool = True
    include_emojis: bool = True
    include_mentions: bool = False
    generate_variants: bool = False
    trend_boost: bool = False
    trend_industry: str | None = None
    trend_keywords: list[str] | None = None

    # Backward-compat: allow single `platform` field
    platform: Platform | None = None

    def get_platforms(self) -> list[Platform]:
        if self.platform and self.platform not in self.platforms:
            return [self.platform]
        return self.platforms


class ContentApprovalRequest(BaseModel):
    action: str  # approve / reject / request_changes
    comment: str | None = None


class ContentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    author_id: uuid.UUID
    platform: Platform | None
    status: ContentStatus
    tone: ContentTone | None
    source_type: SourceType
    title: str | None
    body: str | None
    image_urls: dict | None
    hashtags: list | None
    mentions: list | None
    link_url: str | None
    scheduled_at: datetime | None
    published_at: datetime | None
    ai_prompt_used: str | None
    ai_model_used: str | None
    quality_score: int | None
    engagement_count: int
    like_count: int
    comment_count: int
    share_count: int
    ab_test_group: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
