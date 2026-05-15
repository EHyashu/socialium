"""User model — mirrors Supabase Auth user."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import SubscriptionTier
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(100), unique=True)
    full_name: Mapped[str | None] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier), default=SubscriptionTier.FREE
    )
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    workspaces: Mapped[list["Workspace"]] = relationship(
        "Workspace", back_populates="owner", lazy="selectin"
    )
    memberships: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="user", lazy="selectin"
    )
    platform_accounts: Mapped[list["PlatformAccount"]] = relationship(
        "PlatformAccount", back_populates="user", lazy="selectin"
    )
    contents: Mapped[list["Content"]] = relationship(
        "Content", back_populates="author", lazy="selectin"
    )
    approval_decisions: Mapped[list["Approval"]] = relationship(
        "Approval", back_populates="reviewer", lazy="selectin"
    )
