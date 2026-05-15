"""Async database engine and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy import JSON
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Determine if we're using SQLite
is_sqlite = settings.database_url.startswith("sqlite")

engine_kwargs: dict = {
    "echo": settings.database_echo,
}
if not is_sqlite:
    engine_kwargs.update(pool_pre_ping=True, pool_size=20, max_overflow=10)

engine = create_async_engine(settings.database_url, **engine_kwargs)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency that provides an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
