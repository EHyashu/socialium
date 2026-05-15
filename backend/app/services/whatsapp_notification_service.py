"""WhatsApp notification service via WapiHub."""

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def send_whatsapp_message(
    phone_number: str,
    message: str,
) -> bool:
    """Send a WhatsApp message via WapiHub API."""
    if not settings.wapihub_api_key:
        logger.warning("WapiHub API key not configured, skipping WhatsApp message")
        return False

    url = f"{settings.wapihub_url}/messages"

    payload = {
        "phone": phone_number,
        "message": message,
    }

    headers = {
        "Authorization": f"Bearer {settings.wapihub_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code in (200, 201):
                logger.info(f"WhatsApp message sent to {phone_number}")
                return True
            else:
                logger.error(f"WapiHub error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return False


async def send_approval_notification(
    phone_number: str,
    content_id: str,
    platform: str,
    content_preview: str,
    title: str | None = None,
) -> bool:
    """Send WhatsApp approval notification for generated content.

    The user can reply with:
      - \"1\" or \"Approve\" to approve
      - \"2\" or \"Regenerate\" to request regeneration
      - \"3\" or \"Reject\" to reject
    """
    # Truncate preview to fit WhatsApp message limits
    preview = content_preview[:300] + ("..." if len(content_preview) > 300 else "")

    message = (
        f"\U0001f4dd *New Content Ready for Approval*\n"
        f"\n"
        f"\U0001f4cc *Platform:* {platform.capitalize()}\n"
    )
    if title:
        message += f"\U0001f3af *Topic:* {title}\n"
    message += (
        f"\n"
        f"---\n"
        f"{preview}\n"
        f"---\n"
        f"\n"
        f"Reply with:\n"
        f"  *1* or *Approve* \u2014 Publish this content\n"
        f"  *2* or *Regenerate* \u2014 Create a new version\n"
        f"  *3* or *Reject* \u2014 Discard this content\n"
        f"\n"
        f"\U0001f194 ID: {content_id[:8]}"
    )

    return await send_whatsapp_message(phone_number, message)


async def send_approval_result_notification(
    phone_number: str,
    platform: str,
    action: str,
    content_preview: str | None = None,
) -> bool:
    """Notify user about the result of their approval action."""
    if action == "approve":
        emoji = "\u2705"
        status_text = "approved and will be published"
    elif action == "regenerate":
        emoji = "\U0001f504"
        status_text = "being regenerated with AI"
    else:
        emoji = "\u274c"
        status_text = "rejected and discarded"

    message = (
        f"{emoji} *Content {action.capitalize()}d*\n"
        f"\n"
        f"Your {platform.capitalize()} content has been {status_text}.\n"
    )
    if action == "approve":
        message += "\nIt will be published at the next scheduled slot."
    elif action == "regenerate":
        message += "\nA fresh version will be sent for approval shortly."

    return await send_whatsapp_message(phone_number, message)


async def send_template_message(
    phone_number: str,
    template_name: str,
    parameters: list[str] | None = None,
) -> bool:
    """Send a WhatsApp template message."""
    if not settings.wapihub_api_key:
        return False

    url = f"{settings.wapihub_url}/messages"

    payload = {
        "phone": phone_number,
        "template_name": template_name,
    }
    if parameters:
        payload["parameters"] = parameters

    headers = {
        "Authorization": f"Bearer {settings.wapihub_api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            return response.status_code in (200, 201)
    except Exception as e:
        logger.error(f"WhatsApp template send failed: {e}")
        return False
