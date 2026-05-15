"""A/B Testing router."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.marketing import ABTestCreate, ABTestResponse
from app.services.ab_testing_service import create_ab_test, evaluate_ab_test

router = APIRouter()


@router.post("/", response_model=dict)
async def create_test(body: ABTestCreate, db: AsyncSession = Depends(get_db)):
    """Create a new A/B test."""
    result = await create_ab_test(
        db=db,
        workspace_id=str(body.workspace_id),
        name=body.name,
        variant_a_body=body.variant_a_body,
        variant_b_body=body.variant_b_body,
        platform=body.platform,
        author_id=str(uuid.uuid4()),  # TODO: get from auth
        description=body.description,
    )
    return result


@router.post("/{test_id}/evaluate")
async def evaluate_test(test_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Evaluate an A/B test to determine winner."""
    result = await evaluate_ab_test(db, str(test_id))
    if not result:
        raise HTTPException(status_code=404, detail="AB test not found")
    return result
