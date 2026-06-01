"""General-purpose rate limiting middleware for FastAPI.

Implements per-IP rate limiting with configurable limits.
Uses Redis for distributed rate limiting (falls back to in-memory for dev).
"""

import time
from collections import defaultdict
from typing import Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings

settings = get_settings()

# In-memory fallback (dev only — resets on restart)
_ip_counters: dict[str, dict[str, float | int]] = defaultdict(
    lambda: {"count": 0, "reset_at": 0.0}
)


class RateLimitConfig:
    """Rate limiting configuration."""
    
    # Default limits (requests per window)
    DEFAULT_REQUESTS_PER_MINUTE = 60
    DEFAULT_REQUESTS_PER_HOUR = 1000
    
    # Auth endpoints (stricter limits)
    AUTH_REQUESTS_PER_MINUTE = 10
    AUTH_REQUESTS_PER_HOUR = 50
    
    # AI generation endpoints (expensive operations)
    AI_REQUESTS_PER_MINUTE = 20
    AI_REQUESTS_PER_HOUR = 200
    
    # Window sizes (in seconds)
    MINUTE_WINDOW = 60
    HOUR_WINDOW = 3600


async def _check_rate_limit_redis(
    ip: str,
    endpoint_type: str,
    limit: int,
    window: int,
) -> tuple[bool, int, int]:
    """Check rate limit using Redis.
    
    Returns:
        (allowed, current_count, limit)
    """
    try:
        import redis.asyncio as aioredis
        
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        key = f"ratelimit:{endpoint_type}:{ip}:{int(time.time() // window)}"
        
        current = await r.get(key)
        count = int(current) if current else 0
        
        if count >= limit:
            await r.close()
            return False, count, limit
        
        # Increment counter
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, window)
        await pipe.execute()
        await r.close()
        
        return True, count + 1, limit
        
    except Exception:
        # Fallback to in-memory
        return _check_rate_limit_memory(ip, endpoint_type, limit, window)


def _check_rate_limit_memory(
    ip: str,
    endpoint_type: str,
    limit: int,
    window: int,
) -> tuple[bool, int, int]:
    """Check rate limit using in-memory dictionary (dev fallback)."""
    key = f"{endpoint_type}:{ip}"
    now = time.time()
    entry = _ip_counters[key]
    
    # Reset if window has passed
    if now - entry["reset_at"] > window:
        entry["count"] = 0
        entry["reset_at"] = now
    
    if entry["count"] >= limit:
        return False, entry["count"], limit
    
    entry["count"] += 1
    return True, entry["count"], limit


def _get_endpoint_type(path: str) -> tuple[str, int, int]:
    """Determine endpoint type and appropriate limits.
    
    Returns:
        (endpoint_type, requests_per_minute, requests_per_hour)
    """
    # Auth endpoints
    if "/auth/" in path or "/oauth/" in path:
        return ("auth", RateLimitConfig.AUTH_REQUESTS_PER_MINUTE, RateLimitConfig.AUTH_REQUESTS_PER_HOUR)
    
    # AI/content generation endpoints
    if "/content/generate" in path or "/scheduling/ai-" in path:
        return ("ai", RateLimitConfig.AI_REQUESTS_PER_MINUTE, RateLimitConfig.AI_REQUESTS_PER_HOUR)
    
    # API endpoints (general)
    if "/api/" in path:
        return ("api", RateLimitConfig.DEFAULT_REQUESTS_PER_MINUTE, RateLimitConfig.DEFAULT_REQUESTS_PER_HOUR)
    
    # Health and public endpoints (no rate limit)
    if path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
        return ("public", 999999, 999999)
    
    # Default
    return ("default", RateLimitConfig.DEFAULT_REQUESTS_PER_MINUTE, RateLimitConfig.DEFAULT_REQUESTS_PER_HOUR)


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limits on API endpoints."""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Get client IP (handle proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        # Determine endpoint type and limits
        path = request.url.path
        endpoint_type, rpm_limit, rph_limit = _get_endpoint_type(path)
        
        # Check minute-level rate limit
        allowed, count, limit = await _check_rate_limit_redis(
            client_ip, endpoint_type, rpm_limit, RateLimitConfig.MINUTE_WINDOW
        )
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "detail": f"Too many requests. Limit: {limit} requests per minute.",
                    "retry_after": RateLimitConfig.MINUTE_WINDOW,
                },
                headers={
                    "Retry-After": str(RateLimitConfig.MINUTE_WINDOW),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + RateLimitConfig.MINUTE_WINDOW),
                },
            )
        
        # Add rate limit headers to successful responses
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - count))
        response.headers["X-RateLimit-Reset"] = str(
            int(time.time()) + RateLimitConfig.MINUTE_WINDOW
        )
        
        return response
