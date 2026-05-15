"""ABTest model — A/B testing for content variants."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, Uuid, func
from sqlalchemy.types import JSON as JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ABTest(Base):
    __tablename__ = "ab_tests"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("workspaces.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    variant_a_content_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("contents.id"), nullable=False
    )
    variant_b_content_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("contents.id"), nullable=False
    )
    winning_variant: Mapped[str | None] = mapped_column(String(1))  # "A" or "B"
    result_data: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
