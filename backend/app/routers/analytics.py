"""Analytics router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.analytics_service import get_analytics_summary

router = APIRouter()


@router.get("/")
async def get_analytics(
    workspace_id: str | None = Query(None),
    platform: str | None = Query(None),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics data."""
    from datetime import date

    sd = date.fromisoformat(start_date) if start_date else None
    ed = date.fromisoformat(end_date) if end_date else None

    data = await get_analytics_summary(
        db=db,
        workspace_id=workspace_id,
        platform=platform,
        start_date=sd,
        end_date=ed,
    )
    return data
