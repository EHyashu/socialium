"""Audience Activity Analyzer — predicts optimal posting times using multiple data layers.

Layers (weighted combination):
1. Workspace historical data (0.40) — real engagement per hour/day from past 90 days
2. Platform global benchmarks (0.25) — research-backed best times per audience segment
3. Day-of-week intelligence (0.20) — which days perform best for this workspace
4. Competitor quiet windows (0.15) — post when competition is low
5. Viral score modifier — strategy adjusts peak vs off-peak targeting
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── Redis caching helpers (4-hour TTL) ─────────────────────────────────────

_redis_client = None
ACTIVITY_CACHE_TTL = 14400  # 4 hours


async def _get_redis():
    """Lazy-init async Redis connection for audience activity caching."""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis.asyncio as aioredis
        _redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await _redis_client.ping()
        return _redis_client
    except Exception as e:
        logger.warning(f"Redis unavailable for activity cache: {e}")
        return None


def _activity_cache_key(workspace_id: str, platform: str, target_audience: str, viral_score: int) -> str:
    """Generate unique cache key for audience activity result."""
    audience_slug = target_audience.lower().replace(" ", "_")[:30] if target_audience else "default"
    score_bucket = (viral_score // 10) * 10  # Bucket by 10s to avoid cache churn
    return f"audience_activity:{workspace_id}:{platform}:{audience_slug}:{score_bucket}"


async def _get_cached_activity(cache_key: str) -> dict | None:
    """Retrieve cached audience activity from Redis."""
    r = await _get_redis()
    if not r:
        return None
    try:
        data = await r.get(cache_key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis activity read failed: {e}")
    return None


async def _set_cached_activity(cache_key: str, activity_data: dict) -> None:
    """Cache audience activity in Redis with 4-hour TTL."""
    r = await _get_redis()
    if not r:
        return
    try:
        await r.setex(cache_key, ACTIVITY_CACHE_TTL, json.dumps(activity_data, default=str))
    except Exception as e:
        logger.warning(f"Redis activity write failed: {e}")


# ─── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class TimeSlot:
    day_of_week: int  # 0=Monday, 6=Sunday
    hour: int  # 0-23 UTC
    avg_engagement: float = 0.0
    avg_impressions: float = 0.0
    confidence_score: float = 0.5
    score: float = 0.0
    scheduled_at: datetime | None = None
    data_source: str = "benchmark"

    def to_dict(self) -> dict[str, Any]:
        return {
            "day_of_week": self.day_of_week,
            "day_name": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][self.day_of_week],
            "hour": self.hour,
            "hour_label": f"{self.hour:02d}:00 UTC",
            "avg_engagement": round(self.avg_engagement, 2),
            "score": round(self.score, 3),
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
            "data_source": self.data_source,
        }


@dataclass
class OptimalTimeResult:
    best_slot: TimeSlot
    alternative_slots: list[TimeSlot]
    confidence: float  # 0-1
    reasoning: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "best_slot": self.best_slot.to_dict(),
            "alternative_slots": [s.to_dict() for s in self.alternative_slots],
            "confidence": round(self.confidence, 2),
            "confidence_label": self._confidence_label(),
            "reasoning": self.reasoning,
        }

    def _confidence_label(self) -> str:
        if self.confidence >= 0.8:
            return "High — based on your historical data"
        elif self.confidence >= 0.5:
            return "Medium — mix of your data and industry benchmarks"
        else:
            return "Low — using industry benchmarks (post more to improve)"


# ─── Platform benchmark data ──────────────────────────────────────────────────

PLATFORM_BENCHMARKS: dict[str, dict[str, list[dict]]] = {
    "linkedin": {
        "default": [
            {"day": 1, "hour": 9, "eng": 4.2},   # Tue 9am
            {"day": 1, "hour": 12, "eng": 4.0},  # Tue 12pm
            {"day": 3, "hour": 9, "eng": 3.9},   # Thu 9am
            {"day": 2, "hour": 12, "eng": 3.8},  # Wed 12pm
            {"day": 3, "hour": 17, "eng": 3.7},  # Thu 5pm
            {"day": 2, "hour": 9, "eng": 3.6},   # Wed 9am
        ],
        "startup founders": [
            {"day": 0, "hour": 8, "eng": 4.5},   # Mon 8am
            {"day": 4, "hour": 10, "eng": 4.1},  # Fri 10am
            {"day": 1, "hour": 7, "eng": 4.0},   # Tue 7am
        ],
        "marketers": [
            {"day": 1, "hour": 10, "eng": 4.3},
            {"day": 2, "hour": 14, "eng": 4.0},
            {"day": 3, "hour": 11, "eng": 3.8},
        ],
        "developers": [
            {"day": 0, "hour": 10, "eng": 4.1},
            {"day": 2, "hour": 15, "eng": 3.9},
            {"day": 3, "hour": 10, "eng": 3.7},
        ],
    },
    "twitter": {
        "default": [
            {"day": 4, "hour": 9, "eng": 3.8},   # Fri 9am
            {"day": 2, "hour": 12, "eng": 3.6},  # Wed 12pm
            {"day": 1, "hour": 15, "eng": 3.5},  # Tue 3pm
            {"day": 0, "hour": 8, "eng": 3.4},   # Mon 8am
            {"day": 3, "hour": 17, "eng": 3.3},  # Thu 5pm
        ],
        "tech": [
            {"day": 0, "hour": 9, "eng": 4.0},
            {"day": 2, "hour": 11, "eng": 3.8},
            {"day": 4, "hour": 16, "eng": 3.7},
        ],
    },
    "instagram": {
        "default": [
            {"day": 2, "hour": 11, "eng": 4.5},  # Wed 11am
            {"day": 4, "hour": 10, "eng": 4.3},  # Fri 10am
            {"day": 5, "hour": 11, "eng": 4.1},  # Sat 11am
            {"day": 1, "hour": 14, "eng": 4.0},  # Tue 2pm
            {"day": 3, "hour": 19, "eng": 3.8},  # Thu 7pm
        ],
        "lifestyle": [
            {"day": 5, "hour": 10, "eng": 4.6},
            {"day": 6, "hour": 11, "eng": 4.4},
            {"day": 2, "hour": 19, "eng": 4.2},
        ],
    },
    "facebook": {
        "default": [
            {"day": 2, "hour": 13, "eng": 3.9},  # Wed 1pm
            {"day": 3, "hour": 13, "eng": 3.7},  # Thu 1pm
            {"day": 1, "hour": 15, "eng": 3.6},  # Tue 3pm
            {"day": 4, "hour": 11, "eng": 3.5},  # Fri 11am
        ],
    },
}

# Quiet windows — hours when most brands are NOT posting (less competition)
COMPETITOR_QUIET_WINDOWS: dict[str, list[int]] = {
    "linkedin": [6, 7, 16, 17, 20],
    "twitter": [5, 6, 21, 22],
    "instagram": [5, 6, 7, 22, 23],
    "facebook": [5, 6, 7, 22, 23],
}


# ─── Main service class ───────────────────────────────────────────────────────

class AudienceActivityService:
    """Predict optimal posting times using multi-layer data analysis."""

    async def get_optimal_posting_times(
        self,
        workspace_id: str,
        platform: str,
        target_audience: str,
        viral_score: int,
        db: AsyncSession,
    ) -> OptimalTimeResult:
        """Calculate best posting times combining all data layers.

        Uses Redis caching (4-hour TTL) to avoid re-computing
        expensive historical queries for unchanged inputs.
        """

        # Check Redis cache first
        cache_key = _activity_cache_key(workspace_id, platform, target_audience, viral_score)
        cached = await _get_cached_activity(cache_key)
        if cached:
            logger.debug(f"Audience activity cache hit for {workspace_id}/{platform}")
            # Reconstruct OptimalTimeResult from cached dict
            best_data = cached["best_slot"]
            best_slot = TimeSlot(
                day_of_week=best_data["day_of_week"],
                hour=best_data["hour"],
                avg_engagement=best_data.get("avg_engagement", 0),
                score=best_data.get("score", 0),
                scheduled_at=self._next_occurrence(best_data["day_of_week"], best_data["hour"]),
                data_source=best_data.get("data_source", "cached"),
            )
            alt_slots = [
                TimeSlot(
                    day_of_week=s["day_of_week"],
                    hour=s["hour"],
                    avg_engagement=s.get("avg_engagement", 0),
                    score=s.get("score", 0),
                    scheduled_at=self._next_occurrence(s["day_of_week"], s["hour"]),
                    data_source=s.get("data_source", "cached"),
                )
                for s in cached.get("alternative_slots", [])
            ]
            return OptimalTimeResult(
                best_slot=best_slot,
                alternative_slots=alt_slots,
                confidence=cached.get("confidence", 0.5),
                reasoning=cached.get("reasoning", ""),
            )

        # Layer 1: Workspace historical data (most accurate)
        historical_slots = await self._get_historical_best_times(
            workspace_id, platform, db
        )

        # Layer 2: Platform global best times by audience segment
        platform_benchmarks = self._get_platform_benchmarks(platform, target_audience)

        # Layer 3: Day-of-week intelligence
        day_scores = await self._score_days_of_week(workspace_id, platform, db)

        # Layer 4: Viral score modifier
        time_strategy = self._get_time_strategy(viral_score)

        # Layer 5: Competitor quiet windows
        quiet_windows = COMPETITOR_QUIET_WINDOWS.get(platform, [6, 7])

        # Combine all layers with weights
        final_slots = self._combine_time_signals(
            historical_slots=historical_slots,
            platform_benchmarks=platform_benchmarks,
            day_scores=day_scores,
            quiet_windows=quiet_windows,
            strategy=time_strategy,
        )

        # If empty fallback, use simple benchmark
        if not final_slots:
            final_slots = [
                TimeSlot(
                    day_of_week=b["day"],
                    hour=b["hour"],
                    avg_engagement=b["eng"],
                    scheduled_at=self._next_occurrence(b["day"], b["hour"]),
                    data_source="benchmark_fallback",
                )
                for b in (PLATFORM_BENCHMARKS.get(platform, {}).get("default", [])[:4])
            ]

        # Build result
        best = final_slots[0] if final_slots else TimeSlot(day_of_week=1, hour=9)
        alternatives = final_slots[1:4] if len(final_slots) > 1 else []

        result = OptimalTimeResult(
            best_slot=best,
            alternative_slots=alternatives,
            confidence=self._calculate_confidence(historical_slots),
            reasoning=self._explain_recommendation(best, historical_slots, platform_benchmarks, time_strategy),
        )

        # Cache the result in Redis (4-hour TTL)
        await _set_cached_activity(cache_key, result.to_dict())

        # Persist snapshot to audience_activity_snapshots table
        await self._persist_activity_snapshot(workspace_id, platform, historical_slots, db)

        return result

    async def _persist_activity_snapshot(
        self,
        workspace_id: str,
        platform: str,
        historical_slots: list[TimeSlot],
        db: AsyncSession,
    ) -> None:
        """Save audience activity data to the snapshots table for trend tracking."""
        if not historical_slots:
            return
        try:
            from app.models.audience_activity import AudienceActivitySnapshot
            from uuid import UUID

            for slot in historical_slots[:10]:  # Limit to top 10 slots
                snapshot = AudienceActivitySnapshot(
                    workspace_id=UUID(workspace_id),
                    platform=platform,
                    day_of_week=slot.day_of_week,
                    hour=slot.hour,
                    avg_engagement_rate=round(slot.avg_engagement, 2),
                    post_count=int(1 / slot.confidence_score) if slot.confidence_score > 0 else 1,
                )
                db.add(snapshot)
            await db.commit()
            logger.debug(f"Persisted {len(historical_slots[:10])} activity snapshots")
        except Exception as e:
            logger.warning(f"Failed to persist activity snapshot (non-blocking): {e}")
            await db.rollback()

    # ── Layer 1: Historical best times from database ───────────────────────────

    async def _get_historical_best_times(
        self, workspace_id: str, platform: str, db: AsyncSession
    ) -> list[TimeSlot]:
        """Query real database for best performing times over last 90 days."""
        try:
            # Use the contents table (which is what we actually have)
            query = text("""
                SELECT
                    CAST(strftime('%w', published_at) AS INTEGER) AS day_of_week,
                    CAST(strftime('%H', published_at) AS INTEGER) AS hour,
                    AVG(engagement_count) AS avg_engagement,
                    AVG(like_count + comment_count * 3 + share_count * 5) AS avg_viral_score,
                    COUNT(*) AS post_count
                FROM contents
                WHERE workspace_id = :workspace_id
                  AND platform = :platform
                  AND published_at IS NOT NULL
                  AND published_at >= datetime('now', '-90 days')
                  AND status = 'published'
                GROUP BY day_of_week, hour
                HAVING COUNT(*) >= 1
                ORDER BY avg_viral_score DESC
                LIMIT 10
            """)

            result = await db.execute(query, {
                "workspace_id": workspace_id,
                "platform": platform,
            })
            rows = result.fetchall()

            slots = []
            for row in rows:
                slots.append(TimeSlot(
                    day_of_week=int(row[0]),
                    hour=int(row[1]),
                    avg_engagement=float(row[2] or 0),
                    confidence_score=min(int(row[4]) / 5.0, 1.0),
                    data_source="historical",
                ))

            logger.info(f"Found {len(slots)} historical time slots for {platform}")
            return slots

        except Exception as e:
            logger.warning(f"Historical time query failed (expected for new workspaces): {e}")
            return []

    # ── Layer 2: Platform benchmarks by audience segment ───────────────────────

    def _get_platform_benchmarks(self, platform: str, target_audience: str) -> list[TimeSlot]:
        """Get research-backed best times for the platform and audience."""
        platform_data = PLATFORM_BENCHMARKS.get(platform, {})

        # Try to find audience-specific data
        audience_lower = target_audience.lower() if target_audience else ""
        for segment, slots_data in platform_data.items():
            if segment != "default" and segment in audience_lower:
                return [
                    TimeSlot(
                        day_of_week=s["day"],
                        hour=s["hour"],
                        avg_engagement=s["eng"],
                        data_source=f"benchmark_{segment}",
                    )
                    for s in slots_data
                ]

        # Default benchmarks
        default_data = platform_data.get("default", [])
        return [
            TimeSlot(
                day_of_week=s["day"],
                hour=s["hour"],
                avg_engagement=s["eng"],
                data_source="benchmark_default",
            )
            for s in default_data
        ]

    # ── Layer 3: Day-of-week scoring ──────────────────────────────────────────

    async def _score_days_of_week(
        self, workspace_id: str, platform: str, db: AsyncSession
    ) -> dict[int, float]:
        """Score each day of week based on historical engagement."""
        day_scores = {i: 1.0 for i in range(7)}  # Default all days equal

        try:
            query = text("""
                SELECT
                    CAST(strftime('%w', published_at) AS INTEGER) AS day,
                    AVG(engagement_count) AS avg_rate
                FROM contents
                WHERE workspace_id = :workspace_id
                  AND platform = :platform
                  AND published_at IS NOT NULL
                  AND published_at >= datetime('now', '-90 days')
                GROUP BY day
            """)
            result = await db.execute(query, {
                "workspace_id": workspace_id,
                "platform": platform,
            })
            rows = result.fetchall()

            if rows:
                max_rate = max((float(row[1] or 1) for row in rows), default=1)
                for row in rows:
                    # Normalize to 0.5 - 1.5 range
                    normalized = float(row[1] or 0) / max(max_rate, 1)
                    day_scores[int(row[0])] = 0.5 + normalized

        except Exception as e:
            logger.debug(f"Day-of-week scoring unavailable: {e}")

        return day_scores

    # ── Layer 4: Viral score strategy ─────────────────────────────────────────

    def _get_time_strategy(self, viral_score: int) -> str:
        """Determine posting strategy based on viral potential."""
        if viral_score >= 80:
            # High viral potential: post at PEAK time for maximum initial velocity
            # Algorithm sees high early engagement → boosts to more people
            return "peak"
        elif viral_score >= 50:
            # Medium potential: post slightly before peak to build momentum
            return "pre_peak"
        else:
            # Lower potential: post in a quiet window to avoid competition
            # Better to be a big fish in a small pond
            return "off_peak"

    # ── Combine all signals ───────────────────────────────────────────────────

    def _combine_time_signals(
        self,
        historical_slots: list[TimeSlot],
        platform_benchmarks: list[TimeSlot],
        day_scores: dict[int, float],
        quiet_windows: list[int],
        strategy: str,
    ) -> list[TimeSlot]:
        """Weighted combination of all data layers into ranked time slots."""

        # Build a (day, hour) → score matrix
        time_matrix: dict[tuple[int, int], float] = {}

        # Historical data (weight: 0.40)
        for slot in historical_slots:
            key = (slot.day_of_week, slot.hour)
            time_matrix[key] = time_matrix.get(key, 0) + (slot.avg_engagement * 0.40)

        # Platform benchmarks (weight: 0.25)
        for slot in platform_benchmarks:
            key = (slot.day_of_week, slot.hour)
            time_matrix[key] = time_matrix.get(key, 0) + (slot.avg_engagement * 0.25)

        # If no entries yet (no historical data), populate from benchmarks only
        if not time_matrix:
            for slot in platform_benchmarks:
                key = (slot.day_of_week, slot.hour)
                time_matrix[key] = slot.avg_engagement

        # Apply day-of-week multipliers (weight: 0.20)
        for key in list(time_matrix.keys()):
            day = key[0]
            multiplier = day_scores.get(day, 1.0)
            time_matrix[key] *= (0.80 + multiplier * 0.20)

        # Apply strategy modifier
        if strategy == "peak":
            pass  # No change — highest score wins naturally
        elif strategy == "pre_peak":
            # Boost slots 1-2 hours before the peak
            sorted_by_score = sorted(time_matrix.items(), key=lambda x: x[1], reverse=True)
            if sorted_by_score:
                peak_day, peak_hour = sorted_by_score[0][0]
                for offset in [1, 2]:
                    pre_peak_key = (peak_day, (peak_hour - offset) % 24)
                    if pre_peak_key in time_matrix:
                        time_matrix[pre_peak_key] *= 1.25
                    else:
                        time_matrix[pre_peak_key] = time_matrix.get(pre_peak_key, 1.0) * 1.25
        elif strategy == "off_peak":
            # Boost quiet window hours (weight: 0.15)
            for key in list(time_matrix.keys()):
                if key[1] in quiet_windows:
                    time_matrix[key] *= 1.15
            # Also add quiet windows that aren't in the matrix yet
            for day in range(7):
                for hour in quiet_windows:
                    key = (day, hour)
                    if key not in time_matrix:
                        time_matrix[key] = 1.5  # Base score for quiet windows

        # Convert to sorted TimeSlot list (future times only)
        now = datetime.now(timezone.utc)
        result_slots: list[TimeSlot] = []

        for (day, hour), score in sorted(time_matrix.items(), key=lambda x: x[1], reverse=True):
            next_time = self._next_occurrence(day, hour)
            if next_time > now + timedelta(minutes=30):
                result_slots.append(TimeSlot(
                    day_of_week=day,
                    hour=hour,
                    score=score,
                    scheduled_at=next_time,
                    data_source="combined",
                ))

        return result_slots[:8]

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _next_occurrence(self, day_of_week: int, hour: int) -> datetime:
        """Calculate the next future occurrence of a given day+hour."""
        now = datetime.now(timezone.utc)
        days_ahead = day_of_week - now.weekday()
        if days_ahead < 0:
            days_ahead += 7
        elif days_ahead == 0 and now.hour >= hour:
            days_ahead = 7

        target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        target += timedelta(days=days_ahead)
        return target

    def _calculate_confidence(self, historical_slots: list[TimeSlot]) -> float:
        """Confidence is higher when we have more historical data."""
        if not historical_slots:
            return 0.3  # Low — using only benchmarks
        if len(historical_slots) >= 5:
            return 0.85  # High — strong historical signal
        # Scale between 0.3 and 0.85
        return 0.3 + (len(historical_slots) / 5) * 0.55

    def _explain_recommendation(
        self,
        best_slot: TimeSlot,
        historical_slots: list[TimeSlot],
        benchmarks: list[TimeSlot],
        strategy: str,
    ) -> str:
        """Generate human-readable explanation of why this time was chosen."""
        day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][best_slot.day_of_week]
        time_str = f"{best_slot.hour:02d}:00 UTC"

        parts = [f"Recommended: {day_name} at {time_str}."]

        if historical_slots:
            parts.append(f"Based on {len(historical_slots)} successful past posts in similar time slots.")
        else:
            parts.append("Based on industry benchmarks (publish more content to get personalized recommendations).")

        strategy_notes = {
            "peak": "Posting at peak time to maximize initial engagement velocity — algorithms reward early traction.",
            "pre_peak": "Posting slightly before peak to build momentum before the audience surge.",
            "off_peak": "Posting in a quieter window to face less competition and stand out more.",
        }
        parts.append(strategy_notes.get(strategy, ""))

        return " ".join(parts)


# ─── Module-level convenience function ─────────────────────────────────────────

_service = AudienceActivityService()


async def get_optimal_posting_times(
    workspace_id: str,
    platform: str,
    target_audience: str = "",
    viral_score: int = 50,
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """Get optimal posting times for a content draft. Returns dict."""
    if db is None:
        # No database session — use benchmarks only
        benchmarks = _service._get_platform_benchmarks(platform, target_audience)
        best = benchmarks[0] if benchmarks else TimeSlot(day_of_week=1, hour=9)
        best.scheduled_at = _service._next_occurrence(best.day_of_week, best.hour)
        return OptimalTimeResult(
            best_slot=best,
            alternative_slots=benchmarks[1:4],
            confidence=0.3,
            reasoning="Based on industry benchmarks. Connect your workspace to get personalized times.",
        ).to_dict()

    result = await _service.get_optimal_posting_times(
        workspace_id=workspace_id,
        platform=platform,
        target_audience=target_audience,
        viral_score=viral_score,
        db=db,
    )
    return result.to_dict()
