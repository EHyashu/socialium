"""Per-workspace rate limiting for AI generation endpoints.

Uses Redis with daily rolling counters. Falls back to in-memory dict if Redis
is unavailable (dev mode only — production MUST have Redis).
"""

import time
from collections import defaultdict
from typing import Optional

from app.config import get_settings
from app.core.constants import SubscriptionTier, TIER_LIMITS

settings = get_settings()

# In-memory fallback (dev only — resets on restart)
_memory_counters: dict[str, dict[str, int | float]] = defaultdict(
    lambda: {"count": 0, "reset_at": 0.0}
)


def _today_key(workspace_id: str) -> str:
    """Redis key scoped to workspace + day."""
    from datetime import date

    return f"ratelimit:gen:{workspace_id}:{date.today().isoformat()}"


async def check_generation_limit(
    workspace_id: str,
    tier: SubscriptionTier = SubscriptionTier.FREE,
) -> tuple[bool, int, int]:
    """Check if a workspace can generate more content today.

    Returns:
        (allowed, current_count, daily_limit)
    """
    daily_limit = TIER_LIMITS[tier]["ai_generations_per_day"]

    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        key = _today_key(workspace_id)

        current = await r.get(key)
        count = int(current) if current else 0
        await r.close()

        return count < daily_limit, count, daily_limit

    except Exception:
        # Fallback to in-memory (development mode)
        now = time.time()
        entry = _memory_counters[workspace_id]
        # Reset if day has passed (approximate: every 86400s)
        if now - entry["reset_at"] > 86400:
            entry["count"] = 0
            entry["reset_at"] = now

        return entry["count"] < daily_limit, entry["count"], daily_limit


async def increment_generation_count(
    workspace_id: str,
) -> None:
    """Increment the generation counter after a successful generation."""
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        key = _today_key(workspace_id)

        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, 86400)  # Auto-expire after 24h
        await pipe.execute()
        await r.close()

    except Exception:
        # Fallback to in-memory
        _memory_counters[workspace_id]["count"] += 1
