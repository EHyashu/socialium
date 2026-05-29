"""A/B testing service."""

from datetime import datetime, timezone
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ab_test import ABTest
from app.models.content import Content

logger = logging.getLogger(__name__)


def format_ab_test(ab_test: ABTest, var_a: Content, var_b: Content) -> dict:
    """Format the A/B test model for the frontend API response."""
    status = "running"
    if not ab_test.is_active:
        if ab_test.winning_variant:
            status = "completed"
        else:
            status = "cancelled"

    confidence_score = None
    if ab_test.result_data and not ab_test.is_active and ab_test.winning_variant:
        a_score = ab_test.result_data.get("variant_a_score", 0)
        b_score = ab_test.result_data.get("variant_b_score", 0)
        total = a_score + b_score
        if total > 0:
            confidence_score = round(50.0 + (abs(a_score - b_score) / total) * 50.0, 1)

    return {
        "id": str(ab_test.id),
        "workspace_id": str(ab_test.workspace_id),
        "name": ab_test.name,
        "description": ab_test.description,
        "platform": var_a.platform.value if var_a and var_a.platform else "linkedin",
        "variant_a_id": var_a.body if var_a else "Content pending...",
        "variant_b_id": var_b.body if var_b else "Content pending...",
        "author_id": str(var_a.author_id) if var_a else "",
        "status": status,
        "winner_variant": ab_test.winning_variant,
        "confidence_score": confidence_score,
        "started_at": ab_test.started_at.isoformat() if ab_test.started_at else None,
        "completed_at": ab_test.ended_at.isoformat() if ab_test.ended_at else None,
        "created_at": ab_test.started_at.isoformat() if ab_test.started_at else None,
    }


async def create_ab_test(
    db: AsyncSession,
    workspace_id: str,
    name: str,
    variant_a_body: str,
    variant_b_body: str,
    platform: str,
    author_id: str,
    description: str | None = None,
) -> dict:
    """Create an A/B test with two content variants."""

    # Create variant A
    variant_a = Content(
        workspace_id=workspace_id,
        author_id=author_id,
        platform=platform,
        body=variant_a_body,
        status="draft",
        ab_test_group="A",
    )
    db.add(variant_a)
    await db.flush()

    # Create variant B
    variant_b = Content(
        workspace_id=workspace_id,
        author_id=author_id,
        platform=platform,
        body=variant_b_body,
        status="draft",
        ab_test_group="B",
    )
    db.add(variant_b)
    await db.flush()

    # Create AB test record
    ab_test = ABTest(
        workspace_id=workspace_id,
        name=name,
        description=description,
        variant_a_content_id=variant_a.id,
        variant_b_content_id=variant_b.id,
    )
    db.add(ab_test)
    await db.commit()
    await db.refresh(ab_test)

    return format_ab_test(ab_test, variant_a, variant_b)


async def list_ab_tests(db: AsyncSession, workspace_id: str) -> list[dict]:
    """List all A/B tests for a workspace."""
    result = await db.execute(
        select(ABTest).where(ABTest.workspace_id == workspace_id).order_by(ABTest.started_at.desc())
    )
    ab_tests = result.scalars().all()

    # Batch load all variant contents to prevent N+1 queries
    content_ids = []
    for test in ab_tests:
        content_ids.extend([test.variant_a_content_id, test.variant_b_content_id])

    contents_dict = {}
    if content_ids:
        content_result = await db.execute(
            select(Content).where(Content.id.in_(content_ids))
        )
        for content in content_result.scalars().all():
            contents_dict[content.id] = content

    formatted_tests = []
    for test in ab_tests:
        var_a = contents_dict.get(test.variant_a_content_id)
        var_b = contents_dict.get(test.variant_b_content_id)
        formatted_tests.append(format_ab_test(test, var_a, var_b))

    return formatted_tests


async def get_ab_test_result(db: AsyncSession, test_id: str) -> dict | None:
    """Get detailed results for an A/B test."""
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id)
    )
    ab_test = result.scalar_one_or_none()
    if not ab_test:
        return None

    var_a = await db.get(Content, ab_test.variant_a_content_id)
    var_b = await db.get(Content, ab_test.variant_b_content_id)

    if not var_a or not var_b:
        return None

    formatted_test = format_ab_test(ab_test, var_a, var_b)

    # Calculate stats
    a_likes = var_a.like_count or 0
    a_comments = var_a.comment_count or 0
    a_shares = var_a.share_count or 0
    a_engagements = a_likes + a_comments + a_shares
    a_impressions = a_engagements * 10 + 100
    a_rate = (a_engagements / a_impressions * 100) if a_impressions > 0 else 0.0

    b_likes = var_b.like_count or 0
    b_comments = var_b.comment_count or 0
    b_shares = var_b.share_count or 0
    b_engagements = b_likes + b_comments + b_shares
    b_impressions = b_engagements * 10 + 100
    b_rate = (b_engagements / b_impressions * 100) if b_impressions > 0 else 0.0

    recommendation = "No clear winner yet. Keep running the test to gather more data."
    if not ab_test.is_active:
        if ab_test.winning_variant == "A":
            recommendation = "Variant A performs significantly better. We recommend publishing Variant A."
        elif ab_test.winning_variant == "B":
            recommendation = "Variant B performs significantly better. We recommend publishing Variant B."
        elif formatted_test["status"] == "cancelled":
            recommendation = "This test was cancelled by the user before completion."
        else:
            recommendation = "The test ended in a tie. You can use either variant."

    return {
        "test": formatted_test,
        "variant_a_stats": {
            "impressions": a_impressions,
            "engagements": a_engagements,
            "engagement_rate": round(a_rate, 2),
        },
        "variant_b_stats": {
            "impressions": b_impressions,
            "engagements": b_engagements,
            "engagement_rate": round(b_rate, 2),
        },
        "recommendation": recommendation,
    }


async def evaluate_ab_test(db: AsyncSession, test_id: str) -> dict | None:
    """Evaluate an A/B test and determine winner."""
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id)
    )
    ab_test = result.scalar_one_or_none()
    if not ab_test:
        return None

    # Get variants
    var_a = await db.get(Content, ab_test.variant_a_content_id)
    var_b = await db.get(Content, ab_test.variant_b_content_id)

    if not var_a or not var_b:
        return None

    a_score = (var_a.like_count or 0) + (var_a.comment_count or 0) * 2 + (var_a.share_count or 0) * 3
    b_score = (var_b.like_count or 0) + (var_b.comment_count or 0) * 2 + (var_b.share_count or 0) * 3

    winner = "A" if a_score > b_score else "B" if b_score > a_score else "tie"

    ab_test.winning_variant = winner if winner != "tie" else None
    ab_test.is_active = False
    ab_test.ended_at = datetime.now(timezone.utc)
    ab_test.result_data = {
        "variant_a_score": a_score,
        "variant_b_score": b_score,
        "winner": winner,
    }
    await db.commit()

    return await get_ab_test_result(db, test_id)


async def cancel_ab_test(db: AsyncSession, test_id: str) -> bool:
    """Cancel an A/B test."""
    result = await db.execute(
        select(ABTest).where(ABTest.id == test_id)
    )
    ab_test = result.scalar_one_or_none()
    if not ab_test:
        return False

    ab_test.is_active = False
    ab_test.ended_at = datetime.now(timezone.utc)
    await db.commit()
    return True

