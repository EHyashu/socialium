"""Trend model — detected social media trends."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text, Uuid, func
from sqlalchemy.types import JSON as JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Trend(Base):
    __tablename__ = "trends"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    keyword: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    volume_score: Mapped[float] = mapped_column(Float, default=0.0)
    sentiment_score: Mapped[float] = mapped_column(Float, default=0.0)
    related_hashtags: Mapped[list | None] = mapped_column(JSONB)
    source_data: Mapped[dict | None] = mapped_column(JSONB)
    detected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
