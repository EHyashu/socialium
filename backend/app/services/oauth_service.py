"""OAuth service — handle platform connection flows."""

import logging
import urllib.parse

import httpx

from app.config import get_settings
from app.core.oauth_state import generate_oauth_state, validate_oauth_state
from app.core.constants import Platform

logger = logging.getLogger(__name__)
settings = get_settings()


def get_linkedin_auth_url(user_id: str) -> str:
    """Get LinkedIn OAuth authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "scope": "openid profile w_member_social email",
    }
    return f"https://www.linkedin.com/oauth/v2/authorization?{urllib.parse.urlencode(params)}"


async def exchange_linkedin_code(code: str, redirect_uri: str) -> dict | None:
    """Exchange LinkedIn authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
        )
        if response.status_code != 200:
            logger.error(f"LinkedIn token exchange failed: {response.text}")
            return None

        tokens = response.json()
        access_token = tokens.get("access_token")

        # Get user profile
        profile_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if profile_resp.status_code != 200:
            return tokens

        profile = profile_resp.json()
        tokens["platform_user_id"] = profile.get("sub")
        tokens["platform_username"] = profile.get("name", profile.get("email"))

        return tokens


def get_twitter_auth_url(user_id: str) -> str:
    """Get Twitter/X OAuth authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.twitter_client_id,
        "redirect_uri": f"{settings.frontend_url}/platforms/twitter/callback",
        "scope": "tweet.read tweet.write users.read offline.access",
        "state": "twitter_placeholder",  # Will be replaced with actual state
        "code_challenge": "placeholder",
        "code_challenge_method": "S256",
    }
    return f"https://twitter.com/i/oauth2/authorize?{urllib.parse.urlencode(params)}"


async def exchange_twitter_code(code: str, code_verifier: str) -> dict | None:
    """Exchange Twitter authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": f"{settings.frontend_url}/platforms/twitter/callback",
                "client_id": settings.twitter_client_id,
                "code_verifier": code_verifier,
            },
        )
        if response.status_code != 200:
            logger.error(f"Twitter token exchange failed: {response.text}")
            return None
        return response.json()


def get_instagram_auth_url(user_id: str) -> str:
    """Get Instagram OAuth authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.instagram_client_id,
        "redirect_uri": f"{settings.frontend_url}/platforms/instagram/callback",
        "scope": "instagram_basic,instagram_content_publish,pages_show_list",
    }
    return f"https://api.instagram.com/oauth/authorize?{urllib.parse.urlencode(params)}"


async def exchange_instagram_code(code: str) -> dict | None:
    """Exchange Instagram authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": settings.instagram_client_id,
                "client_secret": settings.instagram_client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.frontend_url}/platforms/instagram/callback",
                "code": code,
            },
        )
        if response.status_code != 200:
            logger.error(f"Instagram token exchange failed: {response.text}")
            return None
        return response.json()
