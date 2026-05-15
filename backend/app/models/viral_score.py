"""Viral Score model — persists viral potential scoring history."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ViralScore(Base):
    __tablename__ = "viral_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    draft_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("contents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    platform: Mapped[str | None] = mapped_column(String(50))
    total_score: Mapped[int | None] = mapped_column(Integer)
    hook_score: Mapped[int | None] = mapped_column(Integer)
    emotion_score: Mapped[int | None] = mapped_column(Integer)
    trend_score: Mapped[int | None] = mapped_column(Integer)
    historical_score: Mapped[int | None] = mapped_column(Integer)
    uniqueness_score: Mapped[int | None] = mapped_column(Integer)
    algorithm_score: Mapped[int | None] = mapped_column(Integer)
    viral_probability: Mapped[str | None] = mapped_column(String(20))
    recommendation: Mapped[str | None] = mapped_column(Text)
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
