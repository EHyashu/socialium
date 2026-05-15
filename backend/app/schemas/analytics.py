"""Analytics schemas."""

import uuid
from datetime import datetime, date

from pydantic import BaseModel


class AnalyticsQuery(BaseModel):
    workspace_id: uuid.UUID | None = None
    platform: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    group_by: str | None = "day"  # day, week, month


class AnalyticsSummary(BaseModel):
    total_posts: int = 0
    total_impressions: int = 0
    total_likes: int = 0
    total_comments: int = 0
    total_shares: int = 0
    total_clicks: int = 0
    average_engagement_rate: float = 0.0


class PlatformBreakdown(BaseModel):
    platform: str
    posts: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    engagement_rate: float = 0.0


class TimeSeriesPoint(BaseModel):
    date: str
    value: float
    label: str | None = None


class AnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    platform_breakdown: list[PlatformBreakdown]
    time_series: list[TimeSeriesPoint]
    top_posts: list[dict]
