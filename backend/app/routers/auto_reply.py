"""Auto-reply router."""

from fastapi import APIRouter, HTTPException, Query
from typing import List
from datetime import datetime, timedelta

from app.schemas.automation import AutoReplyConfig, AutoReplyResponse
from app.services.auto_reply_service import should_auto_reply, generate_reply

router = APIRouter()

# In-memory config store (use DB in production)
_configs: dict[str, AutoReplyConfig] = {}

# In-memory activity store (use DB in production)
_activities: list[dict] = []


@router.post("/config", response_model=AutoReplyResponse)
async def set_auto_reply_config(config: AutoReplyConfig):
    """Configure auto-reply settings."""
    key = f"{config.workspace_id}:{config.platform}"
    _configs[key] = config
    return AutoReplyResponse(
        id=key,
        workspace_id=config.workspace_id,
        platform=config.platform,
        is_enabled=config.is_enabled,
        reply_tone=config.reply_tone,
        max_replies_per_day=config.max_replies_per_day,
    )


@router.post("/test")
async def test_auto_reply(comment_text: str, platform: str, tone: str = "professional"):
    """Test auto-reply generation."""
    should_reply = await should_auto_reply(platform, comment_text)
    if not should_reply:
        return {"should_reply": False, "reply": None}

    reply = await generate_reply(comment_text, platform, tone)
    
    # Store activity for demo purposes
    activity = {
        "id": f"act_{len(_activities) + 1}",
        "platform": platform,
        "comment_text": comment_text,
        "reply_text": reply,
        "sentiment_score": 0.85,  # Would use real sentiment analysis
        "created_at": datetime.utcnow().isoformat(),
    }
    _activities.insert(0, activity)
    
    return {"should_reply": True, "reply": reply}


@router.get("/stats")
async def get_auto_reply_stats(workspace_id: str = Query(...)):
    """Get auto-reply statistics for a workspace."""
    today = datetime.utcnow().date()
    today_activities = [
        a for a in _activities
        if a.get("created_at", "").startswith(today.isoformat())
    ]
    
    total_replies = len(today_activities)
    avg_sentiment = (
        sum(a.get("sentiment_score", 0) for a in today_activities) / total_replies
        if total_replies > 0
        else 0
    )
    
    config = _configs.get(f"{workspace_id}:linkedin")
    is_enabled = config.is_enabled if config else True
    
    return {
        "total_replies_today": total_replies,
        "average_sentiment": avg_sentiment,
        "is_enabled": is_enabled,
    }


@router.get("/activity")
async def get_auto_reply_activity(workspace_id: str = Query(...)):
    """Get recent auto-reply activity for a workspace."""
    return _activities[:50]
