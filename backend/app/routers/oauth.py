"""OAuth router — authorization URLs and callbacks."""

import logging

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.core.oauth_state import generate_oauth_state, validate_oauth_state
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
async def linkedin_authorize(user_id: str = Query(...)):
    """Get LinkedIn OAuth authorization URL."""
    state = await generate_oauth_state(
        platform="linkedin", user_id=user_id, redirect_path="/platforms"
    )
    url = get_linkedin_auth_url(state)
    return {"authorization_url": url}


@router.get("/linkedin/callback")
async def linkedin_callback(code: str, state: str = ""):
    """LinkedIn OAuth callback."""
    payload = await validate_oauth_state(state)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    tokens = await exchange_linkedin_code(code, settings.linkedin_redirect_uri)
    if not tokens:
        raise HTTPException(status_code=400, detail="LinkedIn token exchange failed")

    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?linkedin=success"
    )


@router.get("/twitter/authorize")
async def twitter_authorize(user_id: str = Query(...)):
    """Get Twitter OAuth authorization URL."""
    state = await generate_oauth_state(
        platform="twitter", user_id=user_id, redirect_path="/platforms"
    )
    url = get_twitter_auth_url(state)
    return {"authorization_url": url}


@router.get("/twitter/callback")
async def twitter_callback(code: str, state: str = ""):
    """Twitter OAuth callback."""
    payload = await validate_oauth_state(state)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    tokens = await exchange_twitter_code(code, "placeholder_verifier")
    if not tokens:
        raise HTTPException(status_code=400, detail="Twitter token exchange failed")

    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?twitter=success"
    )


@router.get("/instagram/authorize")
async def instagram_authorize(user_id: str = Query(...)):
    """Get Instagram OAuth authorization URL."""
    state = await generate_oauth_state(
        platform="instagram", user_id=user_id, redirect_path="/platforms"
    )
    url = get_instagram_auth_url(state)
    return {"authorization_url": url}


@router.get("/instagram/callback")
async def instagram_callback(code: str, state: str = ""):
    """Instagram OAuth callback."""
    payload = await validate_oauth_state(state)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    tokens = await exchange_instagram_code(code)
    if not tokens:
        raise HTTPException(status_code=400, detail="Instagram token exchange failed")

    redirect_path = payload.get("redirect_path", "/platforms")
    return RedirectResponse(
        url=f"{settings.frontend_url}{redirect_path}?instagram=success"
    )
