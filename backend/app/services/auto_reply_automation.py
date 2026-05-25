"""Auto-reply automation service - polls for new comments and auto-replies."""

import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.platform_account import PlatformAccount
from app.services.auto_reply_service import should_auto_reply, generate_reply

logger = logging.getLogger(__name__)


async def poll_linkedin_comments(
    db: AsyncSession,
    workspace_id: str,
    auto_reply_enabled: bool = True,
) -> int:
    """Poll LinkedIn for new comments on published posts and auto-reply.
    
    Returns:
        Number of comments replied to
    """
    # Get all published LinkedIn content
    result = await db.execute(
        select(Content).where(
            Content.workspace_id == workspace_id,
            Content.platform == "linkedin",
            Content.status == "published",
            Content.platform_post_id.isnot(None),
        )
    )
    contents = result.scalars().all()
    
    if not contents:
        logger.info("No published LinkedIn posts found for comment polling")
        return 0
    
    # Get LinkedIn platform account
    author_id = contents[0].author_id
    platform_result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.user_id == author_id,
            PlatformAccount.platform == "linkedin",
            PlatformAccount.is_active == True,
        )
    )
    platform_account = platform_result.scalars().first()
    
    if not platform_account or not platform_account.access_token:
        logger.warning("No active LinkedIn account with access token found")
        return 0
    
    replied_count = 0
    
    for content in contents:
        try:
            # Fetch comments for this post
            comments = await fetch_linkedin_comments(
                content.platform_user_id,
                platform_account.access_token,
            )
            
            if not comments:
                continue
            
            # Process each comment
            for comment in comments:
                comment_id = comment.get("id")
                comment_text = comment.get("text", "")
                
                if not comment_text or not comment_id:
                    continue
                
                # Check if we already replied to this comment
                if await has_replied_to_comment(db, content.id, comment_id):
                    continue
                
                # Check if we should auto-reply
                if auto_reply_enabled:
                    should_reply = await should_auto_reply("linkedin", comment_text)
                    
                    if should_reply:
                        # Generate reply
                        reply = await generate_reply(
                            comment_text,
                            "linkedin",
                            "professional",
                        )
                        
                        # Post reply to LinkedIn
                        success = await post_linkedin_reply(
                            content.platform_user_id,
                            comment_id,
                            reply,
                            platform_account.access_token,
                        )
                        
                        if success:
                            # Store reply in database
                            await store_auto_reply(
                                db,
                                content.id,
                                comment_id,
                                comment_text,
                                reply,
                            )
                            replied_count += 1
                            logger.info(f"Auto-replied to comment {comment_id} on post {content.id}")
        
        except Exception as e:
            logger.error(f"Failed to poll comments for post {content.id}: {e}")
            continue
    
    await db.commit()
    logger.info(f"Auto-replied to {replied_count} new LinkedIn comments")
    return replied_count


async def fetch_linkedin_comments(
    post_urn: str,
    access_token: str,
) -> list[dict]:
    """Fetch comments from LinkedIn post."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.linkedin.com/v2/socialActions/{post_urn}/comments",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )
            
            if response.status_code != 200:
                logger.error(f"Failed to fetch comments: {response.text}")
                return []
            
            data = response.json()
            return data.get("elements", [])
    
    except Exception as e:
        logger.error(f"Error fetching LinkedIn comments: {e}")
        return []


async def post_linkedin_reply(
    post_urn: str,
    parent_comment_id: str,
    reply_text: str,
    access_token: str,
) -> bool:
    """Post a reply to a LinkedIn comment."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.linkedin.com/v2/socialActions/{post_urn}/comments",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                    "Content-Type": "application/json",
                },
                json={
                    "actor": f"urn:li:person:PLACEHOLDER",  # Would need real person URN
                    "object": post_urn,
                    "message": {
                        "text": reply_text,
                    },
                    "parentComment": parent_comment_id,
                },
            )
            
            if response.status_code in [201, 204]:
                logger.info(f"Successfully posted reply to {parent_comment_id}")
                return True
            else:
                logger.error(f"Failed to post reply: {response.text}")
                return False
    
    except Exception as e:
        logger.error(f"Error posting LinkedIn reply: {e}")
        return False


async def has_replied_to_comment(
    db: AsyncSession,
    content_id: str,
    comment_id: str,
) -> bool:
    """Check if we already replied to a comment."""
    # This would query an auto_reply_history table
    # For now, return False (will implement with DB table)
    return False


async def store_auto_reply(
    db: AsyncSession,
    content_id: str,
    comment_id: str,
    comment_text: str,
    reply_text: str,
):
    """Store auto-reply in database for tracking."""
    # This would insert into auto_reply_history table
    # For now, just log it
    logger.info(f"Storing auto-reply for comment {comment_id} on content {content_id}")
    pass
