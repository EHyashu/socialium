"""Viral Potential Scoring Engine — scores every draft before AI scheduling.

Factors (100 points total):
1. Hook strength (0-20) — GPT-4o-mini rates the opening line
2. Emotional trigger (0-20) — keyword pattern matching for viral emotions
3. Trend alignment (0-20) — overlap with cached trending keywords
4. Historical performance pattern (0-20) — similarity to past successful posts via Qdrant
5. Content uniqueness (0-10) — penalizes repetitive content
6. Platform algorithm fit (0-10) — char length, hashtag count, engagement keywords
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any

from app.config import get_settings
from app.core.qdrant_client import search as qdrant_search
from app.core.langfuse_setup import get_openai_client, observe

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Redis caching helpers (30-minute TTL) ───────────────────────────────────

_redis_client = None
VIRAL_SCORE_CACHE_TTL = 1800  # 30 minutes


async def _get_redis():
    """Lazy-init async Redis connection for viral score caching."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis_client.ping()
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable for viral score cache: {e}")
        return None


def _viral_cache_key(draft_id: str, platform: str, content_hash: str) -> str:
    """Generate unique cache key for a viral score."""
    return f"viral_score:{draft_id}:{platform}:{content_hash}"


async def _get_cached_score(cache_key: str) -> dict | None:
    """Retrieve cached viral score from Redis."""
    r = await _get_redis()
    if not r:
        return None
    try:
        data = await r.get(cache_key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis viral score read failed: {e}")
    return None


async def _set_cached_score(cache_key: str, score_data: dict) -> None:
    """Cache a viral score in Redis with 30-minute TTL."""
    r = await _get_redis()
    if not r:
        return
    try:
        await r.setex(cache_key, VIRAL_SCORE_CACHE_TTL, json.dumps(score_data))
    except Exception as e:
        logger.warning(f"Redis viral score write failed: {e}")


# ─── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class ViralScoreResult:
    draft_id: str
    total_score: int
    breakdown: dict[str, int]
    viral_probability: str
    recommendation: str
    optimal_schedule_window: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "draft_id": self.draft_id,
            "total_score": self.total_score,
            "breakdown": self.breakdown,
            "viral_probability": self.viral_probability,
            "recommendation": self.recommendation,
            "optimal_schedule_window": self.optimal_schedule_window,
        }


# ─── High-viral emotion triggers ──────────────────────────────────────────────

HIGH_VIRAL_EMOTIONS: dict[str, list[str]] = {
    "awe": ["incredible", "amazing", "mind-blowing", "unbelievable", "shocking", "jaw-dropping"],
    "anger": ["outrageous", "wrong", "unfair", "broken", "failure", "worst", "disgusting"],
    "anxiety": ["warning", "danger", "mistake", "avoid", "stop", "never", "urgent"],
    "aspiration": ["success", "achieve", "transform", "breakthrough", "results", "freedom", "wealth"],
    "curiosity": ["secret", "nobody", "hidden", "revealed", "truth", "real reason", "actually"],
}

# ─── Platform algorithm rules ─────────────────────────────────────────────────

PLATFORM_RULES: dict[str, dict[str, Any]] = {
    "linkedin": {
        "ideal_char_range": (600, 1200),
        "ideal_hashtag_range": (3, 5),
        "boost_keywords": ["insights", "lessons", "experience", "team", "growth", "data", "strategy"],
        "penalty_keywords": ["buy now", "sale", "discount", "limited time", "click here"],
    },
    "twitter": {
        "ideal_char_range": (70, 220),
        "ideal_hashtag_range": (1, 3),
        "boost_keywords": ["thread", "unpopular opinion", "hot take", "here's why", "breakdown"],
        "penalty_keywords": [],
    },
    "instagram": {
        "ideal_char_range": (100, 300),
        "ideal_hashtag_range": (8, 15),
        "boost_keywords": ["save this", "share with", "tag a friend", "link in bio", "double tap"],
        "penalty_keywords": [],
    },
    "facebook": {
        "ideal_char_range": (150, 400),
        "ideal_hashtag_range": (1, 3),
        "boost_keywords": ["comment", "share", "what do you think", "agree?", "thoughts?"],
        "penalty_keywords": [],
    },
}

# ─── Optimal posting windows per platform (UTC hours, day-of-week) ─────────────

OPTIMAL_WINDOWS: dict[str, dict[str, Any]] = {
    "linkedin": {
        "best_hours": [8, 9, 10, 12, 17],
        "best_days": [1, 2, 3],  # Tue, Wed, Thu (0=Mon)
        "avoid_hours": [0, 1, 2, 3, 4, 5, 22, 23],
    },
    "twitter": {
        "best_hours": [9, 12, 15, 17, 20],
        "best_days": [0, 1, 2, 3, 4],  # Mon-Fri
        "avoid_hours": [1, 2, 3, 4, 5],
    },
    "instagram": {
        "best_hours": [7, 8, 11, 12, 17, 19, 20],
        "best_days": [0, 2, 3],  # Mon, Wed, Thu
        "avoid_hours": [1, 2, 3, 4, 5],
    },
    "facebook": {
        "best_hours": [9, 11, 13, 15, 19],
        "best_days": [2, 3, 4],  # Wed, Thu, Fri
        "avoid_hours": [0, 1, 2, 3, 4, 5, 23],
    },
}


# ─── Main scoring class ───────────────────────────────────────────────────────

class ViralScoringService:
    """Score content for viral potential before scheduling."""

    @observe(name="viral-scoring")
    async def score_content(
        self,
        draft_id: str,
        workspace_id: str,
        platform: str,
        content: str,
        hashtags: list[str],
    ) -> ViralScoreResult:
        """Score a content draft across all viral factors.

        Uses Redis caching (30-min TTL) to avoid re-scoring unchanged content.
        Persists scores to the viral_scores table for historical analysis.
        """

        # Check Redis cache first
        content_hash = hashlib.md5(content.encode()).hexdigest()[:12]
        cache_key = _viral_cache_key(draft_id, platform, content_hash)
        cached = await _get_cached_score(cache_key)
        if cached:
            logger.debug(f"Viral score cache hit for {draft_id}")
            return ViralScoreResult(
                draft_id=cached["draft_id"],
                total_score=cached["total_score"],
                breakdown=cached["breakdown"],
                viral_probability=cached["viral_probability"],
                recommendation=cached["recommendation"],
                optimal_schedule_window=cached.get("optimal_schedule_window", {}),
            )

        scores: dict[str, int] = {}

        # Factor 1: Hook strength (0-20 points)
        scores["hook"] = await self._score_hook(content)

        # Factor 2: Emotional trigger (0-20 points)
        scores["emotion"] = self._score_emotional_triggers(content)

        # Factor 3: Trend alignment (0-20 points)
        scores["trend"] = await self._score_trend_alignment(content, hashtags)

        # Factor 4: Historical performance pattern (0-20 points)
        scores["historical"] = await self._score_historical_pattern(workspace_id, content)

        # Factor 5: Content uniqueness (0-10 points)
        scores["uniqueness"] = await self._score_uniqueness(workspace_id, content)

        # Factor 6: Platform algorithm fit (0-10 points)
        scores["algorithm"] = self._score_algorithm_fit(platform, content, hashtags)

        total = sum(scores.values())  # Max 100

        result = ViralScoreResult(
            draft_id=draft_id,
            total_score=total,
            breakdown=scores,
            viral_probability=self._score_to_probability(total),
            recommendation=self._generate_recommendation(scores, platform),
            optimal_schedule_window=self._get_optimal_window(platform, total),
        )

        # Cache the result in Redis (30-min TTL)
        await _set_cached_score(cache_key, result.to_dict())

        # Persist to viral_scores table
        await self._persist_score(draft_id, workspace_id, platform, result)

        return result

    async def _persist_score(
        self, draft_id: str, workspace_id: str, platform: str, result: ViralScoreResult
    ) -> None:
        """Save viral score to the database for historical tracking."""
        try:
            from app.database import async_session_factory
            from app.models.viral_score import ViralScore
            from uuid import UUID

            async with async_session_factory() as session:
                score_record = ViralScore(
                    draft_id=UUID(draft_id),
                    workspace_id=UUID(workspace_id),
                    platform=platform,
                    total_score=result.total_score,
                    hook_score=result.breakdown.get("hook", 0),
                    emotion_score=result.breakdown.get("emotion", 0),
                    trend_score=result.breakdown.get("trend", 0),
                    historical_score=result.breakdown.get("historical", 0),
                    uniqueness_score=result.breakdown.get("uniqueness", 0),
                    algorithm_score=result.breakdown.get("algorithm", 0),
                    viral_probability=result.viral_probability,
                    recommendation=result.recommendation,
                )
                session.add(score_record)
                await session.commit()
                logger.debug(f"Persisted viral score for draft {draft_id}: {result.total_score}")
        except Exception as e:
            logger.warning(f"Failed to persist viral score (non-blocking): {e}")

    # ── Factor 1: Hook Strength ────────────────────────────────────────────────

    @observe(name="viral-hook-scoring")
    async def _score_hook(self, content: str) -> int:
        """Use GPT-4o-mini to rate the opening hook (0-20)."""
        first_line = content.split("\n")[0][:150]

        if not first_line.strip():
            return 5

        try:
            client = get_openai_client()
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "user",
                    "content": (
                        f"Rate this social media hook from 0-20.\n\n"
                        f"Hook: \"{first_line}\"\n\n"
                        f"Scoring criteria:\n"
                        f"- 18-20: Creates immediate curiosity or strong emotion, reader MUST continue\n"
                        f"- 14-17: Good hook, interesting but not irresistible\n"
                        f"- 10-13: Decent hook, some readers will continue\n"
                        f"- 5-9: Weak hook, most readers will scroll past\n"
                        f"- 0-4: No hook, pure statement with no pull\n\n"
                        f"Return ONLY the integer score, nothing else."
                    ),
                }],
                temperature=0.1,
                max_tokens=5,
                name="viral-hook-evaluation",
            )
            score = int(response.choices[0].message.content.strip())
            return max(0, min(score, 20))
        except Exception as e:
            logger.warning(f"Hook scoring failed, using heuristic: {e}")
            # Fallback: heuristic scoring
            return self._heuristic_hook_score(first_line)

    def _heuristic_hook_score(self, hook: str) -> int:
        """Fallback hook scoring without AI."""
        score = 8  # Base
        hook_lower = hook.lower()
        # Questions get bonus
        if "?" in hook:
            score += 3
        # Numbers/stats get bonus
        if any(c.isdigit() for c in hook):
            score += 2
        # Short punchy hooks
        if len(hook) < 60:
            score += 2
        # Power words
        power_words = ["never", "always", "secret", "mistake", "why", "how", "truth"]
        if any(pw in hook_lower for pw in power_words):
            score += 3
        return min(score, 20)

    # ── Factor 2: Emotional Triggers ───────────────────────────────────────────

    def _score_emotional_triggers(self, content: str) -> int:
        """Score based on emotional trigger keywords (0-20)."""
        content_lower = content.lower()
        detected_emotions: list[str] = []

        for emotion, triggers in HIGH_VIRAL_EMOTIONS.items():
            if any(t in content_lower for t in triggers):
                detected_emotions.append(emotion)

        # Base score from pattern matching
        base_score = min(len(detected_emotions) * 4, 16)

        # Bonus: multiple different emotions combined = more viral
        if len(detected_emotions) >= 3:
            base_score = min(base_score + 4, 20)
        elif len(detected_emotions) >= 2:
            base_score = min(base_score + 2, 20)

        return base_score

    # ── Factor 3: Trend Alignment ──────────────────────────────────────────────

    async def _score_trend_alignment(self, content: str, hashtags: list[str]) -> int:
        """Score based on overlap with current trending keywords (0-20)."""
        try:
            from app.services.trend_detection_service import get_trending_keywords

            # Gather trends from multiple industries
            cached_trends: list[str] = []
            for industry in ["Technology", "Business", "Marketing"]:
                trends = await get_trending_keywords(industry, count=10)
                cached_trends.extend([t["keyword"].lower() for t in trends])

            if not cached_trends:
                return 10  # No trends available, neutral score

            content_lower = content.lower()
            hashtags_lower = [h.lower().replace("#", "") for h in hashtags]

            trend_hits = 0
            for trend in set(cached_trends):
                if trend in content_lower or any(trend in h for h in hashtags_lower):
                    trend_hits += 1

            # 5 points per trend keyword hit, max 20
            return min(trend_hits * 5, 20)
        except Exception as e:
            logger.warning(f"Trend alignment scoring failed: {e}")
            return 10  # Neutral score on failure

    # ── Factor 4: Historical Performance Pattern ───────────────────────────────

    async def _score_historical_pattern(self, workspace_id: str, content: str) -> int:
        """Score based on similarity to previously successful content (0-20)."""
        try:
            # Search for similar successful posts in Qdrant
            # Using placeholder vector (real implementation would embed content first)
            results = qdrant_search(
                collection_name="successful_content",
                query_vector=[0.0] * 3072,  # TODO: use real content embedding
                limit=5,
                score_threshold=0.5,
            )

            if not results:
                return 10  # No history, neutral score

            # Average similarity score of top matches
            avg_similarity = sum(r["score"] for r in results) / len(results)

            # Scale cosine similarity (0-1) to score (0-20)
            return int(avg_similarity * 20)
        except Exception as e:
            logger.debug(f"Historical pattern scoring unavailable: {e}")
            return 10  # Neutral score

    # ── Factor 5: Content Uniqueness ───────────────────────────────────────────

    async def _score_uniqueness(self, workspace_id: str, content: str) -> int:
        """Score based on how different this is from recent drafts (0-10)."""
        try:
            # Search recent drafts for similarity
            results = qdrant_search(
                collection_name="content_drafts",
                query_vector=[0.0] * 3072,  # TODO: use real content embedding
                limit=3,
                score_threshold=0.5,
            )

            if not results:
                return 10  # Totally unique

            max_similarity = max((r["score"] for r in results), default=0)

            if max_similarity > 0.95:
                return 0   # Almost identical to existing content
            elif max_similarity > 0.85:
                return 3   # Very similar
            elif max_similarity > 0.70:
                return 6   # Somewhat similar
            else:
                return 10  # Unique enough
        except Exception as e:
            logger.debug(f"Uniqueness scoring unavailable: {e}")
            return 8  # Assume mostly unique

    # ── Factor 6: Platform Algorithm Fit ───────────────────────────────────────

    def _score_algorithm_fit(self, platform: str, content: str, hashtags: list[str]) -> int:
        """Score based on platform-specific best practices (0-10)."""
        score = 0
        content_lower = content.lower()
        hashtag_count = len(hashtags)
        char_count = len(content)

        rules = PLATFORM_RULES.get(platform, {})

        # Check character range
        ideal_min, ideal_max = rules.get("ideal_char_range", (100, 500))
        if ideal_min <= char_count <= ideal_max:
            score += 5
        elif char_count < ideal_min * 0.7 or char_count > ideal_max * 1.3:
            score += 0
        else:
            score += 2

        # Check hashtag range
        h_min, h_max = rules.get("ideal_hashtag_range", (2, 5))
        if h_min <= hashtag_count <= h_max:
            score += 3

        # Boost keywords
        for kw in rules.get("boost_keywords", []):
            if kw in content_lower:
                score += 1

        # Penalty keywords
        for kw in rules.get("penalty_keywords", []):
            if kw in content_lower:
                score -= 2

        return max(0, min(score, 10))

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _score_to_probability(self, score: int) -> str:
        """Convert numeric score to viral probability label."""
        if score >= 80:
            return "Very High"
        elif score >= 65:
            return "High"
        elif score >= 50:
            return "Medium"
        elif score >= 35:
            return "Low"
        else:
            return "Very Low"

    def _generate_recommendation(self, scores: dict[str, int], platform: str) -> str:
        """Generate actionable recommendation based on weakest factor."""
        weakest = min(scores, key=scores.get)  # type: ignore
        recommendations = {
            "hook": "Rewrite your opening line to create more curiosity or urgency",
            "emotion": "Add an emotional trigger — share a surprising stat, bold opinion, or relatable struggle",
            "trend": "Include trending keywords or hashtags in your industry to boost discoverability",
            "historical": "This content style hasn't performed well for your brand before — try a different angle",
            "uniqueness": "This is too similar to content you recently posted — change the angle",
            "algorithm": f"Adjust length and hashtag count to match {platform.capitalize()} best practices",
        }
        return recommendations.get(weakest, "Content looks good — ready to publish!")

    def _get_optimal_window(self, platform: str, score: int) -> dict[str, Any]:
        """Determine optimal scheduling window based on platform and viral score."""
        windows = OPTIMAL_WINDOWS.get(platform, OPTIMAL_WINDOWS["linkedin"])

        # High-scoring content → prime time (best hours)
        # Low-scoring content → off-peak (still good, less competition)
        if score >= 65:
            target_hours = windows["best_hours"][:3]  # Top 3 best hours
            priority = "prime"
        elif score >= 50:
            target_hours = windows["best_hours"]
            priority = "standard"
        else:
            # Off-peak but not dead zones — less competition
            all_hours = list(range(24))
            avoid = set(windows.get("avoid_hours", []))
            best = set(windows["best_hours"])
            target_hours = [h for h in all_hours if h not in avoid and h not in best]
            priority = "off_peak"

        return {
            "priority": priority,
            "target_hours_utc": target_hours,
            "best_days": windows["best_days"],
            "avoid_hours_utc": windows.get("avoid_hours", []),
            "reasoning": (
                f"{'Prime slot — high viral potential' if priority == 'prime' else ''}"
                f"{'Standard slot — solid content' if priority == 'standard' else ''}"
                f"{'Off-peak — less competition for growth' if priority == 'off_peak' else ''}"
            ),
        }


# ─── Module-level convenience function ────────────────────────────────────────

_service = ViralScoringService()


async def score_viral_potential(
    draft_id: str,
    workspace_id: str,
    platform: str,
    content: str,
    hashtags: list[str] | None = None,
) -> dict[str, Any]:
    """Score a content draft's viral potential. Returns dict representation."""
    result = await _service.score_content(
        draft_id=draft_id,
        workspace_id=workspace_id,
        platform=platform,
        content=content,
        hashtags=hashtags or [],
    )
    return result.to_dict()
