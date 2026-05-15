"""Scheduling router — manual scheduling + AI-powered optimal time prediction."""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Content
from app.core.constants import ContentStatus
from app.services.audience_activity_service import get_optimal_posting_times, AudienceActivityService
from app.services.viral_scoring_service import score_viral_potential, ViralScoringService
from app.services.ai_scheduler_service import auto_schedule_content, bulk_auto_schedule_content

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Request schemas ───────────────────────────────────────────────────────────

class BulkScheduleRequest(BaseModel):
    workspace_id: str
    content_ids: list[str]
    target_audience: str = ""


# ─── Endpoints ───────────────────────────────────────────────────────────────

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
            "body": (c.body[:120] + "...") if c.body and len(c.body) > 120 else c.body,
            "platform": c.platform.value if c.platform else None,
            "scheduled_at": c.scheduled_at.isoformat() if c.scheduled_at else None,
            "status": c.status.value,
            "quality_score": c.quality_score,
            "hashtags": c.hashtags,
            "viral_score": c.viral_score,
            "viral_probability": c.viral_probability,
            "scheduling_confidence": c.scheduling_confidence,
            "scheduling_reason": c.scheduling_reason,
            "auto_scheduled": c.auto_scheduled,
        }
        for c in contents
    ]


@router.get("/drafts-ready")
async def list_drafts_ready(workspace_id: str = "", db: AsyncSession = Depends(get_db)):
    """List approved/draft content ready for scheduling."""
    query = select(Content).where(
        Content.status.in_([ContentStatus.DRAFT, ContentStatus.APPROVED])
    ).order_by(Content.created_at.desc())
    if workspace_id:
        query = query.where(Content.workspace_id == uuid.UUID(workspace_id))
    result = await db.execute(query)
    contents = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "title": c.title,
            "body": (c.body[:80] + "...") if c.body and len(c.body) > 80 else c.body,
            "platform": c.platform.value if c.platform else None,
            "status": c.status.value,
            "quality_score": c.quality_score,
            "created_at": c.created_at.isoformat() if c.created_at else None,
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


@router.post("/{content_id}/optimal-time")
async def get_optimal_time(
    content_id: uuid.UUID,
    target_audience: str = "",
    db: AsyncSession = Depends(get_db),
):
    """AI-powered optimal scheduling time prediction.

    Combines viral potential scoring with audience activity analysis
    to determine the best time to publish this content.

    Returns the best slot, alternatives, confidence, and reasoning.
    """
    content = await db.get(Content, content_id)
    if not content or not content.body:
        raise HTTPException(status_code=404, detail="Content not found")

    platform = content.platform.value if content.platform else "linkedin"

    try:
        # Step 1: Score viral potential
        viral_result = await score_viral_potential(
            draft_id=str(content.id),
            workspace_id=str(content.workspace_id),
            platform=platform,
            content=content.body,
            hashtags=content.hashtags or [],
        )
        viral_score = viral_result.get("total_score", 50)

        # Step 2: Get optimal posting times based on viral score + audience data
        optimal = await get_optimal_posting_times(
            workspace_id=str(content.workspace_id),
            platform=platform,
            target_audience=target_audience,
            viral_score=viral_score,
            db=db,
        )

        return {
            "content_id": str(content.id),
            "platform": platform,
            "viral_score": viral_result,
            "optimal_time": optimal,
        }
    except Exception as e:
        logger.error(f"Optimal time prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scheduling prediction failed: {str(e)}")


@router.post("/{content_id}/auto-schedule")
async def auto_schedule(
    content_id: uuid.UUID,
    target_audience: str = "",
    db: AsyncSession = Depends(get_db),
):
    """Fully autonomous AI scheduling.

    The AI orchestrator:
    1. Scores viral potential (6 factors, 0-100)
    2. Predicts optimal posting time (5 data layers)
    3. Decides: auto-schedule, suggest times, or flag for improvement
    4. If high viral (>=65), auto-schedules at peak time
    5. Otherwise returns decision with suggested times
    """
    content = await db.get(Content, content_id)
    if not content or not content.body:
        raise HTTPException(status_code=404, detail="Content not found")

    try:
        result = await auto_schedule_content(
            content_id=str(content_id),
            workspace_id=str(content.workspace_id),
            target_audience=target_audience,
            db=db,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Auto-schedule failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Auto-scheduling failed: {str(e)}")


@router.post("/bulk-auto-schedule")
async def bulk_auto_schedule_endpoint(
    request: BulkScheduleRequest,
    db: AsyncSession = Depends(get_db),
):
    """Bulk autonomous scheduling with conflict prevention.

    Schedules multiple drafts at once, ensuring at least 2 hours
    between posts to avoid audience fatigue and algorithm penalties.
    """
    if not request.content_ids:
        raise HTTPException(status_code=400, detail="No content IDs provided")
    if len(request.content_ids) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 posts per bulk schedule")

    try:
        results = await bulk_auto_schedule_content(
            workspace_id=request.workspace_id,
            content_ids=request.content_ids,
            target_audience=request.target_audience,
            db=db,
        )
        return {
            "total": len(results),
            "auto_scheduled": sum(
                1 for r in results if r.get("decision", {}).get("action") == "auto_scheduled"
            ),
            "needs_confirmation": sum(
                1 for r in results if r.get("decision", {}).get("action") == "confirm_schedule"
            ),
            "needs_improvement": sum(
                1 for r in results if r.get("decision", {}).get("action") == "improve_content"
            ),
            "results": results,
        }
    except Exception as e:
        logger.error(f"Bulk auto-schedule failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bulk scheduling failed: {str(e)}")


@router.get("/viral-score/{content_id}")
async def get_viral_score(
    content_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get viral potential score for a draft before scheduling."""
    content = await db.get(Content, content_id)
    if not content or not content.body:
        raise HTTPException(status_code=404, detail="Content not found")

    platform = content.platform.value if content.platform else "linkedin"
    try:
        scorer = ViralScoringService()
        result = await scorer.score_content(
            draft_id=str(content.id),
            workspace_id=str(content.workspace_id),
            platform=platform,
            content=content.body,
            hashtags=content.hashtags or [],
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"Viral scoring failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Viral scoring failed: {str(e)}")


@router.get("/optimal-times/{platform}")
async def get_optimal_times(
    platform: str,
    workspace_id: str = "",
    target_audience: str = "",
    viral_score: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get AI-recommended posting times for a platform."""
    try:
        result = await get_optimal_posting_times(
            workspace_id=workspace_id,
            platform=platform,
            target_audience=target_audience,
            viral_score=viral_score,
            db=db,
        )
        return result
    except Exception as e:
        logger.error(f"Optimal times prediction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Optimal times failed: {str(e)}")
