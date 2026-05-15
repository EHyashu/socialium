"""Content model — social media posts."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.types import JSON as JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ContentStatus, ContentTone, Platform, SourceType
from app.database import Base


class Content(Base):
    __tablename__ = "contents"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    platform: Mapped[Platform | None] = mapped_column(Enum(Platform))
    status: Mapped[ContentStatus] = mapped_column(
        Enum(ContentStatus), default=ContentStatus.DRAFT, index=True
    )
    tone: Mapped[ContentTone | None] = mapped_column(Enum(ContentTone))
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType), default=SourceType.MANUAL
    )
    title: Mapped[str | None] = mapped_column(String(500))
    body: Mapped[str | None] = mapped_column(Text)
    image_urls: Mapped[dict | None] = mapped_column(JSONB)
    hashtags: Mapped[list | None] = mapped_column(JSONB)
    mentions: Mapped[list | None] = mapped_column(JSONB)
    link_url: Mapped[str | None] = mapped_column(String(2000))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    platform_post_id: Mapped[str | None] = mapped_column(String(200))
    ai_prompt_used: Mapped[str | None] = mapped_column(Text)
    ai_model_used: Mapped[str | None] = mapped_column(String(100))
    quality_score: Mapped[int | None] = mapped_column(Integer)
    engagement_count: Mapped[int] = mapped_column(Integer, default=0)
    like_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    share_count: Mapped[int] = mapped_column(Integer, default=0)
    ab_test_group: Mapped[str | None] = mapped_column(String(50))
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="contents")
    author: Mapped["User"] = relationship("User", back_populates="contents")
    approvals: Mapped[list["Approval"]] = relationship(
        "Approval", back_populates="content", lazy="selectin"
    )
