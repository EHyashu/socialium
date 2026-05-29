"""Authentication dependency for protected routes."""

import json
import logging
import uuid as uuid_mod
from datetime import datetime, timezone

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)

security = HTTPBearer()
settings = get_settings()

# ── Redis token cache (5-minute TTL) ─────────────────────────────────────────

_redis_client = None
TOKEN_CACHE_TTL = 300  # 5 minutes


async def _get_redis():
    """Lazy-init async Redis for token caching."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis_client.ping()
        return _redis_client
    except Exception as e:
        logger.debug(f"Redis unavailable for token cache: {e}")
        return None


async def _get_cached_user_id(token: str) -> dict | None:
    """Return cached {user_id, email} for a token if available."""
    import hashlib
    r = await _get_redis()
    if not r:
        return None
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        data = await r.get(f"auth:token:{token_hash}")
        if data:
            return json.loads(data)
    except Exception:
        pass
    return None


async def _cache_user_id(token: str, user_id: str, email: str) -> None:
    """Cache {user_id, email} for a token with 5-minute TTL."""
    import hashlib
    r = await _get_redis()
    if not r:
        return
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        await r.setex(
            f"auth:token:{token_hash}",
            TOKEN_CACHE_TTL,
            json.dumps({"user_id": user_id, "email": email}),
        )
    except Exception:
        pass


async def _validate_token_with_supabase(token: str) -> tuple[str, str]:
    """
    Call Supabase /auth/v1/user with a 5-second timeout.
    Returns (user_id, email). Raises HTTPException on failure.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Check Redis cache first (avoids hitting Supabase on every request)
    cached = await _get_cached_user_id(token)
    if cached:
        logger.debug("Token validated from Redis cache")
        return cached["user_id"], cached["email"]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token}",
                },
            )

            if response.status_code != 200:
                logger.error(
                    f"Supabase token validation failed: {response.status_code}"
                )
                raise credentials_exception

            supabase_user = response.json()
            user_id = supabase_user.get("sub") or supabase_user.get("id")
            email = supabase_user.get("email", "")

            if not user_id:
                logger.error("No user ID in Supabase response")
                raise credentials_exception

            # Cache the validated token
            await _cache_user_id(token, user_id, email)
            return user_id, email

    except httpx.TimeoutException:
        logger.error("Supabase token validation timed out (5s)")
        raise credentials_exception
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Supabase: {e}")
        raise credentials_exception
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Authentication failed: {e}", exc_info=True)
        raise credentials_exception


async def _ensure_user_and_workspace(
    user_id: str, email: str, db: AsyncSession
) -> User:
    """
    Get or auto-create a User + Workspace from Supabase token data.

    This handles users who signed up via PixoraNest or any other app using
    the same Supabase project — their auth.users row exists but public.users
    may not.
    """
    from app.core.constants import SubscriptionTier

    user_id_uuid = uuid_mod.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_id_uuid))
    user = result.scalar_one_or_none()

    if user is None:
        logger.info(f"Auto-creating user record for {email} (id={user_id})")
        user = User(
            id=user_id_uuid,
            email=email,
            subscription_tier=SubscriptionTier.FREE,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception as e:
            await db.rollback()
            # Race condition — another request may have created it already
            logger.warning(f"User creation conflict (re-fetching): {e}")
            result = await db.execute(select(User).where(User.id == user_id_uuid))
            user = result.scalar_one_or_none()
            if user is None:
                raise

    # Auto-create workspace if the user doesn't have one
    try:
        from app.models.workspace import Workspace
        ws_result = await db.execute(
            select(Workspace).where(Workspace.owner_id == user.id)
        )
        if not ws_result.scalars().first():
            workspace = Workspace(
                name=f"{user.full_name or email.split('@')[0]}'s Workspace",
                owner_id=user.id,
            )
            db.add(workspace)
            await db.commit()
            logger.info(f"Auto-created workspace for user {user.id}")
    except Exception as e:
        logger.warning(f"Workspace auto-creation failed (non-blocking): {e}")
        try:
            await db.rollback()
        except Exception:
            pass

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT token via Supabase, return current user.

    Features:
    - 5-second timeout on Supabase validation (prevents infinite loading)
    - Redis caching (5-minute TTL) to avoid hitting Supabase on every request
    - Auto-creates user + workspace on first login from any Supabase app
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id, email = await _validate_token_with_supabase(credentials.credentials)

    try:
        user = await _ensure_user_and_workspace(user_id, email, db)
        logger.info(f"Authenticated user: {user.email} (id={user_id})")
        return user
    except ValueError:
        logger.error(f"Invalid user ID format in token: {user_id}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Database lookup failed: {e}", exc_info=True)
        raise credentials_exception


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Optional authentication — returns None if token invalid (for public routes)."""
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None
