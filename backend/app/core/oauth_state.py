"""OAuth state management using Redis for secure CSRF protection."""

import json
import secrets
import time

import redis.asyncio as aioredis

from app.config import get_settings

settings = get_settings()

OAUTH_STATE_TTL = 600  # 10 minutes


async def _get_redis() -> aioredis.Redis:
    """Get an async Redis connection."""
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def generate_oauth_state(platform: str, user_id: str, redirect_path: str = "/platforms") -> str:
    """Generate a cryptographically random OAuth state and store it in Redis."""
    state = secrets.token_urlsafe(32)
    payload = {
        "platform": platform,
        "user_id": user_id,
        "redirect_path": redirect_path,
        "created_at": time.time(),
    }
    r = await _get_redis()
    await r.setex(f"oauth_state:{state}", OAUTH_STATE_TTL, json.dumps(payload))
    return state


async def validate_oauth_state(state: str) -> dict | None:
    """Validate an OAuth state from Redis, returning the stored payload if valid."""
    r = await _get_redis()
    key = f"oauth_state:{state}"
    data = await r.get(key)
    if data is None:
        return None
    # Delete after single use
    await r.delete(key)
    try:
        return json.loads(data)
    except json.JSONDecodeError:
        return None
