"""Billing router — Stripe integration."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.billing import UpgradeRequest
from app.services.billing_service import get_current_plan, upgrade_plan

router = APIRouter()


@router.get("/plan")
async def current_plan():
    """Get current subscription plan."""
    # TODO: get from auth context
    return await get_current_plan("free")


@router.post("/upgrade")
async def upgrade(body: UpgradeRequest):
    """Upgrade subscription plan."""
    valid_plans = ["pro", "business"]
    if body.plan not in valid_plans:
        raise HTTPException(status_code=400, detail="Invalid plan")

    result = await upgrade_plan(
        user_id="placeholder",
        user_email="placeholder@example.com",
        target_tier=body.plan,
        current_tier="free",
    )
    return result
