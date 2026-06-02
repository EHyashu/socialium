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
    - LinkedIn post URN (stored in platform_post_id after publishing)
    """
    if not content.platform_post_id:
        logger.warning(f"Content {content.id} has no LinkedIn post URN (platform_post_id is None)")
        return None
    
    access_token = platform_account.access_token
    if not access_token:
        logger.warning(f"Platform account {platform_account.id} has no access token")
        return None
    
    # LinkedIn post URN format: urn:li:share:1234567890
    post_urn = content.platform_post_id
    
    try:
        import urllib.parse
        # URL-encode the URN for the path (colons must be encoded)
        encoded_urn = urllib.parse.quote(post_urn, safe="")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # LinkedIn's socialActions endpoint requires specific permissions
            # Try fetching likes and comments separately as fallback
            likes = 0
            comments = 0
            
            # Method 1: Try socialActions endpoint
            response = await client.get(
                f"https://api.linkedin.com/v2/socialActions/{encoded_urn}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "X-Restli-Protocol-Version": "2.0.0",
                    "LinkedIn-Version": "202411",
                },
            )
            
            if response.status_code == 200:
                data = response.json()
                # Parse likes from total
                likes = data.get("likes", {}).get("paging", {}).get("total", 0)
                comments = data.get("comments", {}).get("paging", {}).get("total", 0)
            else:
                logger.warning(f"socialActions failed ({response.status_code}): {response.text}")
                
                # Method 2: Try fetching likes and comments separately
                # Get likes
                likes_resp = await client.get(
                    f"https://api.linkedin.com/v2/socialActions/{encoded_urn}/likes",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-Restli-Protocol-Version": "2.0.0",
                        "LinkedIn-Version": "202411",
                    },
                )
                
                if likes_resp.status_code == 200:
                    likes_data = likes_resp.json()
                    likes = likes_data.get("paging", {}).get("total", 0)
                
                # Get comments
                comments_resp = await client.get(
                    f"https://api.linkedin.com/v2/socialActions/{encoded_urn}/comments",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-Restli-Protocol-Version": "2.0.0",
                        "LinkedIn-Version": "202411",
                    },
                )
                
                if comments_resp.status_code == 200:
                    comments_data = comments_resp.json()
                    comments = comments_data.get("paging", {}).get("total", 0)
            
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
            Content.platform_post_id.isnot(None),  # Has LinkedIn post URN
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
            content.engagement_count = analytics["likes"] + analytics["comments"]
            # Note: LinkedIn doesn't easily expose share count
            synced_count += 1
    
    await db.commit()
    logger.info(f"Synced analytics for {synced_count}/{len(contents)} LinkedIn posts")
    
    return synced_count
