"""Supabase client utilities for backend-only auth."""

from functools import lru_cache

import httpx

from app.config import get_settings

settings = get_settings()


@lru_cache
def get_supabase_headers() -> dict[str, str]:
    """Get Supabase API headers for service role operations."""
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


async def supabase_get_user(access_token: str) -> dict | None:
    """Get user from Supabase using access token."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "apikey": settings.supabase_anon_key,
                "Authorization": f"Bearer {access_token}",
            },
        )
        if response.status_code == 200:
            return response.json()
        return None


async def supabase_admin_get_user(user_id: str) -> dict | None:
    """Get user by ID using service role (admin)."""
    headers = get_supabase_headers()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers=headers,
        )
        if response.status_code == 200:
            return response.json()
        return None


async def supabase_admin_list_users(page: int = 1, per_page: int = 50) -> list[dict]:
    """List all users using service role (admin)."""
    headers = get_supabase_headers()
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=headers,
            params={"page": page, "per_page": per_page},
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("users", data) if isinstance(data, dict) else data
        return []


async def supabase_admin_delete_user(user_id: str) -> bool:
    """Delete a user using service role (admin)."""
    headers = get_supabase_headers()
    async with httpx.AsyncClient() as client:
        response = await client.delete(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers=headers,
        )
        return response.status_code == 200


async def supabase_sign_up(email: str, password: str) -> dict | None:
    """Create a new user in Supabase Auth using admin API (auto-confirms)."""
    headers = get_supabase_headers()
    async with httpx.AsyncClient() as client:
        # Use admin endpoint to create pre-confirmed user
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            headers=headers,
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
            },
        )
        if response.status_code in (200, 201):
            user_data = response.json()
            # Now sign in to get tokens
            sign_in_result = await supabase_sign_in(email, password)
            if sign_in_result:
                return sign_in_result
            # Fallback: return user data without tokens
            return user_data
        return None


async def supabase_sign_in(email: str, password: str) -> dict | None:
    """Sign in user with email/password."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=password",
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
        if response.status_code == 200:
            return response.json()
        return None


async def supabase_refresh_token(refresh_token: str) -> dict | None:
    """Refresh an access token."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{settings.supabase_url}/auth/v1/token?grant_type=refresh_token",
            headers={
                "apikey": settings.supabase_anon_key,
                "Content-Type": "application/json",
            },
            json={"refresh_token": refresh_token},
        )
        if response.status_code == 200:
            return response.json()
        return None
