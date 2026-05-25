"""Auto-reply service for social media comments."""

import logging
from datetime import datetime, timedelta

from app.config import get_settings
from app.core.langfuse_setup import get_openai_client, observe

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


@observe(name="auto-reply-generation")
async def generate_reply(
    comment_text: str,
    platform: str,
    tone: str = "professional",
    brand_voice: str | None = None,
) -> str:
    """Generate an appropriate auto-reply."""

    system_prompt = f"""You are an expert social media manager for a brand.
Your role is to engage with comments in a friendly, professional manner.

Guidelines:
- Keep replies under 280 characters
- Match the tone: {tone}
- Be genuine, not salesy
- Use emojis appropriately (1-2 max)
- Never mention competitors
- Always be positive and helpful
{f"- Brand voice: {brand_voice}" if brand_voice else ""}"""

    user_prompt = f"""Generate a reply to this comment:

Platform: {platform}
User comment: "{comment_text}"

Write a brief, friendly, and appropriate reply. Just the reply text, nothing else."""

    try:
        client = get_openai_client()
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=150,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        
        # Ensure reply is under 280 chars
        if len(reply) > 280:
            reply = reply[:277] + "..."
        
        logger.info(f"Generated auto-reply ({len(reply)} chars) for {platform}")
        return reply
    except Exception as e:
        logger.error(f"Auto-reply generation failed: {e}")
        # Fallback to simple replies based on sentiment
        if any(word in comment_text.lower() for word in ["love", "great", "awesome", "amazing"]):
            return "Thank you so much! We really appreciate your support! 🙏✨"
        elif any(word in comment_text.lower() for word in ["question", "how", "what", "where"]):
            return "Great question! Let me look into that and get back to you soon. 💬"
        else:
            return "Thanks for engaging with our content! We appreciate you! 🙌"
