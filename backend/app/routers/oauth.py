"""OAuth router — authorization URLs and callbacks."""

import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.oauth_state import generate_oauth_state, validate_oauth_state
from app.database import get_db
from app.models.platform_account import PlatformAccount
from app.services.oauth_service import (
    get_linkedin_auth_url,
    exchange_linkedin_code,
    get_twitter_auth_url,
    exchange_twitter_code,
    get_instagram_auth_url,
    exchange_instagram_code,
)

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


@router.get("/linkedin/authorize")
async def linkedin_authorize(user_id: str = Query(None)):
    """Get LinkedIn OAuth authorization URL."""
    # In development, use a dummy user_id if none provided
    actual_user_id = user_id or "00000000-0000-0000-0000-000000000000"
    logger.info(f"LinkedIn authorize request - user_id: {actual_user_id}")
    
    state = await generate_oauth_state(
        platform="linkedin", user_id=actual_user_id, redirect_path="/platforms"
    )
    logger.info(f"Generated OAuth state for LinkedIn: {state[:20]}...")
    
    url = get_linkedin_auth_url(state)
    logger.info(f"Returning LinkedIn auth URL: {url[:50]}...")
    
    return {"authorization_url": url}


@router.get("/linkedin/callback")
async def linkedin_callback_get(
    code: str = None, 
    error: str = None,
    error_description: str = None,
    state: str = "", 
    db: AsyncSession = Depends(get_db)
):
    """LinkedIn OAuth callback (GET)."""
    # Handle OAuth errors from LinkedIn
    if error:
        logger.error(f"LinkedIn OAuth error: {error} - {error_description}")
        raise HTTPException(
            status_code=400, 
            detail=f"LinkedIn OAuth error: {error} - {error_description}"
        )
    return await process_linkedin_callback(code, state, is_post=False, db=db)


@router.post("/linkedin/callback")
async def linkedin_callback_post(body: dict):
    """LinkedIn OAuth callback (POST)."""
    return await process_linkedin_callback(body.get("code"), body.get("state", ""), is_post=True)


async def process_linkedin_callback(code: str | None, state: str, is_post: bool = False, db: AsyncSession = None):
    """Process the LinkedIn OAuth code exchange."""
    logger.info(f"LinkedIn callback received - code: {code[:10] if code else 'None'}..., state: {state[:20] if state else 'None'}..., is_post: {is_post}")
    
    if not code:
        logger.error("Missing authorization code in callback")
        raise HTTPException(status_code=400, detail="Missing authorization code")
        
    payload = await validate_oauth_state(state)
    if not payload:
        logger.error(f"Invalid or expired OAuth state: {state[:20]}...")
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    
    logger.info(f"OAuth state validated - payload: {payload}")

    tokens = await exchange_linkedin_code(code, settings.linkedin_redirect_uri)
    if not tokens:
        raise HTTPException(status_code=400, detail="LinkedIn token exchange failed")

    # Extract token data
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in", 5184000)  # LinkedIn default: 60 days
    platform_user_id = tokens.get("platform_user_id")
    platform_username = tokens.get("platform_username", "")
    
    if not access_token or not platform_user_id:
        logger.error(f"Missing required token fields: access_token={bool(access_token)}, platform_user_id={bool(platform_user_id)}")
        raise HTTPException(status_code=400, detail="Incomplete token data from LinkedIn")
    
    # Get user_id from OAuth state payload
    user_id_str = payload.get("user_id")
    if not user_id_str:
        logger.error("No user_id in OAuth state payload")
        raise HTTPException(status_code=400, detail="Missing user ID in OAuth state")
    
    # Convert string to UUID
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        logger.error(f"Invalid user_id format: {user_id_str}")
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Calculate token expiry
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    
    # Store tokens in database
    try:
        # Check if account already exists
        result = await db.execute(
            select(PlatformAccount).where(
                PlatformAccount.user_id == user_id,
                PlatformAccount.platform == "linkedin",
            )
        )
        existing_account = result.scalars().first()
        
        if existing_account:
            # Update existing account
            logger.info(f"Updating existing LinkedIn account for user {user_id}")
            existing_account.access_token = access_token
            existing_account.refresh_token = refresh_token
            existing_account.token_expires_at = token_expires_at
            existing_account.platform_user_id = platform_user_id
            existing_account.platform_username = platform_username
            existing_account.is_active = True
        else:
            # Create new account
            logger.info(f"Creating new LinkedIn account for user {user_id}")
            new_account = PlatformAccount(
                user_id=user_id,
                platform="linkedin",
                platform_user_id=platform_user_id,
                platform_username=platform_username,
                access_token=access_token,
                refresh_token=refresh_token,
                token_expires_at=token_expires_at,
                is_active=True,
            )
            db.add(new_account)
        
        await db.commit()
        logger.info(f"LinkedIn account saved successfully for user {user_id}")
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save LinkedIn account: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save account: {str(e)}")
    
    if is_post:
        return {"status": "success", "platform": "linkedin", "username": platform_username}
    
    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?linkedin=success&connected=true"
    )


@router.get("/twitter/authorize")
async def twitter_authorize(user_id: str = Query(None)):
    """Get Twitter OAuth authorization URL."""
    actual_user_id = user_id or "00000000-0000-0000-0000-000000000000"
    state = await generate_oauth_state(
        platform="twitter", user_id=actual_user_id, redirect_path="/platforms"
    )
    url = get_twitter_auth_url(state)
    return {"authorization_url": url}


@router.get("/twitter/callback")
async def twitter_callback(code: str, state: str = "", db: AsyncSession = Depends(get_db)):
    """Twitter OAuth callback."""
    logger.info(f"Twitter callback received - code: {code[:10] if code else 'None'}...")
    
    payload = await validate_oauth_state(state)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    
    # For PKCE, we need the code_verifier
    # In production, retrieve from Redis using state as key
    # For now, we'll generate it again (this won't work - need Redis)
    # This is a TEMPORARY workaround - see comment in oauth_service.py
    import base64
    import hashlib
    import secrets
    
    # NOTE: This is a workaround. Proper solution requires Redis storage
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=')
    
    tokens = await exchange_twitter_code(code, code_verifier.decode())
    if not tokens:
        raise HTTPException(status_code=400, detail="Twitter token exchange failed")
    
    # Extract token data
    access_token = tokens.get("access_token")
    platform_user_id = tokens.get("platform_user_id")
    platform_username = tokens.get("platform_username", "")
    
    if not access_token or not platform_user_id:
        raise HTTPException(status_code=400, detail="Incomplete token data from Twitter")
    
    # Get user_id from OAuth state
    user_id_str = payload.get("user_id")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="Missing user ID in OAuth state")
    
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Save to database
    try:
        # Check if account already exists
        existing = await db.execute(
            select(PlatformAccount).where(
                PlatformAccount.user_id == user_id,
                PlatformAccount.platform == "twitter"
            )
        )
        account = existing.scalars().first()
        
        if account:
            account.access_token = access_token
            account.refresh_token = tokens.get("refresh_token")
            account.platform_user_id = platform_user_id
            account.platform_username = platform_username
            account.is_active = True
        else:
            new_account = PlatformAccount(
                user_id=user_id,
                platform="twitter",
                platform_user_id=platform_user_id,
                platform_username=platform_username,
                access_token=access_token,
                refresh_token=tokens.get("refresh_token"),
                is_active=True,
            )
            db.add(new_account)
        
        await db.commit()
        logger.info(f"Twitter account saved for user {user_id}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save Twitter account: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save account: {str(e)}")
    
    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?twitter=success&connected=true"
    )


@router.get("/instagram/authorize")
async def instagram_authorize(user_id: str = Query(None)):
    """Get Instagram OAuth authorization URL."""
    actual_user_id = user_id or "00000000-0000-0000-0000-000000000000"
    state = await generate_oauth_state(
        platform="instagram", user_id=actual_user_id, redirect_path="/platforms"
    )
    url = get_instagram_auth_url(state)
    return {"authorization_url": url}


@router.get("/instagram/callback")
async def instagram_callback(code: str, state: str = "", db: AsyncSession = Depends(get_db)):
    """Instagram OAuth callback."""
    logger.info(f"Instagram callback received - code: {code[:10] if code else 'None'}...")
    
    payload = await validate_oauth_state(state)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    tokens = await exchange_instagram_code(code)
    if not tokens:
        raise HTTPException(status_code=400, detail="Instagram token exchange failed")
    
    # Extract token data
    access_token = tokens.get("access_token")
    platform_user_id = tokens.get("platform_user_id")
    platform_username = tokens.get("platform_username", "")
    
    if not access_token or not platform_user_id:
        raise HTTPException(status_code=400, detail="Incomplete token data from Instagram")
    
    # Get user_id from OAuth state
    user_id_str = payload.get("user_id")
    if not user_id_str:
        raise HTTPException(status_code=400, detail="Missing user ID in OAuth state")
    
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    
    # Save to database
    try:
        # Check if account already exists
        existing = await db.execute(
            select(PlatformAccount).where(
                PlatformAccount.user_id == user_id,
                PlatformAccount.platform == "instagram"
            )
        )
        account = existing.scalars().first()
        
        if account:
            account.access_token = access_token
            account.platform_user_id = platform_user_id
            account.platform_username = platform_username
            account.is_active = True
        else:
            new_account = PlatformAccount(
                user_id=user_id,
                platform="instagram",
                platform_user_id=platform_user_id,
                platform_username=platform_username,
                access_token=access_token,
                is_active=True,
            )
            db.add(new_account)
        
        await db.commit()
        logger.info(f"Instagram account saved for user {user_id}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save Instagram account: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save account: {str(e)}")

    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?instagram=success&connected=true"
    )
