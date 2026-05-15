"""WhatsApp webhook router — WapiHub inbound messages for approval cycle."""

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.content import Content
from app.models.user import User
from app.core.constants import ContentStatus
from app.services.whatsapp_notification_service import (
    send_whatsapp_message,
    send_approval_result_notification,
)

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()

# Approval keywords mapping
APPROVE_KEYWORDS = {"1", "approve", "yes", "ok", "\u2705", "publish"}
REGENERATE_KEYWORDS = {"2", "regenerate", "redo", "again", "\U0001f504", "retry"}
REJECT_KEYWORDS = {"3", "reject", "no", "discard", "\u274c", "delete"}


def _parse_approval_action(text: str) -> str | None:
    """Parse user reply into an approval action."""
    clean = text.strip().lower()
    if clean in APPROVE_KEYWORDS:
        return "approve"
    if clean in REGENERATE_KEYWORDS:
        return "regenerate"
    if clean in REJECT_KEYWORDS:
        return "reject"
    return None


@router.post("/webhook")
async def whatsapp_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive WhatsApp webhook events from WapiHub.

    Handles the approval cycle:
    - When a user replies to an approval message, parse their response
    - Update the content status accordingly
    - Send confirmation back
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    logger.info(f"WhatsApp webhook received: {body}")

    # Handle WhatsApp incoming messages
    messages = body.get("messages", [])
    for msg in messages:
        from_number = msg.get("from", "").strip()
        text = msg.get("text", {}).get("body", "").strip()

        if not from_number or not text:
            continue

        # Normalize phone number (remove + prefix for matching)
        normalized_phone = from_number.lstrip("+")

        # Try to parse as an approval action
        action = _parse_approval_action(text)

        if action:
            # Find the user by phone number
            user_query = select(User).where(
                (User.phone_number == from_number) |
                (User.phone_number == normalized_phone) |
                (User.phone_number == f"+{normalized_phone}")
            )
            result = await db.execute(user_query)
            user = result.scalars().first()

            if not user:
                await send_whatsapp_message(
                    phone_number=from_number,
                    message="\u26a0\ufe0f Sorry, we couldn't find an account linked to this number. Please register your WhatsApp number in Socialium settings.",
                )
                continue

            # Find the most recent pending_approval content for this user
            content_query = (
                select(Content)
                .where(
                    Content.author_id == user.id,
                    Content.status == ContentStatus.PENDING_APPROVAL,
                )
                .order_by(Content.updated_at.desc())
                .limit(1)
            )
            content_result = await db.execute(content_query)
            content = content_result.scalars().first()

            if not content:
                await send_whatsapp_message(
                    phone_number=from_number,
                    message="\u2139\ufe0f No content pending approval right now. Generate content first from the Socialium dashboard.",
                )
                continue

            # Process the approval action
            if action == "approve":
                content.status = ContentStatus.APPROVED
                logger.info(f"Content {content.id} approved via WhatsApp by {user.email}")
            elif action == "regenerate":
                content.status = ContentStatus.DRAFT
                logger.info(f"Content {content.id} sent for regeneration via WhatsApp by {user.email}")
            elif action == "reject":
                content.status = ContentStatus.REJECTED
                logger.info(f"Content {content.id} rejected via WhatsApp by {user.email}")

            await db.commit()

            # Send confirmation
            await send_approval_result_notification(
                phone_number=from_number,
                platform=content.platform.value if content.platform else "general",
                action=action,
            )
        else:
            # Not an approval command — send help message
            await send_whatsapp_message(
                phone_number=from_number,
                message=(
                    "\U0001f44b Hi! I handle content approvals for Socialium.\n\n"
                    "If you have content pending approval, reply with:\n"
                    "  *1* or *Approve* \u2014 Publish\n"
                    "  *2* or *Regenerate* \u2014 Create new version\n"
                    "  *3* or *Reject* \u2014 Discard\n\n"
                    "Or visit your dashboard to manage content."
                ),
            )

    return {"status": "received"}


@router.get("/webhook")
async def whatsapp_webhook_verify(request: Request):
    """WapiHub webhook verification (GET challenge)."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.wapihub_webhook_secret:
        logger.info("WhatsApp webhook verified")
        return int(challenge) if challenge else "ok"

    raise HTTPException(status_code=403, detail="Verification failed")
