"""Approvals router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.approval import Approval
from app.models.content import Content
from app.core.constants import ApprovalAction, ContentStatus

router = APIRouter()


@router.get("/")
async def list_approvals(
    content_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List approvals, optionally filtered by content."""
    query = select(Approval)
    if content_id:
        query = query.where(Approval.content_id == content_id)
    query = query.order_by(Approval.created_at.desc())
    result = await db.execute(query)
    approvals = result.scalars().all()
    return [
        {
            "id": str(a.id),
            "content_id": str(a.content_id),
            "reviewer_id": str(a.reviewer_id),
            "action": a.action.value,
            "comment": a.comment,
            "created_at": a.created_at.isoformat(),
        }
        for a in approvals
    ]


@router.post("/")
async def create_approval(
    content_id: uuid.UUID,
    action: str,
    comment: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Submit an approval decision on content."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    try:
        approval_action = ApprovalAction(action)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid approval action")

    approval = Approval(
        content_id=content_id,
        reviewer_id=uuid.uuid4(),  # TODO: get from auth
        action=approval_action,
        comment=comment,
    )
    db.add(approval)

    # Update content status based on approval action
    status_map = {
        ApprovalAction.APPROVE: ContentStatus.APPROVED,
        ApprovalAction.REJECT: ContentStatus.REJECTED,
        ApprovalAction.REQUEST_CHANGES: ContentStatus.DRAFT,
    }
    content.status = status_map[approval_action]

    await db.commit()
    return {"status": "ok", "action": action}
