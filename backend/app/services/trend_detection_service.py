"""Trend detection service — real-time trending keywords via Google Trends + Reddit.

Flow:
1. Check Redis cache (key = "trends:{industry}", TTL = 1 hour)
2. On cache miss, fetch from Google Trends (pytrends) + Reddit (/r/{sub}/hot.json)
3. Combine, deduplicate, score by frequency
4. Cache results in Redis
5. Fallback to curated static data if external APIs fail
"""

import json
import logging
import re
from collections import Counter
from datetime import datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.trend import Trend

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Industry → Subreddit mapping ───────────────────────────────────────────
INDUSTRY_TO_SUBREDDIT: dict[str, str] = {
    "technology": "technology",
    "marketing": "marketing",
    "business": "business",
    "finance": "personalfinance",
    "health": "health",
    "education": "education",
    "other": "trending",
}

# ─── Redis helpers ───────────────────────────────────────────────────────────
_redis_client = None

CACHE_TTL_SECONDS = 3600  # 1 hour


async def _get_redis():
    """Lazy-init async Redis connection."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis_client.ping()
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable for trend cache: {e}")
        return None


async def _get_cached(key: str) -> list[dict] | None:
    """Get cached trend keywords from Redis."""
    r = await _get_redis()
    if not r:
        return None
    try:
        data = await r.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis cache read failed: {e}")
    return None


async def _set_cached(key: str, value: list[dict]) -> None:
    """Store trend keywords in Redis with TTL."""
    r = await _get_redis()
    if not r:
        return
    try:
        await r.set(key, json.dumps(value), ex=CACHE_TTL_SECONDS)
    except Exception as e:
        logger.warning(f"Redis cache write failed: {e}")


# ─── Google Trends source ────────────────────────────────────────────────────

async def _fetch_google_trends(industry: str, count: int = 5) -> list[dict]:
    """Fetch rising related queries from Google Trends via pytrends."""
    try:
        from pytrends.request import TrendReq

        pytrends = TrendReq(hl="en-US", tz=360, timeout=(10, 25))
        pytrends.build_payload(kw_list=[industry], timeframe="now 7-d")
        related_queries = pytrends.related_queries()

        rising = related_queries.get(industry, {}).get("rising")
        if rising is not None and not rising.empty:
            keywords = rising["query"].head(count).tolist()
            return [
                {"keyword": kw, "trend_score": max(95 - i * 5, 50), "source": "google"}
                for i, kw in enumerate(keywords)
            ]
    except Exception as e:
        logger.warning(f"Google Trends fetch failed for '{industry}': {e}")
    return []


# ─── Reddit source ───────────────────────────────────────────────────────────

_STOP_WORDS = set(
    "the a an is are was were be been being have has had do does did will would "
    "shall should may might can could of in to for on with at by from as into "
    "through during before after above below between out off over under about "
    "i me my we our you your he him his she her it its they them their this that "
    "these those am just very also not and but or if so no nor".split()
)


def _extract_keywords_from_titles(titles: list[str]) -> list[str]:
    """Extract meaningful keywords/phrases from Reddit post titles."""
    word_counter: Counter = Counter()
    for title in titles:
        # Clean title
        clean = re.sub(r"[^a-zA-Z0-9\s]", " ", title.lower())
        words = [w for w in clean.split() if len(w) > 3 and w not in _STOP_WORDS]
        word_counter.update(words)

    # Also extract bigrams (two-word phrases)
    bigram_counter: Counter = Counter()
    for title in titles:
        clean = re.sub(r"[^a-zA-Z0-9\s]", " ", title.lower())
        words = [w for w in clean.split() if len(w) > 2 and w not in _STOP_WORDS]
        for i in range(len(words) - 1):
            bigram_counter[f"{words[i]} {words[i+1]}"] += 1

    # Combine: prefer bigrams with count >= 2, then top single words
    results = []
    for phrase, count in bigram_counter.most_common(5):
        if count >= 2:
            results.append(phrase)
    for word, count in word_counter.most_common(10):
        if word not in " ".join(results) and len(results) < 10:
            results.append(word)

    return results[:10]


async def _fetch_reddit_trends(industry: str, count: int = 5) -> list[dict]:
    """Fetch trending keywords from Reddit hot posts."""
    subreddit = INDUSTRY_TO_SUBREDDIT.get(industry.lower(), "trending")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://www.reddit.com/r/{subreddit}/hot.json",
                headers={"User-Agent": "Socialium/1.0 (content-trends)"},
                params={"limit": 15},
            )
            response.raise_for_status()
            data = response.json()
            posts = data.get("data", {}).get("children", [])
            titles = [p["data"]["title"] for p in posts if p.get("data", {}).get("title")]

            keywords = _extract_keywords_from_titles(titles)
            return [
                {"keyword": kw, "trend_score": max(90 - i * 4, 50), "source": "reddit"}
                for i, kw in enumerate(keywords[:count])
            ]
    except Exception as e:
        logger.warning(f"Reddit trends fetch failed for r/{subreddit}: {e}")
    return []


# ─── Static fallback data ────────────────────────────────────────────────────

_FALLBACK_TRENDS: dict[str, list[dict]] = {
    "technology": [
        {"keyword": "AI agents", "trend_score": 95, "source": "curated"},
        {"keyword": "LLM fine-tuning", "trend_score": 88, "source": "curated"},
        {"keyword": "edge computing", "trend_score": 76, "source": "curated"},
        {"keyword": "developer experience", "trend_score": 72, "source": "curated"},
        {"keyword": "open source", "trend_score": 68, "source": "curated"},
    ],
    "marketing": [
        {"keyword": "short-form video", "trend_score": 92, "source": "curated"},
        {"keyword": "creator economy", "trend_score": 85, "source": "curated"},
        {"keyword": "brand storytelling", "trend_score": 78, "source": "curated"},
        {"keyword": "community-led growth", "trend_score": 74, "source": "curated"},
        {"keyword": "micro-influencers", "trend_score": 70, "source": "curated"},
    ],
    "business": [
        {"keyword": "remote work culture", "trend_score": 90, "source": "curated"},
        {"keyword": "sustainable business", "trend_score": 82, "source": "curated"},
        {"keyword": "bootstrapping", "trend_score": 75, "source": "curated"},
        {"keyword": "async communication", "trend_score": 71, "source": "curated"},
        {"keyword": "talent retention", "trend_score": 66, "source": "curated"},
    ],
    "finance": [
        {"keyword": "fintech innovation", "trend_score": 88, "source": "curated"},
        {"keyword": "decentralized finance", "trend_score": 80, "source": "curated"},
        {"keyword": "embedded payments", "trend_score": 74, "source": "curated"},
        {"keyword": "financial literacy", "trend_score": 70, "source": "curated"},
        {"keyword": "neobanks", "trend_score": 65, "source": "curated"},
    ],
    "health": [
        {"keyword": "mental wellness", "trend_score": 91, "source": "curated"},
        {"keyword": "wearable tech", "trend_score": 83, "source": "curated"},
        {"keyword": "preventive care", "trend_score": 76, "source": "curated"},
        {"keyword": "digital therapeutics", "trend_score": 72, "source": "curated"},
        {"keyword": "longevity", "trend_score": 68, "source": "curated"},
    ],
    "education": [
        {"keyword": "AI tutoring", "trend_score": 89, "source": "curated"},
        {"keyword": "micro-credentials", "trend_score": 81, "source": "curated"},
        {"keyword": "project-based learning", "trend_score": 75, "source": "curated"},
        {"keyword": "cohort courses", "trend_score": 70, "source": "curated"},
        {"keyword": "lifelong learning", "trend_score": 66, "source": "curated"},
    ],
}


# ─── Public API ──────────────────────────────────────────────────────────────

async def get_trending_keywords(industry: str, count: int = 10) -> list[dict]:
    """Get trending keywords for a given industry.

    1. Check Redis cache (TTL 1h)
    2. On miss: fetch Google Trends + Reddit in parallel
    3. Combine, deduplicate, score
    4. Cache in Redis
    5. Fallback to static keywords on failure
    """
    industry_lower = industry.lower()
    cache_key = f"trends:{industry_lower}"

    # 1. Check cache
    cached = await _get_cached(cache_key)
    if cached:
        logger.debug(f"Trends cache hit for '{industry_lower}'")
        return cached[:count]

    # 2. Fetch from both sources
    google_results = await _fetch_google_trends(industry_lower, count=5)
    reddit_results = await _fetch_reddit_trends(industry_lower, count=5)

    # 3. Combine and deduplicate
    combined: list[dict] = []
    seen_keywords: set[str] = set()

    for item in sorted(google_results + reddit_results, key=lambda x: x["trend_score"], reverse=True):
        kw_lower = item["keyword"].lower().strip()
        if kw_lower not in seen_keywords and len(kw_lower) > 2:
            seen_keywords.add(kw_lower)
            combined.append(item)

    # 4. If we got real data, cache it and return
    if combined:
        await _set_cached(cache_key, combined[:count])
        return combined[:count]

    # 5. Fallback to static curated keywords
    logger.info(f"All trend sources failed for '{industry_lower}', using fallback")
    fallback = _FALLBACK_TRENDS.get(industry_lower, _FALLBACK_TRENDS["technology"])
    await _set_cached(cache_key, fallback)  # cache fallback too to avoid hammering APIs
    return fallback[:count]


# ─── DB-based trend functions (unchanged) ────────────────────────────────────

async def detect_trends(db: AsyncSession) -> list[dict]:
    """Detect trending topics from recent content activity."""
    recent = datetime.utcnow() - timedelta(hours=24)
    result = await db.execute(
        select(Trend).where(Trend.detected_at >= recent).order_by(Trend.volume_score.desc()).limit(20)
    )
    trends = result.scalars().all()

    return [
        {
            "id": str(t.id),
            "keyword": t.keyword,
            "platform": t.platform,
            "description": t.description,
            "volume_score": t.volume_score,
            "sentiment_score": t.sentiment_score,
            "related_hashtags": t.related_hashtags,
            "detected_at": t.detected_at.isoformat() if t.detected_at else None,
            "expires_at": t.expires_at.isoformat() if t.expires_at else None,
        }
        for t in trends
    ]


async def create_trend(db: AsyncSession, keyword: str, platform: str, volume: float = 0.5) -> Trend:
    """Create a new trend entry."""
    trend = Trend(
        keyword=keyword,
        platform=platform,
        volume_score=volume,
        sentiment_score=0.0,
        detected_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db.add(trend)
    await db.commit()
    await db.refresh(trend)
    return trend
