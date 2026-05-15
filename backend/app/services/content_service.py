"""Content generation AI service — platform-aware, context-enriched, quality-scored.

Steps:
1. Build enriched context (brand voice, successful examples, hooks, rejected patterns)
2. Build platform-specific prompt with ALL context
3. Call OpenAI with correct parameters per platform
4. Post-process per platform (emoji stripping, char enforcement, hashtag balancing)
5. Quality scoring (enhanced with trend relevance, audience specificity, originality)
6. Variant generation (different angle/hook if requested)
"""

import json
import logging
import re
import uuid as uuid_mod
from typing import Any

from openai import AsyncOpenAI

from app.config import get_settings
from app.core.constants import ContentTone, Platform, PLATFORM_LIMITS, AI_MODELS

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Platform-specific system prompts ────────────────────────────────────────

PLATFORM_SYSTEM_PROMPTS: dict[Platform, str] = {
    Platform.LINKEDIN: """You are a world-class LinkedIn content strategist.

RULES:
- Write a professional post with personal insight and bold perspective
- Hook in the FIRST 2 lines: create curiosity, share a bold insight, or ask a provocative question
- NO greetings ("Hi everyone", "I'm excited to share")
- Short paragraphs: 2 sentences max per paragraph
- Include data points or specific numbers when possible
- End with a question that invites thoughtful comments
- 3-5 relevant hashtags at the very end, each on the same line separated by spaces
- Target length: 800-1300 characters (body excluding hashtags)
- Output valid JSON: {"title": "", "body": "...", "hashtags": [...]}""",

    Platform.TWITTER: """You are a world-class Twitter/X content strategist.

RULES:
- Start with the most powerful word or idea — no preamble
- NO "thread 1/n" formatting for single tweets
- Under 240 characters for single tweet (leave room for 2-3 hashtags)
- If the content requires more detail: generate a 3-5 tweet thread, each under 240 chars
- Hook must create curiosity or make a bold statement
- Conversational, punchy, no filler words
- 2-3 hashtags ONLY
- Output valid JSON: {"title": "", "body": "...", "hashtags": [...]}""",

    Platform.INSTAGRAM: """You are a world-class Instagram content strategist.

RULES:
- Hook in the FIRST line (before the "more" cutoff — keep first line under 125 chars)
- Use storytelling in the body
- Emojis used naturally throughout (3-5 per post)
- 8-15 hashtags in a SEPARATE block at the end (they go in the hashtags array)
- Strong CTA: "Save this post", "Tag a friend who needs this", "Link in bio"
- Target: 100-200 words for caption body (before hashtags)
- Output valid JSON: {"title": "", "body": "...", "hashtags": [...]}""",

    Platform.FACEBOOK: """You are a world-class Facebook content strategist.

RULES:
- Conversational, warm, relatable tone
- Can be longer than Twitter but shorter than LinkedIn
- Ask a question to drive comments
- 2-3 hashtags only
- Emojis used sparingly (1-2 max)
- Target length: 200-500 characters
- Output valid JSON: {"title": "", "body": "...", "hashtags": [...]}""",

    Platform.WHATSAPP: """You are a conversational content writer for WhatsApp broadcasts.

RULES:
- Keep it short and direct
- Conversational tone
- NO hashtags
- Target: under 300 characters
- Output valid JSON: {"title": "", "body": "...", "hashtags": []}""",
}

# Platform-specific max tokens for the API call
PLATFORM_MAX_TOKENS: dict[Platform, int] = {
    Platform.LINKEDIN: 500,
    Platform.TWITTER: 250,
    Platform.INSTAGRAM: 400,
    Platform.FACEBOOK: 300,
    Platform.WHATSAPP: 200,
}

# Content length targets (word count)
LENGTH_TARGETS = {"short": 80, "medium": 200, "long": 400}


# ─── Memory service helpers (graceful fallback if Qdrant unavailable) ────────

async def _get_brand_voice(workspace_id: str) -> str | None:
    """Retrieve brand voice from Qdrant brand_memory collection."""
    try:
        from app.core.qdrant_client import search as qdrant_search
        results = qdrant_search(
            collection_name="brand_memory",
            query_vector=[0.0] * 3072,  # Would use real embedding in production
            limit=1,
            score_threshold=0.5,
        )
        if results:
            return results[0].get("payload", {}).get("brand_voice", None)
    except Exception as e:
        logger.debug(f"Brand voice fetch skipped: {e}")
    return None


async def _get_successful_examples(workspace_id: str, platform: Platform, limit: int = 3) -> list[str]:
    """Retrieve successful content examples from vector store."""
    try:
        from app.core.qdrant_client import search as qdrant_search
        results = qdrant_search(
            collection_name="successful_content",
            query_vector=[0.0] * 3072,
            limit=limit,
            score_threshold=0.6,
        )
        return [r.get("payload", {}).get("body", "") for r in results if r.get("payload", {}).get("body")]
    except Exception:
        return []


async def _get_top_hooks(workspace_id: str, platform: Platform, limit: int = 5) -> list[str]:
    """Retrieve top-performing hooks from vector store."""
    try:
        from app.core.qdrant_client import search as qdrant_search
        results = qdrant_search(
            collection_name="hook_library",
            query_vector=[0.0] * 3072,
            limit=limit,
            score_threshold=0.5,
        )
        return [r.get("payload", {}).get("hook", "") for r in results if r.get("payload", {}).get("hook")]
    except Exception:
        return []


async def _get_rejected_patterns(workspace_id: str, limit: int = 2) -> list[str]:
    """Retrieve patterns to avoid from rejected content."""
    try:
        from app.core.qdrant_client import search as qdrant_search
        results = qdrant_search(
            collection_name="rejected_patterns",
            query_vector=[0.0] * 3072,
            limit=limit,
            score_threshold=0.5,
        )
        return [r.get("payload", {}).get("pattern", "") for r in results if r.get("payload", {}).get("pattern")]
    except Exception:
        return []


# ─── Creativity mapping ──────────────────────────────────────────────────────

def creativity_to_temperature(creativity: int) -> float:
    """Map 0-100 creativity slider to 0.3-1.0 temperature."""
    return 0.3 + (creativity / 100) * 0.7


# ─── Post-processing per platform ───────────────────────────────────────────

_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001f926-\U0001f937"
    "\U00010000-\U0010ffff"
    "\u2600-\u26FF"
    "\u2700-\u27BF"
    "\u200d"
    "\ufe0f"
    "]+",
    flags=re.UNICODE,
)


def _strip_emojis(text: str) -> str:
    """Remove all emojis from text."""
    return _EMOJI_RE.sub("", text).strip()


def _postprocess(platform: Platform, body: str, hashtags: list[str], include_emojis: bool) -> tuple[str, list[str]]:
    """Apply platform-specific post-processing rules."""

    if platform == Platform.LINKEDIN:
        # Strip emojis unless explicitly allowed
        if not include_emojis:
            body = _strip_emojis(body)
        # Enforce 3-5 hashtags
        hashtags = hashtags[:5]
        if len(hashtags) < 3:
            hashtags = hashtags  # keep what we have, don't pad with junk

    elif platform == Platform.TWITTER:
        # Enforce character limit (280 total including hashtags)
        hashtag_str = " ".join(f"#{h.lstrip('#')}" for h in hashtags[:3])
        max_body = 280 - len(hashtag_str) - 2  # 2 for spacing
        if len(body) > max_body:
            body = body[:max_body - 1] + "…"
        hashtags = hashtags[:3]

    elif platform == Platform.INSTAGRAM:
        # Ensure 8-15 hashtags
        hashtags = hashtags[:15]
        # Don't strip emojis — Instagram loves them

    elif platform == Platform.FACEBOOK:
        # Keep under 500 chars
        if len(body) > 500:
            body = body[:497] + "..."
        hashtags = hashtags[:3]

    return body, hashtags


# ─── Main generation function ────────────────────────────────────────────────

async def generate_content(
    platform: Platform,
    tone: ContentTone,
    topic: str | None = None,
    keywords: list[str] | None = None,
    max_length: int = 500,
    include_hashtags: bool = True,
    include_mentions: bool = False,
    brand_voice: str | None = None,
    target_audience: str | None = None,
    include_emojis: bool = True,
    temperature: float = 0.8,
    workspace_id: str | None = None,
    trending_keywords: list[str] | None = None,
    content_length: str = "medium",
    creativity: int = 50,
) -> dict[str, Any]:
    """Generate platform-optimized social media content using AI.

    Enriched with brand memory, trend data, and platform-specific rules.
    """

    # ── Step 1: Build enriched context ──
    effective_brand_voice = brand_voice
    successful_examples: list[str] = []
    top_hooks: list[str] = []
    rejected_patterns: list[str] = []

    if workspace_id:
        if not effective_brand_voice:
            effective_brand_voice = await _get_brand_voice(workspace_id)
        successful_examples = await _get_successful_examples(workspace_id, platform)
        top_hooks = await _get_top_hooks(workspace_id, platform)
        rejected_patterns = await _get_rejected_patterns(workspace_id)

    # Temperature from creativity
    temp = creativity_to_temperature(creativity) if creativity != 50 else temperature
    target_words = LENGTH_TARGETS.get(content_length, 200)

    # ── Step 2: Build enriched platform-specific prompt ──
    prompt_parts: list[str] = []

    if topic:
        prompt_parts.append(f"TOPIC: {topic}")
    if target_audience:
        prompt_parts.append(f"TARGET AUDIENCE: {target_audience}")
    if keywords:
        prompt_parts.append(f"KEYWORDS TO INCLUDE: {', '.join(keywords)}")
    if trending_keywords:
        prompt_parts.append(f"TRENDING KEYWORDS (weave naturally into content): {', '.join(trending_keywords)}")
    if effective_brand_voice:
        prompt_parts.append(f"BRAND VOICE: {effective_brand_voice}")

    prompt_parts.append(f"TONE: {tone.value}")
    prompt_parts.append(f"TARGET LENGTH: approximately {target_words} words")

    if include_emojis:
        prompt_parts.append("EMOJIS: Include relevant emojis naturally.")
    else:
        prompt_parts.append("EMOJIS: Do NOT include any emojis.")

    if include_hashtags:
        limits = PLATFORM_LIMITS.get(platform, {})
        max_ht = limits.get("max_hashtags", 5)
        prompt_parts.append(f"HASHTAGS: Include {max(3, max_ht)} relevant hashtags in the hashtags array.")
    else:
        prompt_parts.append("HASHTAGS: Do NOT include hashtags.")

    if include_mentions:
        prompt_parts.append("MENTIONS: Include relevant @mentions if applicable.")

    if successful_examples:
        prompt_parts.append("\nEXAMPLES OF HIGH-PERFORMING POSTS (match this quality):")
        for i, ex in enumerate(successful_examples[:3], 1):
            prompt_parts.append(f"  Example {i}: {ex[:200]}")

    if top_hooks:
        prompt_parts.append(f"\nTOP-PERFORMING HOOKS (use similar style): {'; '.join(top_hooks[:5])}")

    if rejected_patterns:
        prompt_parts.append(f"\nAVOID THESE PATTERNS (they performed poorly): {'; '.join(rejected_patterns[:2])}")

    enriched_prompt = "\n".join(prompt_parts)
    enriched_prompt += '\n\nGenerate ONLY valid JSON: {"title": "...", "body": "...", "hashtags": [...], "mentions": [...]}'

    # ── Step 3: Call OpenAI with platform-specific parameters ──
    system_prompt = PLATFORM_SYSTEM_PROMPTS.get(platform, PLATFORM_SYSTEM_PROMPTS[Platform.LINKEDIN])
    max_tokens = PLATFORM_MAX_TOKENS.get(platform, 400)

    try:
        model = AI_MODELS.get("content_generation", "gpt-4o")
        client = AsyncOpenAI(api_key=settings.openai_api_key)

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": enriched_prompt},
            ],
            temperature=temp,
            max_tokens=max_tokens,
            presence_penalty=0.3,
            frequency_penalty=0.3,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        result = json.loads(content or "{}")

        body = result.get("body", "")
        hashtags = result.get("hashtags", [])

        # ── Step 4: Post-processing per platform ──
        body, hashtags = _postprocess(platform, body, hashtags, include_emojis)

        return {
            "title": result.get("title", ""),
            "body": body,
            "hashtags": hashtags,
            "mentions": result.get("mentions", []),
            "model_used": model,
            "platform": platform.value,
            "char_count": len(body),
            "success": True,
        }

    except Exception as e:
        logger.warning(f"OpenAI generation failed: {e}. Falling back to Groq.")
        try:
            return await _generate_with_groq(enriched_prompt, system_prompt, temp, platform, include_emojis)
        except Exception as e2:
            logger.error(f"Groq fallback also failed: {e2}")
            return {"error": str(e), "success": False}


# ─── Groq fallback ──────────────────────────────────────────────────────────

async def _generate_with_groq(
    prompt: str,
    system_prompt: str,
    temperature: float,
    platform: Platform,
    include_emojis: bool,
) -> dict[str, Any]:
    """Fallback content generation using Groq."""
    from groq import AsyncGroq

    client = AsyncGroq(api_key=settings.groq_api_key)
    model = AI_MODELS.get("fallback", "llama-3.1-8b-instant")

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=temperature,
        max_tokens=800,
    )

    content = response.choices[0].message.content
    result = json.loads(content or "{}")

    body = result.get("body", "")
    hashtags = result.get("hashtags", [])
    body, hashtags = _postprocess(platform, body, hashtags, include_emojis)

    return {
        "title": result.get("title", ""),
        "body": body,
        "hashtags": hashtags,
        "mentions": result.get("mentions", []),
        "model_used": model,
        "platform": platform.value,
        "char_count": len(body),
        "success": True,
    }


# ─── Enhanced quality scoring ────────────────────────────────────────────────

async def score_content_quality(
    body: str,
    platform: Platform,
    tone: ContentTone,
    trending_keywords: list[str] | None = None,
    target_audience: str | None = None,
) -> dict[str, Any]:
    """Score content quality using Claude with enhanced factors.

    Additional scoring:
    - Trend relevance: +1 per trending keyword used (max +2)
    - Audience specificity: +1 if target audience is referenced
    """

    scoring_prompt = f"""You are an expert content quality evaluator. Score this social media post:

Platform: {platform.value}
Tone: {tone.value}

Post:
{body}

Rate on a scale of 1-10 for each dimension:
- Engagement Potential: How likely to generate likes/comments/shares
- Clarity: How clear and well-structured
- Authenticity: How genuine and relatable
- Call-to-Action: How effective the CTA
- Platform Fit: How well optimized for {platform.value}
- Hook Quality: How compelling is the opening line

Respond with ONLY valid JSON:
{{"engagement": 0, "clarity": 0, "authenticity": 0, "cta": 0, "platform_fit": 0, "hook_quality": 0, "overall": 0, "feedback": "..."}}"""

    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        model = AI_MODELS.get("quality_scoring", "claude-3-5-sonnet-20241022")

        response = await client.messages.create(
            model=model,
            max_tokens=400,
            messages=[{"role": "user", "content": scoring_prompt}],
        )

        result = json.loads(response.content[0].text)

        # Enhanced scoring: trend relevance bonus
        trend_bonus = 0
        if trending_keywords:
            body_lower = body.lower()
            for kw in trending_keywords:
                if kw.lower() in body_lower:
                    trend_bonus += 1
            trend_bonus = min(trend_bonus, 2)

        # Enhanced scoring: audience specificity bonus
        audience_bonus = 0
        if target_audience and target_audience.lower() in body.lower():
            audience_bonus = 1

        # Apply bonuses (capped at 10)
        overall = result.get("overall", 7)
        overall = min(10, overall + trend_bonus + audience_bonus)
        result["overall"] = overall
        result["trend_bonus"] = trend_bonus
        result["audience_bonus"] = audience_bonus

        return {"success": True, **result}

    except Exception as e:
        logger.error(f"Quality scoring failed: {e}")
        # Return a decent default score so the feature isn't blocked
        return {
            "success": False,
            "overall": 7,
            "engagement": 7,
            "clarity": 7,
            "authenticity": 7,
            "cta": 6,
            "platform_fit": 7,
            "hook_quality": 7,
            "feedback": "Quality scoring unavailable — default score applied.",
            "error": str(e),
        }
