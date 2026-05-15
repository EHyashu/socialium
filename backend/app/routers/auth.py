"""Auth router — signup, login, token refresh."""

import uuid as uuid_mod

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.supabase import supabase_sign_up, supabase_sign_in, supabase_refresh_token
from app.models.user import User
from app.schemas.auth import (
    SignUpRequest,
    SignInRequest,
    TokenResponse,
    TokenRefreshRequest,
    UserResponse,
)
from app.core.constants import SubscriptionTier

router = APIRouter(tags=["Auth"])


@router.post("/auth/signup", response_model=TokenResponse)
async def signup(body: SignUpRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    result = await supabase_sign_up(body.email, body.password)
    if not result:
        raise HTTPException(status_code=400, detail="Signup failed")

    user_id_str = result.get("user", {}).get("id") or result.get("id")
    user_id = uuid_mod.UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str

    # Create local user record
    user = User(
        id=user_id,
        email=body.email,
        username=body.username,
        full_name=body.full_name,
        subscription_tier=SubscriptionTier.FREE,
    )
    db.add(user)
    await db.commit()

    return TokenResponse(
        access_token=result.get("access_token", ""),
        refresh_token=result.get("refresh_token", ""),
        expires_in=result.get("expires_in", 3600),
        user=UserResponse.model_validate(user) if user else None,
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: SignInRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await supabase_sign_in(body.email, body.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_id_str = result.get("user", {}).get("id") or result.get("id")
    user_id = uuid_mod.UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str

    # Look up local user
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    # Auto-create local user record on first login
    if not user:
        user_email = result.get("user", {}).get("email", body.email)
        user = User(
            id=user_id,
            email=user_email,
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(user)
        await db.commit()

    return TokenResponse(
        access_token=result.get("access_token", ""),
        refresh_token=result.get("refresh_token", ""),
        expires_in=result.get("expires_in", 3600),
        user=UserResponse.model_validate(user) if user else None,
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh(body: TokenRefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token."""
    result = await supabase_refresh_token(body.refresh_token)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    return TokenResponse(
        access_token=result.get("access_token", ""),
        refresh_token=result.get("refresh_token", ""),
        expires_in=result.get("expires_in", 3600),
    )
