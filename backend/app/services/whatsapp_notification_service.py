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
