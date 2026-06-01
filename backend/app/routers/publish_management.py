"""Publish management router — view failure reasons and retry failed publishes."""

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Content
from app.models.user import User
from app.core.auth import get_current_user
from app.core.constants import ContentStatus
from app.services.publishing_service import PublishingService
from app.services.publish_failure_classifier import PublishFailureReason

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{content_id}/publish-status")
async def get_publish_status(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed publish status including failure reasons.
    
    Returns:
        - Current status (scheduled, published, failed)
        - Failure reason (if failed)
        - Retry information (count, next retry time)
        - Actionable steps to fix the issue
    """
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if content.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this content")
    
    response = {
        "content_id": str(content.id),
        "status": content.status.value,
        "scheduled_at": content.scheduled_at.isoformat() if content.scheduled_at else None,
        "published_at": content.published_at.isoformat() if content.published_at else None,
        "platform": content.platform.value if content.platform else None,
    }
    
    # Add failure information if applicable
    if content.status == ContentStatus.FAILED or content.publish_failure_reason:
        # Classify the failure if we have a reason
        failure_info = None
        if content.publish_failure_reason:
            # Extract the error message from stored reason
            reason_text = content.publish_failure_reason
            if "]" in reason_text:
                # Format: "[category] reason text"
                error_msg = reason_text.split("]", 1)[1].strip()
                failure_info = PublishFailureReason.classify(error_msg)
        
        response["failure"] = {
            "reason": content.publish_failure_reason,
            "retry_count": content.publish_retry_count,
            "last_retry_at": content.publish_last_retry_at.isoformat() if content.publish_last_retry_at else None,
            "next_retry_at": content.publish_next_retry_at.isoformat() if content.publish_next_retry_at else None,
            "classification": failure_info,
        }
    
    return response


@router.post("/{content_id}/retry-publish")
async def retry_publish(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually retry publishing failed/scheduled content.
    
    This bypasses the scheduled retry time and attempts to publish immediately.
    """
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    if content.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to publish this content")
    
    # Can only retry if status is failed or scheduled
    if content.status not in [ContentStatus.FAILED, ContentStatus.SCHEDULED]:
        raise HTTPException(
            status_code=400,
            detail=f"Can only retry failed or scheduled content. Current status: {content.status.value}"
        )
    
    # Attempt to publish
    publisher = PublishingService()
    try:
        publish_result = await publisher.publish_content(content, db)
        
        if publish_result.get("success"):
            # Success!
            content.status = ContentStatus.PUBLISHED
            content.published_at = datetime.now(timezone.utc)
            content.publish_failure_reason = None
            content.publish_retry_count = 0
            content.publish_next_retry_at = None
            await db.commit()
            
            return {
                "status": "success",
                "message": "Content published successfully",
                "platform_url": publish_result.get("platform_url"),
            }
        else:
            # Failed again - classify the error
            error_message = publish_result.get("error", "Unknown error")
            status_code = publish_result.get("status_code")
            failure_info = PublishFailureReason.classify(error_message, status_code)
            
            # Update failure tracking
            content.publish_failure_reason = f"[{failure_info['category']}] {failure_info['reason']}"
            content.publish_retry_count += 1
            content.publish_last_retry_at = datetime.now(timezone.utc)
            
            if not failure_info.get("retryable", False):
                content.status = ContentStatus.FAILED
            
            await db.commit()
            
            return {
                "status": "failed",
                "message": "Publish failed again",
                "failure_reason": content.publish_failure_reason,
                "classification": failure_info,
                "retry_count": content.publish_retry_count,
            }
            
    except Exception as e:
        await db.rollback()
        
        failure_info = PublishFailureReason.classify(str(e))
        content.publish_failure_reason = f"[EXCEPTION] {str(e)[:200]}"
        content.publish_retry_count += 1
        content.publish_last_retry_at = datetime.now(timezone.utc)
        
        if not failure_info.get("retryable", False):
            content.status = ContentStatus.FAILED
        
        await db.commit()
        
        return {
            "status": "error",
            "message": "Publish attempt threw an exception",
            "failure_reason": content.publish_failure_reason,
            "classification": failure_info,
        }


@router.get("/failed")
async def list_failed_content(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all failed content with failure reasons.
    
    Useful for seeing what needs manual intervention.
    """
    result = await db.execute(
        select(Content)
        .where(
            Content.author_id == current_user.id,
            Content.status == ContentStatus.FAILED,
        )
        .order_by(Content.updated_at.desc())
    )
    contents = result.scalars().all()
    
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "platform": c.platform.value if c.platform else None,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "failure_reason": c.publish_failure_reason,
            "retry_count": c.publish_retry_count,
            "last_retry_at": c.publish_last_retry_at.isoformat() if c.publish_last_retry_at else None,
        }
        for c in contents
    ]


@router.get("/pending-retry")
async def list_pending_retries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List content waiting for automatic retry.
    
    These are scheduled posts that failed but will be retried automatically.
    """
    result = await db.execute(
        select(Content)
        .where(
            Content.author_id == current_user.id,
            Content.status == ContentStatus.SCHEDULED,
            Content.publish_failure_reason.isnot(None),
            Content.publish_next_retry_at.isnot(None),
        )
        .order_by(Content.publish_next_retry_at.asc())
    )
    contents = result.scalars().all()
    
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "platform": c.platform.value if c.platform else None,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "failure_reason": c.publish_failure_reason,
            "retry_count": c.publish_retry_count,
            "next_retry_at": c.publish_next_retry_at.isoformat() if c.publish_next_retry_at else None,
            "last_retry_at": c.publish_last_retry_at.isoformat() if c.publish_last_retry_at else None,
        }
        for c in contents
    ]
