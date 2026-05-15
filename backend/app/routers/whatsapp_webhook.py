"""WhatsApp webhook router — WapiHub inbound messages."""

import hashlib
import hmac

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.services.whatsapp_notification_service import send_whatsapp_message

router = APIRouter()
settings = get_settings()


@router.post("/webhook")
async def whatsapp_webhook(request: Request):
    """Receive WhatsApp webhook events from WapiHub."""
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Handle WhatsApp incoming messages
    messages = body.get("messages", [])
    for msg in messages:
        from_number = msg.get("from")
        text = msg.get("text", {}).get("body", "")

        if from_number and text:
            # Auto-reply or forward to notification system
            await send_whatsapp_message(
                phone_number=from_number,
                message=f"Thanks for your message! We'll get back to you soon.",
            )

    return {"status": "received"}
