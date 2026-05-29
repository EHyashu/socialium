"""Auth router — signup, login, token refresh."""

import uuid as uuid_mod

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.supabase import supabase_sign_up, supabase_sign_in, supabase_refresh_token, supabase_exchange_code_for_token
from app.models.user import User
from app.schemas.auth import (
    SignUpRequest,
    SignInRequest,
    TokenResponse,
    TokenRefreshRequest,
    UserResponse,
    GoogleAuthRequest,
    PhoneOTPRequest,
    PhoneOTPVerifyRequest,
)
from app.core.constants import SubscriptionTier

from app.models.workspace import Workspace

async def _ensure_workspace(user: User, db: AsyncSession) -> None:
    """Auto-create a default workspace for new users if they don't have one."""
    from sqlalchemy import select
    result = await db.execute(select(Workspace).where(Workspace.owner_id == user.id))
    existing = result.scalars().first()
    if not existing:
        workspace = Workspace(
            name=f"{user.full_name or user.email.split('@')[0]}'s Workspace",
            owner_id=user.id,
        )
        db.add(workspace)
        await db.commit()
        await db.refresh(workspace)

router = APIRouter(tags=["Auth"])


@router.post("/auth/signup", response_model=TokenResponse)
async def signup(body: SignUpRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Validate password length (Supabase requires min 6 characters)
    if len(body.password) < 6:
        raise HTTPException(
            status_code=400, 
            detail="Password must be at least 6 characters long"
        )
    
    result = await supabase_sign_up(body.email, body.password)
    if not result:
        logger.error(f"Signup failed for email: {body.email}")
        raise HTTPException(
            status_code=400, 
            detail=f"Signup failed. This email may already be registered or Supabase configuration is incorrect."
        )

    user_id_str = result.get("user", {}).get("id") or result.get("id")
    user_id = uuid_mod.UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str

    # Create or fetch local user record
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        user = User(
            id=user_id,
            email=body.email,
            username=body.username,
            full_name=body.full_name,
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        updated = False
        if body.username and not user.username:
            user.username = body.username
            updated = True
        if body.full_name and not user.full_name:
            user.full_name = body.full_name
            updated = True
        if updated:
            await db.commit()
            await db.refresh(user)

    await _ensure_workspace(user, db)

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
        await db.refresh(user)

    await _ensure_workspace(user, db)

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


@router.post("/auth/google", response_model=TokenResponse)
async def google_auth(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    """Authenticate with Google OAuth via Supabase."""
    result = await supabase_exchange_code_for_token(body.code, body.code_verifier)
    if not result:
        raise HTTPException(status_code=401, detail="Google authentication failed")
    
    user_id_str = result.get("user", {}).get("id")
    user_id = uuid_mod.UUID(user_id_str) if isinstance(user_id_str, str) else user_id_str
    
    # Look up or create local user
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    
    if not user:
        user_email = result.get("user", {}).get("email", "")
        user_metadata = result.get("user", {}).get("user_metadata", {})
        user = User(
            id=user_id,
            email=user_email,
            username=user_metadata.get("name"),
            full_name=user_metadata.get("name"),
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(user)
        await db.commit()
    
    await _ensure_workspace(user, db)

    return TokenResponse(
        access_token=result.get("access_token", ""),
        refresh_token=result.get("refresh_token", ""),
        expires_in=result.get("expires_in", 3600),
        user=UserResponse.model_validate(user),
    )


@router.post("/auth/phone/send-otp")
async def send_phone_otp(body: PhoneOTPRequest):
    """Send OTP to phone number via Twilio Verify."""
    from twilio.rest import Client
    from app.config import get_settings
    
    settings = get_settings()
    
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(status_code=500, detail="Twilio not configured")
    
    # Use Twilio Verify service
    # TODO: Replace with your actual Verify Service SID from Twilio Console
    verify_service_sid = getattr(settings, 'twilio_verify_service_sid', None)
    
    if not verify_service_sid:
        raise HTTPException(
            status_code=500, 
            detail="Twilio Verify Service SID not configured. Add TWILIO_VERIFY_SERVICE_SID to .env"
        )
    
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    
    try:
        verification = client.verify.v2.services(verify_service_sid) \
            .verifications.create(to=body.phone_number, channel="sms")
        return {"status": "sent", "sid": verification.sid}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send OTP: {str(e)}")


@router.post("/auth/phone/verify-otp", response_model=TokenResponse)
async def verify_phone_otp(body: PhoneOTPVerifyRequest, db: AsyncSession = Depends(get_db)):
    """Verify OTP and create/login user."""
    from twilio.rest import Client
    from app.config import get_settings
    import uuid as uuid_mod
    
    settings = get_settings()
    
    if not settings.twilio_account_sid or not settings.twilio_auth_token:
        raise HTTPException(status_code=500, detail="Twilio not configured")
    
    verify_service_sid = getattr(settings, 'twilio_verify_service_sid', None)
    
    if not verify_service_sid:
        raise HTTPException(
            status_code=500,
            detail="Twilio Verify Service SID not configured"
        )
    
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    
    try:
        verification_check = client.verify.v2.services(verify_service_sid) \
            .verification_checks.create(to=body.phone_number, code=body.otp)
        
        if verification_check.status != "approved":
            raise HTTPException(status_code=401, detail="Invalid OTP")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OTP verification failed: {str(e)}")
    
    # Create user with phone number (use phone as unique identifier)
    import hashlib
    user_id = uuid_mod.UUID(hashlib.md5(body.phone_number.encode()).hexdigest())
    
    # Look up or create user
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    
    if not user:
        user = User(
            id=user_id,
            email=f"{body.phone_number}@phone.socialium.local",
            username=body.phone_number,
            phone_number=body.phone_number,
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(user)
        await db.commit()
    
    # Generate JWT tokens (simplified - in production use proper JWT)
    import jwt
    from datetime import datetime, timedelta
    from app.config import get_settings
    
    settings = get_settings()
    
    access_token = jwt.encode(
        {
            "sub": str(user.id),
            "email": user.email,
            "exp": datetime.utcnow() + timedelta(minutes=settings.jwt_access_token_expire_minutes),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    
    refresh_token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": datetime.utcnow() + timedelta(days=settings.jwt_refresh_token_expire_days),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        user=UserResponse.model_validate(user),
    )
