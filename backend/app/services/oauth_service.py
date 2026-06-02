"""OAuth service — handle platform connection flows."""

import logging
import urllib.parse

import httpx

from app.config import get_settings
from app.core.oauth_state import generate_oauth_state, validate_oauth_state
from app.core.constants import Platform

logger = logging.getLogger(__name__)
settings = get_settings()


def get_linkedin_auth_url(state: str) -> str:
    """Get LinkedIn OAuth authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.linkedin_client_id,
        "redirect_uri": settings.linkedin_redirect_uri,
        "scope": "openid profile email w_member_social r_liteprofile r_basicprofile",  # Removed r_emailaddress and r_organization_social (not authorized)
        "state": state,
    }
    url = f"https://www.linkedin.com/oauth/v2/authorization?{urllib.parse.urlencode(params)}"
    print(f"DEBUG: Generated LinkedIn Auth URL: {url}")
    return url


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

        # Get user profile (try userinfo first, then fallback to v2/me)
        profile_resp = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if profile_resp.status_code == 200:
            profile = profile_resp.json()
            tokens["platform_user_id"] = profile.get("sub")
            tokens["platform_username"] = profile.get("name", profile.get("email"))
        else:
            # Fallback to v2/me
            me_resp = await client.get(
                "https://api.linkedin.com/v2/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if me_resp.status_code == 200:
                me = me_resp.json()
                tokens["platform_user_id"] = me.get("id")
                tokens["platform_username"] = f"{me.get('localizedFirstName', '')} {me.get('localizedLastName', '')}".strip()

        return tokens


def get_twitter_auth_url(state: str) -> str:
    """Get Twitter/X OAuth authorization URL with PKCE."""
    import hashlib
    import base64
    import secrets
    
    # Generate PKCE code verifier and challenge
    code_verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=')
    code_challenge = base64.urlsafe_b64encode(
        hashlib.sha256(code_verifier).digest()
    ).rstrip(b'=')
    
    # Store code_verifier in Redis for callback (temporary)
    # For now, we'll pass it in state (not ideal but works for dev)
    # In production, store in Redis with state as key
    
    params = {
        "response_type": "code",
        "client_id": settings.twitter_client_id,
        "redirect_uri": f"{settings.frontend_url}/api/v1/oauth/twitter/callback",
        "scope": "tweet.read tweet.write users.read offline.access",
        "state": state,
        "code_challenge": code_challenge.decode(),
        "code_challenge_method": "S256",
    }
    return f"https://twitter.com/i/oauth2/authorize?{urllib.parse.urlencode(params)}"


async def exchange_twitter_code(code: str, code_verifier: str) -> dict | None:
    """Exchange Twitter authorization code for tokens with PKCE."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.twitter.com/2/oauth2/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": f"{settings.frontend_url}/api/v1/oauth/twitter/callback",
                "client_id": settings.twitter_client_id,
                "code_verifier": code_verifier,
            },
            auth=(settings.twitter_client_id, ""),  # Basic auth with client_id
        )
        if response.status_code != 200:
            logger.error(f"Twitter token exchange failed: {response.text}")
            return None
        
        tokens = response.json()
        
        # Get user profile
        if "access_token" in tokens:
            try:
                user_resp = await client.get(
                    "https://api.twitter.com/2/users/me",
                    headers={"Authorization": f"Bearer {tokens['access_token']}"},
                )
                if user_resp.status_code == 200:
                    user_data = user_resp.json().get("data", {})
                    tokens["platform_user_id"] = user_data.get("id")
                    tokens["platform_username"] = user_data.get("username")
            except Exception as e:
                logger.error(f"Failed to get Twitter user profile: {e}")
        
        return tokens


def get_instagram_auth_url(state: str) -> str:
    """Get Instagram OAuth authorization URL."""
    params = {
        "response_type": "code",
        "client_id": settings.instagram_client_id,
        "redirect_uri": f"{settings.frontend_url}/api/v1/oauth/instagram/callback",
        "scope": "instagram_basic,instagram_content_publish,pages_show_list",
        "state": state,
    }
    return f"https://www.instagram.com/oauth/authorize?{urllib.parse.urlencode(params)}"


async def exchange_instagram_code(code: str) -> dict | None:
    """Exchange Instagram authorization code for tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.instagram.com/oauth/access_token",
            data={
                "client_id": settings.instagram_client_id,
                "client_secret": settings.instagram_client_secret,
                "grant_type": "authorization_code",
                "redirect_uri": f"{settings.frontend_url}/api/v1/oauth/instagram/callback",
                "code": code,
            },
        )
        if response.status_code != 200:
            logger.error(f"Instagram token exchange failed: {response.text}")
            return None
        
        tokens = response.json()
        
        # Instagram returns: access_token, user_id
        # We need to fetch additional profile info
        if "access_token" in tokens and "user_id" in tokens:
            try:
                # Get Instagram account details
                ig_user_id = tokens["user_id"]
                profile_resp = await client.get(
                    f"https://graph.instagram.com/{ig_user_id}",
                    params={
                        "fields": "id,username",
                        "access_token": tokens["access_token"]
                    }
                )
                if profile_resp.status_code == 200:
                    profile = profile_resp.json()
                    tokens["platform_user_id"] = profile.get("id")
                    tokens["platform_username"] = profile.get("username")
            except Exception as e:
                logger.error(f"Failed to get Instagram profile: {e}")
        
        return tokens
