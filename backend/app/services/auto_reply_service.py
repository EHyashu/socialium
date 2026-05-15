"""Auto-reply service for social media comments."""

import logging
from datetime import datetime, timedelta

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def should_auto_reply(
    platform: str,
    comment_text: str,
    target_keywords: list[str] | None = None,
    exclude_keywords: list[str] | None = None,
) -> bool:
    """Determine if a comment should receive an auto-reply."""
    if not comment_text.strip():
        return False

    text_lower = comment_text.lower()

    # Check exclude keywords first
    if exclude_keywords:
        for kw in exclude_keywords:
            if kw.lower() in text_lower:
                return False

    # Check target keywords
    if target_keywords:
        for kw in target_keywords:
            if kw.lower() in text_lower:
                return True
        return False

    # If no target keywords, reply to all positive/neutral comments
    negative_indicators = ["hate", "terrible", "awful", "scam", "spam"]
    for neg in negative_indicators:
        if neg in text_lower:
            return False

    return True


async def generate_reply(
    comment_text: str,
    platform: str,
    tone: str = "professional",
    brand_voice: str | None = None,
) -> str:
    """Generate an appropriate auto-reply."""
    from openai import AsyncOpenAI

    prompt = f"""You are a social media manager responding to a comment.

Comment: "{comment_text}"
Platform: {platform}
Tone: {tone}
{f"Brand voice: {brand_voice}" if brand_voice else ""}

Write a brief, friendly, and appropriate reply. Keep it under 280 characters. Just the reply text, nothing else."""

    try:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=150,
            temperature=0.7,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Auto-reply generation failed: {e}")
        return "Thank you for your comment! 🙌"
