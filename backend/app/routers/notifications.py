"""Notifications router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import Notification

router = APIRouter()


@router.get("/")
async def list_notifications(
    user_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List notifications."""
    query = select(Notification).order_by(Notification.created_at.desc())
    if user_id:
        query = query.where(Notification.user_id == user_id)
    result = await db.execute(query)
    notifications = result.scalars().all()
    return [
        {
            "id": str(n.id),
            "user_id": str(n.user_id),
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "action_url": n.action_url,
            "created_at": n.created_at.isoformat(),
        }
        for n in notifications
    ]


@router.get("/count")
async def unread_count(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get unread notification count."""
    total_result = await db.execute(
        select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
    )
    unread_result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)
    )
    return {
        "total": total_result.scalar() or 0,
        "unread": unread_result.scalar() or 0,
    }


@router.post("/{notification_id}/read")
async def mark_read(notification_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Mark notification as read."""
    notification = await db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"status": "ok"}
