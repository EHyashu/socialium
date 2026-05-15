"""Celery/APScheduler configuration for periodic tasks."""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    """Start the APScheduler with Redis job store."""
    global _scheduler

    if _scheduler is not None:
        return

    jobstores = {}
    if settings.redis_url:
        try:
            jobstores["default"] = RedisJobStore(url=settings.redis_url)
            logger.info("Using Redis job store for scheduler")
        except Exception as e:
            logger.warning(f"Redis job store setup failed, using memory: {e}")

    executors = {
        "default": ThreadPoolExecutor(4),
        "publish": ThreadPoolExecutor(2),
    }

    job_defaults = {
        "coalesce": True,
        "max_instances": 1,
        "misfire_grace_time": 60,
    }

    _scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone="UTC",
    )

    # Schedule periodic tasks
    _scheduler.add_job(
        _publish_wrapper,
        "interval",
        minutes=1,
        id="publish_scheduled",
        executor="publish",
    )

    _scheduler.add_job(
        _trends_wrapper,
        "interval",
        hours=6,
        id="refresh_trends",
        executor="default",
    )

    _scheduler.add_job(
        _churn_wrapper,
        "interval",
        hours=24,
        id="detect_churn_and_reengage",
        executor="default",
    )

    _scheduler.start()
    logger.info("APScheduler started with periodic tasks")


def stop_scheduler() -> None:
    """Stop the scheduler gracefully."""
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")


async def _publish_wrapper() -> None:
    """Wrapper for publish worker."""
    from app.workers.publish_worker import publish_scheduled_content
    await publish_scheduled_content()


async def _trends_wrapper() -> None:
    """Wrapper for trend refresh."""
    from app.workers.publish_worker import refresh_trends
    await refresh_trends()


async def _churn_wrapper() -> None:
    """Wrapper for churn detection."""
    from app.workers.publish_worker import churn_detection
    await churn_detection()
