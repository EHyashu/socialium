"""Trends router."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.trend_detection_service import detect_trends, create_trend, get_trending_keywords

router = APIRouter()


@router.get("/")
async def list_trends(db: AsyncSession = Depends(get_db)):
    """Get current trends."""
    trends = await detect_trends(db)
    return {"trends": trends}


@router.get("/keywords")
async def trending_keywords(
    industry: str = Query(default="technology"),
    count: int = Query(default=10, ge=1, le=20),
):
    """Get trending keywords for an industry (for Trend Boost feature).

    Fetches from Google Trends + Reddit, cached in Redis for 1 hour.
    Falls back to curated keywords if external APIs fail.
    """
    keywords = await get_trending_keywords(industry, count=count)
    return {"industry": industry, "keywords": keywords, "cached": True}


@router.post("/")
async def add_trend(
    keyword: str,
    platform: str,
    volume: float = 0.5,
    db: AsyncSession = Depends(get_db),
):
    """Add a new trend (admin/monitoring)."""
    trend = await create_trend(db, keyword, platform, volume)
    return {
        "id": str(trend.id),
        "keyword": trend.keyword,
        "platform": trend.platform,
        "volume_score": trend.volume_score,
    }
