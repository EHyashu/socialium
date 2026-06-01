"""Content publishing service — publishes to social media platforms."""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.platform_account import PlatformAccount
from app.core.constants import ContentStatus

logger = logging.getLogger(__name__)


class PublishingService:
    """Publish content to social media platforms."""
    
    async def publish_to_linkedin(self, content: Content, db: AsyncSession) -> dict[str, Any]:
        """Publish to LinkedIn via API."""
        try:
            # Get OAuth token for the content author
            result = await db.execute(
                select(PlatformAccount).where(
                    PlatformAccount.user_id == content.author_id,
                    PlatformAccount.platform == "linkedin",
                    PlatformAccount.is_active == True
                )
            )
            account = result.scalars().first()
            
            if not account:
                raise ValueError("No LinkedIn account connected. Please connect your LinkedIn account in Settings.")
            
            # Decrypt token (in production, use proper decryption)
            access_token = account.access_token  # Would decrypt here
            
            # LinkedIn API: Create share
            url = "https://api.linkedin.com/v2/shares"
            payload = {
                "owner": f"urn:li:person:{account.platform_user_id}",
                "subject": content.title or "",
                "text": {
                    "text": content.body + "\n\n" + " ".join([f"#{h.replace('#', '')}" for h in (content.hashtags or [])])
                },
                "distribution": {
                    "linkedInDistributionTarget": {}
                }
            }
            
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                
                if response.status_code in (200, 201):
                    result_data = response.json()
                    share_id = result_data.get("id", "")
                    logger.info(f"LinkedIn post published: {share_id}")
                    return {
                        "success": True,
                        "platform_post_id": share_id,
                        "platform_url": f"https://www.linkedin.com/feed/update/{share_id}"
                    }
                else:
                    error_text = response.text[:500]
                    logger.error(f"LinkedIn API error: {response.status_code} - {error_text}")
                    logger.error(f"Request payload: {payload}")
                    logger.error(f"Account ID: {account.platform_user_id}")
                    return {
                        "success": False,
                        "error": f"LinkedIn API {response.status_code}: {error_text}",
                        "status_code": response.status_code
                    }
        except Exception as e:
            logger.error(f"Failed to publish to LinkedIn: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def publish_to_twitter(self, content: Content, db: AsyncSession) -> dict[str, Any]:
        """Publish to Twitter/X via API v2."""
        try:
            # Get OAuth token
            result = await db.execute(
                select(PlatformAccount).where(
                    PlatformAccount.user_id == content.author_id,
                    PlatformAccount.platform == "twitter",
                    PlatformAccount.is_active == True
                )
            )
            account = result.scalars().first()
            
            if not account:
                raise ValueError("No Twitter account connected. Please connect your Twitter account in Settings.")
            
            # Twitter API v2: Create tweet
            url = "https://api.twitter.com/2/tweets"
            
            # Build tweet text (280 char limit)
            hashtags = " ".join([f"#{h.replace('#', '')}" for h in (content.hashtags or [])])
            tweet_text = content.body
            if hashtags:
                tweet_text += "\n\n" + hashtags
            
            # Truncate if too long
            if len(tweet_text) > 280:
                tweet_text = tweet_text[:277] + "..."
            
            payload = {
                "text": tweet_text
            }
            
            # Twitter uses OAuth 2.0 Bearer token or OAuth 1.0a
            headers = {
                "Authorization": f"Bearer {account.access_token}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                
                if response.status_code in (200, 201):
                    result_data = response.json()
                    tweet_id = result_data.get("data", {}).get("id", "")
                    logger.info(f"Twitter post published: {tweet_id}")
                    return {
                        "success": True,
                        "platform_post_id": tweet_id,
                        "platform_url": f"https://twitter.com/user/status/{tweet_id}"
                    }
                else:
                    logger.error(f"Twitter API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"Twitter API error: {response.status_code}"
                    }
        except Exception as e:
            logger.error(f"Failed to publish to Twitter: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def publish_to_instagram(self, content: Content, db: AsyncSession) -> dict[str, Any]:
        """Publish to Instagram via Graph API."""
        try:
            # Get OAuth token
            result = await db.execute(
                select(PlatformAccount).where(
                    PlatformAccount.user_id == content.author_id,
                    PlatformAccount.platform == "instagram",
                    PlatformAccount.is_active == True
                )
            )
            account = result.scalars().first()
            
            if not account:
                raise ValueError("No Instagram account connected. Please connect your Instagram account in Settings.")
            
            # Instagram requires a two-step process:
            # 1. Create media container
            # 2. Publish the container
            
            page_id = account.platform_user_id  # Instagram page ID
            access_token = account.access_token
            
            # Step 1: Create media container
            caption = content.body + "\n\n" + " ".join([f"#{h.replace('#', '')}" for h in (content.hashtags or [])])
            
            create_url = f"https://graph.facebook.com/v18.0/{page_id}/media"
            create_payload = {
                "image_url": content.image_urls.get("instagram") if content.image_urls else "https://via.placeholder.com/1080x1080",
                "caption": caption[:2200],  # Instagram caption limit
                "access_token": access_token
            }
            
            async with httpx.AsyncClient() as client:
                create_response = await client.post(create_url, json=create_payload)
                
                if create_response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Failed to create Instagram media: {create_response.status_code}"
                    }
                
                container_id = create_response.json().get("id")
                
                # Step 2: Publish the media
                publish_url = f"https://graph.facebook.com/v18.0/{page_id}/media_publish"
                publish_payload = {
                    "creation_id": container_id,
                    "access_token": access_token
                }
                
                publish_response = await client.post(publish_url, json=publish_payload)
                
                if publish_response.status_code in (200, 201):
                    publish_data = publish_response.json()
                    post_id = publish_data.get("id", "")
                    logger.info(f"Instagram post published: {post_id}")
                    return {
                        "success": True,
                        "platform_post_id": post_id,
                        "platform_url": f"https://www.instagram.com/p/{post_id}"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to publish Instagram: {publish_response.status_code}"
                    }
        except Exception as e:
            logger.error(f"Failed to publish to Instagram: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def publish_content(self, content: Content, db: AsyncSession) -> dict[str, Any]:
        """Publish content to the appropriate platform."""
        platform = content.platform.value if content.platform else None
        
        publishers = {
            "linkedin": self.publish_to_linkedin,
            "twitter": self.publish_to_twitter,
            "instagram": self.publish_to_instagram,
        }
        
        publisher = publishers.get(platform)
        if not publisher:
            return {
                "success": False,
                "error": f"Unsupported platform: {platform}"
            }
        
        return await publisher(content, db)
