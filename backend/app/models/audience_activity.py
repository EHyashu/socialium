"""Audience Activity Snapshot model — persists engagement patterns per time slot."""

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Integer, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AudienceActivitySnapshot(Base):
    __tablename__ = "audience_activity_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    platform: Mapped[str | None] = mapped_column(String(50))
    day_of_week: Mapped[int | None] = mapped_column(Integer)  # 0=Mon, 6=Sun
    hour: Mapped[int | None] = mapped_column(Integer)  # 0-23 UTC
    avg_engagement_rate: Mapped[float | None] = mapped_column(Numeric(5, 2))
    post_count: Mapped[int | None] = mapped_column(Integer, default=0)
    snapshot_date: Mapped[date] = mapped_column(
        Date, server_default=func.current_date()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint(
            "workspace_id", "platform", "day_of_week", "hour", "snapshot_date",
            name="uq_activity_snapshot_slot",
        ),
    )
