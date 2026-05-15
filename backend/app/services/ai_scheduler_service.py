"""AI Scheduling Orchestrator — autonomous scheduling decisions.

Combines viral scoring, audience activity analysis, and rule-based decision
logic to autonomously schedule content or flag it for user action.

Flow:
1. Fetch content draft
2. Score viral potential (6-factor, 0-100)
3. Get optimal posting times (5-layer weighted analysis)
4. Make scheduling decision (auto-schedule / suggest / flag for improvement)
5. If auto-scheduling: create scheduled entry with metadata
6. Support bulk scheduling with 2-hour conflict prevention
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from posthog import Posthog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.constants import ContentStatus
from app.core.langfuse_setup import observe
from app.models.content import Content
from app.services.audience_activity_service import (
    AudienceActivityService,
    OptimalTimeResult,
    TimeSlot,
)
from app.services.viral_scoring_service import ViralScoringService, ViralScoreResult

logger = logging.getLogger(__name__)
settings = get_settings()

# ─── PostHog client ───────────────────────────────────────────────────────────

_posthog: Posthog | None = None


def _get_posthog() -> Posthog | None:
    """Get PostHog client if configured."""
    global _posthog
    if _posthog is None and settings.posthog_api_key:
        _posthog = Posthog(
            project_api_key=settings.posthog_project_id or settings.posthog_api_key,
            host=settings.posthog_host,
        )
    return _posthog


def _track_scheduling_decision(
    workspace_id: str,
    content_id: str,
    action: str,
    viral_score: int,
    confidence: float,
    platform: str,
    scheduled_at: datetime | None = None,
) -> None:
    """Fire PostHog event on every auto-schedule decision."""
    try:
        ph = _get_posthog()
        if not ph:
            return
        ph.capture(
            distinct_id=workspace_id,
            event="auto_schedule_decision",
            properties={
                "content_id": content_id,
                "action": action,
                "viral_score": viral_score,
                "confidence": round(confidence, 2),
                "platform": platform,
                "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
                "auto_scheduled": action == "auto_scheduled",
            },
        )
    except Exception as e:
        logger.warning(f"PostHog scheduling decision tracking failed: {e}")


# ─── Result dataclasses ────────────────────────────────────────────────────────

@dataclass
class SchedulingDecision:
    should_auto_schedule: bool
    reason: str
    action: str  # "auto_scheduled" | "confirm_schedule" | "suggest_times" | "improve_content"
    scheduled_time: datetime | None = None
    suggested_times: list[Any] = field(default_factory=list)
    improvement_suggestion: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "should_auto_schedule": self.should_auto_schedule,
            "reason": self.reason,
            "action": self.action,
            "scheduled_time": self.scheduled_time.isoformat() if self.scheduled_time else None,
            "suggested_times": [
                s.to_dict() if hasattr(s, "to_dict") else s
                for s in self.suggested_times
            ],
            "improvement_suggestion": self.improvement_suggestion,
        }


@dataclass
class AutoScheduleResult:
    content_id: str
    viral_score: ViralScoreResult | dict
    optimal_times: OptimalTimeResult | dict
    decision: SchedulingDecision
    scheduled_at: datetime | None = None

    def to_dict(self) -> dict[str, Any]:
        viral_data = (
            self.viral_score.to_dict()
            if hasattr(self.viral_score, "to_dict")
            else self.viral_score
        )
        time_data = (
            self.optimal_times.to_dict()
            if hasattr(self.optimal_times, "to_dict")
            else self.optimal_times
        )
        return {
            "content_id": self.content_id,
            "viral_score": viral_data,
            "optimal_times": time_data,
            "decision": self.decision.to_dict(),
            "scheduled_at": self.scheduled_at.isoformat() if self.scheduled_at else None,
        }


# ─── Main orchestrator ────────────────────────────────────────────────────────

class AISchedulerService:
    """Autonomous AI scheduling orchestrator.

    Combines viral potential scoring + audience activity prediction
    to make intelligent, hands-free scheduling decisions.
    """

    def __init__(self):
        self.viral_scorer = ViralScoringService()
        self.audience_analyzer = AudienceActivityService()

    @observe(name="ai-auto-schedule")
    async def auto_schedule_draft(
        self,
        content_id: str,
        workspace_id: str,
        target_audience: str = "",
        db: AsyncSession | None = None,
    ) -> AutoScheduleResult:
        """Full autonomous scheduling pipeline for a single content draft.

        Steps:
        1. Fetch content
        2. Score viral potential
        3. Get optimal posting times
        4. Make scheduling decision
        5. If approved, schedule the content
        """
        if db is None:
            raise ValueError("Database session required for scheduling")

        # Step 1: Fetch content
        from uuid import UUID
        content = await db.get(Content, UUID(content_id) if isinstance(content_id, str) else content_id)
        if not content:
            raise ValueError(f"Content {content_id} not found")
        if not content.body:
            raise ValueError(f"Content {content_id} has no body text")

        platform = content.platform.value if content.platform else "linkedin"

        # Step 2: Score viral potential
        viral_result = await self.viral_scorer.score_content(
            draft_id=str(content.id),
            workspace_id=workspace_id,
            platform=platform,
            content=content.body,
            hashtags=content.hashtags or [],
        )

        # Step 3: Get optimal posting times
        time_result = await self.audience_analyzer.get_optimal_posting_times(
            workspace_id=workspace_id,
            platform=platform,
            target_audience=target_audience or (
                content.extra_metadata.get("target_audience", "")
                if content.extra_metadata else ""
            ),
            viral_score=viral_result.total_score,
            db=db,
        )

        # Step 4: Make scheduling decision
        decision = self._make_scheduling_decision(viral_result, time_result)

        # Track decision in PostHog
        _track_scheduling_decision(
            workspace_id=workspace_id,
            content_id=str(content.id),
            action=decision.action,
            viral_score=viral_result.total_score,
            confidence=time_result.confidence,
            platform=platform,
            scheduled_at=decision.scheduled_time,
        )

        # Step 5: If auto-scheduling approved, update the content
        scheduled_at: datetime | None = None
        if decision.should_auto_schedule and time_result.best_slot.scheduled_at:
            scheduled_at = time_result.best_slot.scheduled_at
            content.scheduled_at = scheduled_at
            content.status = ContentStatus.SCHEDULED
            content.viral_score = viral_result.total_score
            content.viral_probability = viral_result.viral_probability
            content.scheduling_confidence = f"{time_result.confidence:.2f} - {time_result._confidence_label()}"
            content.scheduling_reason = time_result.reasoning
            content.auto_scheduled = True
            content.extra_metadata = {
                **(content.extra_metadata or {}),
                "auto_scheduled": True,
                "viral_score": viral_result.total_score,
                "viral_probability": viral_result.viral_probability,
                "scheduling_confidence": time_result.confidence,
                "scheduling_reason": time_result.reasoning,
                "scheduling_decision": decision.action,
            }
            await db.commit()

            logger.info(
                f"Auto-scheduled content {content.id} for {scheduled_at.isoformat()} "
                f"(viral: {viral_result.total_score}, confidence: {time_result.confidence:.2f})"
            )

        return AutoScheduleResult(
            content_id=str(content.id),
            viral_score=viral_result,
            optimal_times=time_result,
            decision=decision,
            scheduled_at=scheduled_at,
        )

    def _make_scheduling_decision(
        self,
        viral_result: ViralScoreResult,
        time_result: OptimalTimeResult,
    ) -> SchedulingDecision:
        """Rule-based decision engine for scheduling actions.

        Rules:
        1. Viral < 30 → flag for improvement
        2. Low confidence + viral < 50 → suggest times (user picks)
        3. Viral >= 65 → auto-schedule at peak (high confidence in content)
        4. Viral 30-64 → suggest schedule for user confirmation
        """

        # Rule 1: Content needs improvement before scheduling
        if viral_result.total_score < 30:
            return SchedulingDecision(
                should_auto_schedule=False,
                reason=(
                    f"Content scored {viral_result.total_score}/100 on viral potential. "
                    f"Improve it before scheduling for better reach."
                ),
                action="improve_content",
                improvement_suggestion=viral_result.recommendation,
            )

        # Rule 2: Low data confidence + medium-low viral → suggest times
        if time_result.confidence < 0.5 and viral_result.total_score < 50:
            suggested = [time_result.best_slot] + time_result.alternative_slots[:2]
            return SchedulingDecision(
                should_auto_schedule=False,
                reason=(
                    "Not enough historical data to confidently pick the best time. "
                    "Choose from these suggested slots."
                ),
                action="suggest_times",
                suggested_times=suggested,
            )

        # Rule 3: High viral content → auto-schedule at peak
        if viral_result.total_score >= 65:
            return SchedulingDecision(
                should_auto_schedule=True,
                reason=(
                    f"High viral potential ({viral_result.total_score}/100). "
                    f"Auto-scheduled at peak time to maximize initial engagement velocity."
                ),
                action="auto_scheduled",
                scheduled_time=time_result.best_slot.scheduled_at,
            )

        # Rule 4: Medium viral (30-64) → suggest schedule for confirmation
        suggested = [time_result.best_slot] + time_result.alternative_slots[:2]
        return SchedulingDecision(
            should_auto_schedule=False,
            reason=(
                f"Content scored {viral_result.total_score}/100. "
                f"Ready to schedule — confirm the suggested time or pick an alternative."
            ),
            action="confirm_schedule",
            suggested_times=suggested,
        )

    @observe(name="ai-bulk-schedule")
    async def bulk_auto_schedule(
        self,
        workspace_id: str,
        content_ids: list[str],
        target_audience: str = "",
        db: AsyncSession | None = None,
    ) -> list[AutoScheduleResult]:
        """Bulk autonomous scheduling with conflict prevention.

        Ensures posts are spaced at least 2 hours apart to avoid
        audience fatigue and algorithmic penalty for rapid-fire posting.
        """
        if db is None:
            raise ValueError("Database session required")

        results: list[AutoScheduleResult] = []
        scheduled_times: list[datetime] = []

        for content_id in content_ids:
            try:
                result = await self.auto_schedule_draft(
                    content_id=content_id,
                    workspace_id=workspace_id,
                    target_audience=target_audience,
                    db=db,
                )

                # Conflict prevention: ensure 2+ hour gap between posts
                if result.scheduled_at:
                    conflict = any(
                        abs((result.scheduled_at - t).total_seconds()) < 7200
                        for t in scheduled_times
                    )

                    if conflict:
                        # Bump to 2 hours after the latest scheduled post
                        latest = max(scheduled_times)
                        new_time = latest + timedelta(hours=2)

                        # Update the content in DB
                        from uuid import UUID
                        content = await db.get(
                            Content,
                            UUID(content_id) if isinstance(content_id, str) else content_id,
                        )
                        if content:
                            content.scheduled_at = new_time
                            await db.commit()
                            result.scheduled_at = new_time
                            result.decision.scheduled_time = new_time
                            result.decision.reason += (
                                f" (Bumped +2h to avoid clustering with other posts)"
                            )

                        logger.info(
                            f"Conflict resolved: {content_id} bumped to {new_time.isoformat()}"
                        )

                    scheduled_times.append(result.scheduled_at)

                results.append(result)

            except Exception as e:
                logger.error(f"Failed to schedule {content_id}: {e}")
                # Track error in PostHog
                _track_scheduling_decision(
                    workspace_id=workspace_id,
                    content_id=content_id,
                    action="error",
                    viral_score=0,
                    confidence=0.0,
                    platform="unknown",
                )
                results.append(AutoScheduleResult(
                    content_id=content_id,
                    viral_score={},
                    optimal_times={},
                    decision=SchedulingDecision(
                        should_auto_schedule=False,
                        reason=f"Scheduling failed: {str(e)}",
                        action="error",
                    ),
                ))

        return results


# ─── Module-level convenience functions ────────────────────────────────────────

_service = AISchedulerService()


async def auto_schedule_content(
    content_id: str,
    workspace_id: str,
    target_audience: str = "",
    db: AsyncSession | None = None,
) -> dict[str, Any]:
    """Auto-schedule a single content draft. Returns dict."""
    result = await _service.auto_schedule_draft(
        content_id=content_id,
        workspace_id=workspace_id,
        target_audience=target_audience,
        db=db,
    )
    return result.to_dict()


async def bulk_auto_schedule_content(
    workspace_id: str,
    content_ids: list[str],
    target_audience: str = "",
    db: AsyncSession | None = None,
) -> list[dict[str, Any]]:
    """Bulk auto-schedule multiple content drafts. Returns list of dicts."""
    results = await _service.bulk_auto_schedule(
        workspace_id=workspace_id,
        content_ids=content_ids,
        target_audience=target_audience,
        db=db,
    )
    return [r.to_dict() for r in results]
