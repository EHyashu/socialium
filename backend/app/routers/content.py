"""Content router — CRUD + AI generation."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Content
from app.schemas.content import (
    ContentCreate,
    ContentUpdate,
    ContentGenerateRequest,
    ContentApprovalRequest,
    ContentResponse,
)
from app.services.content_service import generate_content, score_content_quality
from app.core.constants import ContentStatus, ApprovalAction
from app.core.rate_limiter import check_generation_limit, increment_generation_count

router = APIRouter()


@router.post("/", response_model=ContentResponse, status_code=201)
async def create_content(body: ContentCreate, db: AsyncSession = Depends(get_db)):
    """Create a new content draft."""
    content = Content(
        workspace_id=body.workspace_id,
        author_id=uuid.uuid4(),  # TODO: get from auth
        platform=body.platform,
        tone=body.tone,
        title=body.title,
        body=body.body,
        image_urls=body.image_urls,
        hashtags=body.hashtags,
        mentions=body.mentions,
        link_url=body.link_url,
        scheduled_at=body.scheduled_at,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    return content


@router.get("/", response_model=list[ContentResponse])
async def list_content(
    workspace_id: uuid.UUID | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """List content with optional filters."""
    query = select(Content)
    if workspace_id:
        query = query.where(Content.workspace_id == workspace_id)
    if status:
        query = query.where(Content.status == status)
    query = query.order_by(Content.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(content_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get content by ID."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.patch("/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: uuid.UUID, body: ContentUpdate, db: AsyncSession = Depends(get_db)
):
    """Update content."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(content, key, value)
    await db.commit()
    await db.refresh(content)
    return content


@router.delete("/{content_id}", status_code=204)
async def delete_content(content_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete content."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    await db.delete(content)
    await db.commit()


@router.post("/generate")
async def generate_ai_content(body: ContentGenerateRequest):
    """Generate content for multiple platforms using AI (rate-limited per workspace).

    Supports multi-platform simultaneous generation, trend boost injection,
    A/B variant generation, and per-platform quality scoring.
    """
    # Enforce per-workspace daily generation budget
    platforms = body.get_platforms()
    workspace_id_str = str(body.workspace_id)
    allowed, current, limit = await check_generation_limit(
        workspace_id=workspace_id_str,
    )
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Daily AI generation limit reached ({current}/{limit}). Upgrade your plan for more.",
        )

    # Separate trend keywords from regular keywords
    effective_keywords = list(body.keywords or [])
    trend_kws = list(body.trend_keywords or []) if body.trend_boost else []

    # Determine effective topic from source
    topic = body.topic
    if not topic and body.source_text:
        topic = body.source_text[:500]

    results = {}
    for platform in platforms:
        result = await generate_content(
            platform=platform,
            tone=body.tone,
            topic=topic,
            keywords=effective_keywords or None,
            include_hashtags=body.include_hashtags,
            include_mentions=body.include_mentions,
            target_audience=body.target_audience,
            include_emojis=body.include_emojis,
            workspace_id=workspace_id_str,
            trending_keywords=trend_kws or None,
            content_length=body.content_length,
            creativity=body.creativity,
        )
        if result.get("success"):
            # Score quality with enhanced factors
            score_result = await score_content_quality(
                body=result.get("body", ""),
                platform=platform,
                tone=body.tone,
                trending_keywords=trend_kws or None,
                target_audience=body.target_audience,
            )
            result["quality_score"] = score_result.get("overall", 7)
            result["quality_details"] = score_result
        results[platform.value] = result

        # Generate variant if requested (different angle, higher temperature)
        if body.generate_variants and result.get("success"):
            variant = await generate_content(
                platform=platform,
                tone=body.tone,
                topic=topic,
                keywords=effective_keywords or None,
                include_hashtags=body.include_hashtags,
                include_mentions=body.include_mentions,
                target_audience=body.target_audience,
                include_emojis=body.include_emojis,
                workspace_id=workspace_id_str,
                trending_keywords=trend_kws or None,
                content_length=body.content_length,
                creativity=min(body.creativity + 20, 100),
            )
            results[f"{platform.value}_variant"] = variant

    # Count as one generation regardless of platform count
    await increment_generation_count(workspace_id=workspace_id_str)
    return {
        "results": results,
        "platforms": [p.value for p in platforms],
        "usage": {"used": current + 1, "limit": limit},
    }


@router.post("/{content_id}/approve")
async def approve_content(
    content_id: uuid.UUID, body: ContentApprovalRequest, db: AsyncSession = Depends(get_db)
):
    """Approve or reject content."""
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    action_map = {
        "approve": ContentStatus.APPROVED,
        "reject": ContentStatus.REJECTED,
        "request_changes": ContentStatus.DRAFT,
    }
    new_status = action_map.get(body.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")

    content.status = new_status
    await db.commit()
    return {"status": "ok", "content_status": new_status.value}


@router.post("/{content_id}/score")
async def score_content(content_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Score content quality using AI."""
    content = await db.get(Content, content_id)
    if not content or not content.body:
        raise HTTPException(status_code=404, detail="Content not found")

    result = await score_content_quality(
        body=content.body,
        platform=content.platform,
        tone=content.tone,
    )
    if result.get("success"):
        content.quality_score = result.get("overall", 0)
        await db.commit()
    return result
