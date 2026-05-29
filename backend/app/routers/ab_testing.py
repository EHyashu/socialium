"""A/B Testing router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.marketing import ABTestCreate, ABTestResponse
from app.services.ab_testing_service import (
    create_ab_test,
    evaluate_ab_test,
    list_ab_tests,
    get_ab_test_result,
    cancel_ab_test,
)
from app.models.user import User
from app.models.workspace_member import WorkspaceMember
from app.models.ab_test import ABTest
from app.core.auth import get_current_user

router = APIRouter()


async def check_workspace_auth(db: AsyncSession, workspace_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Verify that the user belongs to the workspace."""
    result = await db.execute(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to access this workspace")


async def get_test_and_check_auth(db: AsyncSession, test_id: uuid.UUID, user_id: uuid.UUID) -> ABTest:
    """Fetch the A/B test and verify workspace authorization."""
    ab_test = await db.get(ABTest, test_id)
    if not ab_test:
        raise HTTPException(status_code=404, detail="AB test not found")
    await check_workspace_auth(db, ab_test.workspace_id, user_id)
    return ab_test


@router.get("/", response_model=list[dict])
async def list_tests(
    workspace_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all A/B tests for a workspace."""
    await check_workspace_auth(db, workspace_id, current_user.id)
    results = await list_ab_tests(db, str(workspace_id))
    return results


@router.post("/", response_model=dict)
async def create_test(
    body: ABTestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new A/B test."""
    await check_workspace_auth(db, body.workspace_id, current_user.id)
    result = await create_ab_test(
        db=db,
        workspace_id=str(body.workspace_id),
        name=body.name,
        variant_a_body=body.variant_a_body,
        variant_b_body=body.variant_b_body,
        platform=body.platform,
        author_id=str(current_user.id),
        description=body.description,
    )
    return result


@router.get("/{test_id}", response_model=dict)
async def get_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get detailed results for an A/B test."""
    await get_test_and_check_auth(db, test_id, current_user.id)
    result = await get_ab_test_result(db, str(test_id))
    return result


@router.post("/{test_id}/evaluate")
async def evaluate_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Evaluate an A/B test to determine winner."""
    await get_test_and_check_auth(db, test_id, current_user.id)
    result = await evaluate_ab_test(db, str(test_id))
    return result


@router.post("/{test_id}/cancel")
async def cancel_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel/stop an A/B test."""
    await get_test_and_check_auth(db, test_id, current_user.id)
    await cancel_ab_test(db, str(test_id))
    return {"status": "success"}
