"""Analytics router."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.analytics_service import get_analytics_summary

router = APIRouter()


@router.get("/overview")
async def get_analytics_overview(
    workspace_id: str = Query(...),
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Get analytics overview for dashboard."""
    import uuid as uuid_mod
    from datetime import datetime, timedelta

    # Calculate date range based on days parameter
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)

    # Convert workspace_id to UUID
    try:
        workspace_uuid = uuid_mod.UUID(workspace_id)
    except ValueError:
        return {"error": "Invalid workspace_id format"}

    data = await get_analytics_summary(
        db=db,
        workspace_id=workspace_uuid,
        platform=None,
        start_date=start_date.date(),
        end_date=end_date.date(),
    )
    return data


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
