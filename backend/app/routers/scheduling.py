"""Scheduling router."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Content
from app.core.constants import ContentStatus

router = APIRouter()


@router.get("/")
async def list_scheduled(db: AsyncSession = Depends(get_db)):
    """List all scheduled content."""
    result = await db.execute(
        select(Content)
        .where(Content.status == ContentStatus.SCHEDULED)
        .order_by(Content.scheduled_at.asc())
    )
    contents = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "platform": c.platform.value if c.platform else None,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "status": c.status.value,
        }
        for c in contents
    ]


@router.post("/{content_id}/schedule")
async def schedule_content(
    content_id: uuid.UUID,
    scheduled_at: datetime,
    db: AsyncSession = Depends(get_db),
):
    """Schedule content for publishing."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.scheduled_at = scheduled_at
    content.status = ContentStatus.SCHEDULED
    await db.commit()
    return {"status": "ok", "scheduled_at": scheduled_at.isoformat()}


@router.post("/{content_id}/publish-now")
async def publish_now(content_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Publish content immediately."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    content.status = ContentStatus.PUBLISHED
    content.published_at = datetime.utcnow()
    await db.commit()
    return {"status": "ok", "message": "Content published"}
