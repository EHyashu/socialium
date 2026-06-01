"""Auto-reply router."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.automation import AutoReplyConfig, AutoReplyResponse
from app.services.auto_reply_service import should_auto_reply, generate_reply

router = APIRouter()

# In-memory config store (use DB in production)
_configs: dict[str, AutoReplyConfig] = {}


class AutoReplyTestRequest(BaseModel):
    """Request model for testing auto-reply."""
    comment_text: str
    platform: str
    tone: str = "professional"


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
async def test_auto_reply(request: AutoReplyTestRequest):
    """Test auto-reply generation."""
    should_reply = await should_auto_reply(request.platform, request.comment_text)
    if not should_reply:
        return {"should_reply": False, "reply": None}

    reply = await generate_reply(request.comment_text, request.platform, request.tone)
    return {"should_reply": True, "reply": reply}
