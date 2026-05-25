"""LinkedIn Analytics Service — Fetch real engagement data from LinkedIn API."""

import logging
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.platform_account import PlatformAccount

logger = logging.getLogger(__name__)


async def fetch_linkedin_post_analytics(
    db: AsyncSession,
    content: Content,
    platform_account: PlatformAccount,
) -> dict | None:
    """Fetch analytics for a specific LinkedIn post from LinkedIn API.
    
    Requires:
    - LinkedIn access token
    - LinkedIn post URN (stored after publishing)
    """
    if not content.platform_user_id:
        logger.warning(f"Content {content.id} has no LinkedIn post URN")
        return None
    
    access_token = platform_account.access_token
    if not access_token:
        logger.warning(f"Platform account {platform_account.id} has no access token")
        return None
    
    # LinkedIn post URN format: urn:li:share:1234567890
    post_urn = content.platform_user_id
    
    try:
        async with httpx.AsyncClient() as client:
            # Get post analytics (likes, comments, shares)
            response = await client.get(
                f"https://api.linkedin.com/v2/socialActions/{post_urn}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
            )
            
            if response.status_code != 200:
                logger.error(f"LinkedIn API error: {response.text}")
                return None
            
            data = response.json()
            
            # Parse engagement counts
            likes = 0
            comments = 0
            
            # LinkedIn returns likes in "likes" array
            if "likes" in data:
                likes = data.get("likes", {}).get("paging", {}).get("total", 0)
            
            # Comments in "comments" array  
            if "comments" in data:
                comments = data.get("comments", {}).get("paging", {}).get("total", 0)
            
            return {
                "likes": likes,
                "comments": comments,
                "shares": 0,  # LinkedIn doesn't expose share count easily
                "last_synced": datetime.utcnow().isoformat(),
            }
    
    except Exception as e:
        logger.error(f"Failed to fetch LinkedIn analytics: {e}")
        return None


async def sync_linkedin_analytics(
    db: AsyncSession,
    workspace_id: str,
) -> int:
    """Sync analytics for all LinkedIn posts in a workspace.
    
    Returns:
        Number of posts synced
    """
    # Get all published LinkedIn content
    result = await db.execute(
        select(Content).where(
            Content.workspace_id == workspace_id,
            Content.platform == "linkedin",
            Content.status == "published",
            Content.platform_user_id.isnot(None),  # Has LinkedIn post URN
        )
    )
    contents = result.scalars().all()
    
    # Get user's LinkedIn platform account
    if not contents:
        return 0
    
    # Get the first content's author_id to find their LinkedIn account
    author_id = contents[0].author_id
    
    platform_result = await db.execute(
        select(PlatformAccount).where(
            PlatformAccount.user_id == author_id,
            PlatformAccount.platform == "linkedin",
            PlatformAccount.is_active == True,
        )
    )
    platform_account = platform_result.scalars().first()
    
    if not platform_account:
        logger.warning(f"No active LinkedIn account found for user {author_id}")
        return 0
    
    synced_count = 0
    
    for content in contents:
        analytics = await fetch_linkedin_post_analytics(db, content, platform_account)
        
        if analytics:
            # Update content with real analytics
            content.like_count = analytics["likes"]
            content.comment_count = analytics["comments"]
            # Note: LinkedIn doesn't easily expose share count
            content.last_synced_at = datetime.utcnow()
            synced_count += 1
    
    await db.commit()
    logger.info(f"Synced analytics for {synced_count}/{len(contents)} LinkedIn posts")
    
    return synced_count
