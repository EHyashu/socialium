"""Platforms router — manage connected social accounts."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.platform_account import PlatformAccount
from app.schemas.platform import PlatformAccountResponse

router = APIRouter()


@router.get("/", response_model=list[PlatformAccountResponse])
async def list_platforms(db: AsyncSession = Depends(get_db)):
    """List all connected platforms."""
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.is_active == True)
    )
    return result.scalars().all()


@router.get("/{platform_id}", response_model=PlatformAccountResponse)
async def get_platform(platform_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get platform by ID."""
    account = await db.get(PlatformAccount, platform_id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform not found")
    return account


@router.delete("/revoke")
async def revoke_all_platforms(db: AsyncSession = Depends(get_db)):
    """Revoke all platform connections for the current user."""
    # TODO: get user_id from auth context
    result = await db.execute(
        select(PlatformAccount).where(PlatformAccount.is_active == True)
    )
    accounts = result.scalars().all()
    for account in accounts:
        account.is_active = False
        account.access_token = ""
        account.refresh_token = ""
    await db.commit()
    return {"message": f"Revoked {len(accounts)} platform connections"}


@router.delete("/{platform_id}", status_code=204)
async def disconnect_platform(platform_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Disconnect a platform."""
    account = await db.get(PlatformAccount, platform_id)
    if not account:
        raise HTTPException(status_code=404, detail="Platform not found")
    account.is_active = False
    await db.commit()
