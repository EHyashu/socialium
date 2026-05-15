"""Analytics service — compute engagement metrics."""

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.analytics import AnalyticsEvent

logger = logging.getLogger(__name__)


async def get_analytics_summary(
    db: AsyncSession,
    workspace_id: str | None = None,
    platform: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> dict:
    """Get aggregated analytics summary."""

    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    # Query content within date range
    content_query = select(Content).where(
        Content.created_at >= start_date,
        Content.created_at <= end_date,
    )
    if workspace_id:
        content_query = content_query.where(Content.workspace_id == workspace_id)
    if platform:
        content_query = content_query.where(Content.platform == platform)

    result = await db.execute(content_query)
    contents = result.scalars().all()

    total_posts = len(contents)
    total_likes = sum(c.like_count or 0 for c in contents)
    total_comments = sum(c.comment_count or 0 for c in contents)
    total_shares = sum(c.share_count or 0 for c in contents)
    total_impressions = sum(c.engagement_count or 0 for c in contents)

    # Platform breakdown
    platform_data: dict[str, dict] = {}
    for c in contents:
        plat = c.platform or "unknown"
        if plat not in platform_data:
            platform_data[plat] = {"posts": 0, "likes": 0, "comments": 0, "shares": 0}
        platform_data[plat]["posts"] += 1
        platform_data[plat]["likes"] += c.like_count or 0
        platform_data[plat]["comments"] += c.comment_count or 0
        platform_data[plat]["shares"] += c.share_count or 0

    platform_breakdown = []
    for plat, data in platform_data.items():
        engagement = data["likes"] + data["comments"] + data["shares"]
        rate = (engagement / max(data["posts"], 1)) * 100
        platform_breakdown.append({
            "platform": plat,
            "posts": data["posts"],
            "likes": data["likes"],
            "comments": data["comments"],
            "shares": data["shares"],
            "engagement_rate": round(rate, 2),
        })

    # Time series
    time_series = []
    current = start_date
    while current <= end_date:
        day_posts = [c for c in contents if c.created_at.date() == current]
        engagement = sum((c.like_count or 0) + (c.comment_count or 0) + (c.share_count or 0) for c in day_posts)
        time_series.append({
            "date": current.isoformat(),
            "value": engagement,
            "label": current.strftime("%b %d"),
        })
        current += timedelta(days=1)

    # Top posts
    sorted_posts = sorted(contents, key=lambda c: c.like_count + c.comment_count + c.share_count, reverse=True)
    top_posts = []
    for c in sorted_posts[:5]:
        top_posts.append({
            "id": str(c.id),
            "title": c.title,
            "platform": c.platform,
            "likes": c.like_count,
            "comments": c.comment_count,
            "shares": c.share_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    total_engagement = total_likes + total_comments + total_shares
    avg_engagement_rate = round((total_engagement / max(total_posts, 1)) * 100, 2)

    return {
        "summary": {
            "total_posts": total_posts,
            "total_impressions": total_impressions,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "total_shares": total_shares,
            "total_clicks": 0,
            "average_engagement_rate": avg_engagement_rate,
        },
        "platform_breakdown": platform_breakdown,
        "time_series": time_series,
        "top_posts": top_posts,
    }
