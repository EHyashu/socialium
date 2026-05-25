"""Approvals router."""

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.approval import Approval
from app.models.content import Content
from app.models.user import User
from app.core.constants import ApprovalAction, ContentStatus
from app.core.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def list_approvals(
    workspace_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List content awaiting approval."""
    query = (
        select(Content, User)
        .join(User, Content.author_id == User.id, isouter=True)
        .where(Content.status == ContentStatus.PENDING_APPROVAL)
    )
    if workspace_id and workspace_id.strip():
        try:
            workspace_uuid = uuid.UUID(workspace_id)
            query = query.where(Content.workspace_id == workspace_uuid)
            logger.info(f"Filtering approvals by workspace: {workspace_uuid}")
        except ValueError:
            logger.warning(f"Invalid workspace_id format: {workspace_id}")
    else:
        logger.info("No workspace_id provided, returning all pending approvals")
    query = query.order_by(Content.created_at.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    logger.info(f"Found {len(rows)} pending approvals")
    
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "body": c.body[:200] + "..." if c.body and len(c.body) > 200 else c.body,
            "platform": c.platform.value if c.platform else "unknown",
            "status": c.status.value,
            "author_email": u.email if u else None,
            "created_at": c.created_at.isoformat(),
        }
        for c, u in rows
    ]


@router.post("/")
async def create_approval(
    content_id: uuid.UUID,
    action: str,
    comment: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
        reviewer_id=current_user.id,
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
    
    # If approved, trigger AI auto-scheduling
    if approval_action == ApprovalAction.APPROVE:
        try:
            from app.services.ai_scheduler_service import AISchedulerService
            scheduler = AISchedulerService()
            schedule_result = await scheduler.auto_schedule_draft(
                content_id=str(content_id),
                workspace_id=str(content.workspace_id),
                db=db,
            )
            await db.commit()
            
            logger.info(f"Auto-scheduled content {content_id}: {schedule_result.scheduled_at}")
            
            return {
                "status": "ok",
                "action": action,
                "auto_scheduled": schedule_result.scheduled_at is not None,
                "scheduled_at": schedule_result.scheduled_at.isoformat() if schedule_result.scheduled_at else None,
            }
        except Exception as e:
            logger.error(f"Auto-scheduling failed for {content_id}: {e}", exc_info=True)
            # Still commit the approval even if scheduling fails
            await db.commit()
            return {
                "status": "ok",
                "action": action,
                "auto_scheduled": False,
                "reason": f"Scheduling failed: {str(e)}",
            }
    
    await db.commit()
    return {"status": "ok", "action": action}
