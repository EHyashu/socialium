"""Content publishing worker — publishes scheduled posts with fallback strategy."""

import asyncio
import logging
from datetime import datetime, timezone, timedelta

from app.config import get_settings
from app.database import async_session_factory
from app.models.content import Content
from app.core.constants import ContentStatus
from app.services.publishing_service import PublishingService
from app.services.publish_failure_classifier import PublishFailureReason

logger = logging.getLogger(__name__)
settings = get_settings()


async def publish_scheduled_content() -> None:
    """Publish all content that is scheduled and due.
    
    Fallback Strategy:
    1. Attempt to publish content
    2. If failed, classify the failure reason
    3. Store failure reason in database for user visibility
    4. If retryable, schedule automatic retry with exponential backoff
    5. If not retryable, mark as failed with clear action steps
    6. Notify user of critical failures via WhatsApp/email
    """
    publisher = PublishingService()
    
    try:
        async with async_session_factory() as db:
            from sqlalchemy import select

            # Get all scheduled content that is due
            result = await db.execute(
                select(Content)
                .where(
                    Content.status == ContentStatus.SCHEDULED,
                    Content.scheduled_at <= datetime.now(timezone.utc),
                )
            )
            contents = result.scalars().all()
            
            if not contents:
                logger.debug("No scheduled content due for publishing")
                return

            logger.info(f"Found {len(contents)} scheduled content(s) to publish")

            for content in contents:
                try:
                    # Actually publish to platform
                    publish_result = await publisher.publish_content(content, db)
                    
                    if publish_result.get("success"):
                        # ✅ SUCCESS
                        content.status = ContentStatus.PUBLISHED
                        content.published_at = datetime.now(timezone.utc)
                        content.publish_failure_reason = None  # Clear any previous failure
                        content.publish_retry_count = 0
                        # Store platform post ID for analytics tracking
                        content.platform_post_id = publish_result.get("platform_post_id", "")
                        await db.commit()
                        logger.info(f"✅ Published content {content.id} to {content.platform.value}: {publish_result.get('platform_url')}")
                    else:
                        # ❌ FAILED - Classify the failure reason
                        error_message = publish_result.get("error", "Unknown error")
                        status_code = publish_result.get("status_code")
                        
                        failure_info = PublishFailureReason.classify(error_message, status_code)
                        
                        # Store failure details
                        content.publish_failure_reason = f"[{failure_info['category']}] {failure_info['reason']}"
                        content.publish_last_retry_at = datetime.now(timezone.utc)
                        
                        # Check if we should retry
                        if PublishFailureReason.should_retry(failure_info):
                            content.publish_retry_count += 1
                            retry_delay = PublishFailureReason.get_retry_delay(
                                failure_info, 
                                content.publish_retry_count
                            )
                            content.publish_next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=retry_delay)
                            
                            # Keep status as SCHEDULED so it will be retried
                            await db.commit()
                            
                            logger.warning(
                                f"⚠️ Content {content.id} failed (retryable): {failure_info['category']} - "
                                f"Will retry in {retry_delay}s (attempt {content.publish_retry_count})"
                            )
                        else:
                            # Not retryable - mark as failed with clear reason
                            content.status = ContentStatus.FAILED
                            await db.commit()
                            
                            logger.error(
                                f"❌ Content {content.id} failed (not retryable): {failure_info['category']} - "
                                f"{failure_info['reason']}"
                            )
                            
                            # TODO: Send notification to user about critical failure
                            # await notify_user_publish_failure(content, failure_info)
                            
                except Exception as e:
                    # Unexpected exception - classify and retry
                    await db.rollback()
                    
                    failure_info = PublishFailureReason.classify(str(e))
                    content.publish_failure_reason = f"[EXCEPTION] {str(e)[:200]}"
                    content.publish_last_retry_at = datetime.now(timezone.utc)
                    
                    if PublishFailureReason.should_retry(failure_info):
                        content.publish_retry_count += 1
                        retry_delay = PublishFailureReason.get_retry_delay(
                            failure_info,
                            content.publish_retry_count
                        )
                        content.publish_next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=retry_delay)
                        # Keep as SCHEDULED for retry
                        await db.commit()
                        
                        logger.error(
                            f"⚠️ Content {content.id} exception (retryable): {e} - "
                            f"Will retry in {retry_delay}s"
                        )
                    else:
                        content.status = ContentStatus.FAILED
                        await db.commit()
                        
                        logger.error(
                            f"❌ Content {content.id} exception (not retryable): {e}",
                            exc_info=True
                        )

    except Exception as e:
        logger.error(f"Publish worker failed: {e}", exc_info=True)


async def refresh_trends() -> None:
    """Refresh trend data periodically."""
    logger.info("Refreshing trends...")
    # Placeholder — actual implementation would fetch from platforms
    pass


async def churn_detection() -> None:
    """Detect churning users and trigger re-engagement."""
    try:
        async with async_session_factory() as db:
            from sqlalchemy import select
            from app.models.user import User
            from app.models.content import Content

            # Find users inactive for 14+ days
            cutoff = datetime.now(timezone.utc) - timedelta(days=14)
            result = await db.execute(
                select(User).where(User.is_active == True)
            )
            users = result.scalars().all()

            for user in users:
                # Check last activity
                content_result = await db.execute(
                    select(Content)
                    .where(Content.author_id == user.id)
                    .order_by(Content.created_at.desc())
                    .limit(1)
                )
                last_content = content_result.scalar_one_or_none()

                if last_content is None or last_content.created_at < cutoff:
                    logger.info(f"Churn risk detected for user {user.email}")
                    # Trigger re-engagement (WhatsApp/email)
                    from app.services.whatsapp_notification_service import send_whatsapp_message
                    # Placeholder: would send actual message

    except Exception as e:
        logger.error(f"Churn detection failed: {e}")
