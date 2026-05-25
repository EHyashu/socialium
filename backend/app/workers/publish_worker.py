"""Content publishing worker — publishes scheduled posts."""

import asyncio
import logging
from datetime import datetime, timezone

from app.config import get_settings
from app.database import async_session_factory
from app.models.content import Content
from app.core.constants import ContentStatus
from app.services.publishing_service import PublishingService

logger = logging.getLogger(__name__)
settings = get_settings()


async def publish_scheduled_content() -> None:
    """Publish all content that is scheduled and due."""
    publisher = PublishingService()
    
    try:
        async with async_session_factory() as db:
            from sqlalchemy import select

            result = await db.execute(
                select(Content)
                .where(
                    Content.status == ContentStatus.SCHEDULED,
                    Content.scheduled_at <= datetime.now(timezone.utc),
                )
            )
            contents = result.scalars().all()

            for content in contents:
                try:
                    # Actually publish to platform
                    publish_result = await publisher.publish_content(content, db)
                    
                    if publish_result.get("success"):
                        content.status = ContentStatus.PUBLISHED
                        content.published_at = datetime.now(timezone.utc)
                        # Store platform post ID for analytics tracking
                        content.platform_post_id = publish_result.get("platform_post_id", "")
                        await db.commit()
                        logger.info(f"Published content {content.id} to {content.platform.value}: {publish_result.get('platform_url')}")
                    else:
                        content.status = ContentStatus.FAILED
                        await db.commit()
                        logger.error(f"Failed to publish content {content.id}: {publish_result.get('error')}")
                        
                except Exception as e:
                    await db.rollback()
                    content.status = ContentStatus.FAILED
                    await db.commit()
                    logger.error(f"Publish error for {content.id}: {e}", exc_info=True)

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
            cutoff = datetime.now(timezone.utc) - datetime.timedelta(days=14)
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
