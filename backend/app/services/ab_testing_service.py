"""A/B testing service."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ab_test import ABTest
from app.models.content import Content

logger = logging.getLogger(__name__)


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

    return {
        "id": str(ab_test.id),
        "name": ab_test.name,
        "variant_a_id": str(variant_a.id),
        "variant_b_id": str(variant_b.id),
        "is_active": ab_test.is_active,
    }


async def evaluate_ab_test(db: AsyncSession, test_id: str) -> dict | None:
    """Evaluate an A/B test and determine winner."""
    result = await db.execute(
        __import__("sqlalchemy").select(ABTest).where(ABTest.id == test_id)
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
    ab_test.result_data = {
        "variant_a_score": a_score,
        "variant_b_score": b_score,
        "winner": winner,
    }
    await db.commit()

    return {
        "test_id": str(ab_test.id),
        "variant_a_score": a_score,
        "variant_b_score": b_score,
        "winner": winner,
    }
