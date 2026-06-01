"""Platform webhooks — receive comment/DM notifications from social platforms."""

import logging

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.content import Content
from app.models.platform_account import PlatformAccount
from app.services.auto_reply_service import should_auto_reply, generate_reply

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/webhook/linkedin")
async def linkedin_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive LinkedIn comment/DM webhooks.
    
    Handles:
    - New comments on published content
    - Auto-reply generation and posting
    """
    try:
        body = await request.json()
        logger.info(f"LinkedIn webhook received: {body}")
        
        # Process new comments
        for event in body.get("events", []):
            if event.get("type") == "comment":
                comment_text = event.get("text", "")
                content_id = event.get("content_id")
                commenter_id = event.get("author_id")
                post_id = event.get("post_id")  # LinkedIn post URN
                comment_id = event.get("comment_id")  # Comment URN
                
                # Find the content in our database
                content = await db.execute(
                    select(Content).where(
                        Content.platform_post_id == post_id,
                        Content.platform == "linkedin"
                    )
                )
                content_obj = content.scalar_one_or_none()
                
                if content_obj:
                    # Check if we should auto-reply
                    should_reply = await should_auto_reply(
                        platform="linkedin",
                        comment_text=comment_text,
                    )
                    
                    if should_reply:
                        # Generate reply
                        reply = await generate_reply(
                            comment_text=comment_text,
                            platform="linkedin",
                            tone="professional"
                        )
                        
                        # Post reply to LinkedIn API
                        try:
                            # Get OAuth token for the content author
                            account_result = await db.execute(
                                select(PlatformAccount).where(
                                    PlatformAccount.user_id == content_obj.author_id,
                                    PlatformAccount.platform == "linkedin",
                                    PlatformAccount.is_active == True
                                )
                            )
                            account = account_result.scalars().first()
                            
                            if account:
                                access_token = account.access_token  # Would decrypt here
                                
                                # Post comment reply via LinkedIn API
                                # Extract numeric ID if post_id is a full URN
                                numeric_id = post_id.replace("urn:li:share:", "") if "urn:li:share:" in post_id else post_id
                                
                                # URL-encode the URN for the path
                                import urllib.parse
                                share_urn = urllib.parse.quote(f"urn:li:share:{numeric_id}", safe="")
                                url = f"https://api.linkedin.com/v2/socialActions/{share_urn}/comments"
                                
                                payload = {
                                    "actor": f"urn:li:person:{account.platform_user_id}",
                                    "message": {"text": reply}
                                }
                                
                                headers = {
                                    "Authorization": f"Bearer {access_token}",
                                    "Content-Type": "application/json",
                                    "X-Restli-Protocol-Version": "2.0.0",
                                    "LinkedIn-Version": "202411"
                                }
                                
                                logger.info(f"Posting to LinkedIn URL: {url}")
                                
                                async with httpx.AsyncClient() as client:
                                    response = await client.post(url, json=payload, headers=headers)
                                    
                                    if response.status_code in (200, 201):
                                        logger.info(f"✅ LinkedIn auto-reply posted successfully: {reply}")
                                    else:
                                        logger.error(f"❌ LinkedIn API error: {response.status_code} - {response.text}")
                            else:
                                logger.error(f"No LinkedIn account found for user {content_obj.author_id}")
                        except Exception as e:
                            logger.error(f"Failed to post LinkedIn reply: {e}", exc_info=True)
                        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"Error processing LinkedIn webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.post("/webhook/twitter")
async def twitter_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive Twitter mention/reply webhooks.
    
    Handles:
    - New replies to published tweets
    - Auto-reply generation and posting
    - Mention handling
    """
    try:
        body = await request.json()
        logger.info(f"Twitter webhook received: {body}")
        
        # Twitter Account Activity API sends different event types
        for event in body.get("tweet_create_events", []) + body.get("direct_message_events", []):
            # Handle tweet replies
            if "in_reply_to_status_id" in event:
                tweet_text = event.get("text", "")
                tweet_id = event.get("id")
                author_id = event.get("user_id")
                in_reply_to = event.get("in_reply_to_status_id")
                
                # Find the original content
                content = await db.execute(
                    select(Content).where(
                        Content.platform_post_id == in_reply_to,
                        Content.platform == "twitter"
                    )
                )
                content_obj = content.scalar_one_or_none()
                
                if content_obj:
                    # Check if we should auto-reply
                    should_reply = await should_auto_reply(
                        platform="twitter",
                        comment_text=tweet_text,
                    )
                    
                    if should_reply:
                        # Generate reply
                        reply = await generate_reply(
                            comment_text=tweet_text,
                            platform="twitter",
                            tone="casual"
                        )
                        
                        # Post reply to Twitter API
                        try:
                            # Get OAuth token
                            account_result = await db.execute(
                                select(PlatformAccount).where(
                                    PlatformAccount.user_id == content_obj.author_id,
                                    PlatformAccount.platform == "twitter",
                                    PlatformAccount.is_active == True
                                )
                            )
                            account = account_result.scalars().first()
                            
                            if account:
                                access_token = account.access_token
                                
                                # Post reply tweet via Twitter API v2
                                url = "https://api.twitter.com/2/tweets"
                                
                                # Ensure reply is under 280 chars
                                if len(reply) > 280:
                                    reply = reply[:277] + "..."
                                
                                payload = {
                                    "text": reply,
                                    "reply": {
                                        "in_reply_to_tweet_id": tweet_id
                                    }
                                }
                                
                                headers = {
                                    "Authorization": f"Bearer {access_token}",
                                    "Content-Type": "application/json"
                                }
                                
                                async with httpx.AsyncClient() as client:
                                    response = await client.post(url, json=payload, headers=headers)
                                    
                                    if response.status_code in (200, 201):
                                        logger.info(f"✅ Twitter auto-reply posted successfully: {reply}")
                                    else:
                                        logger.error(f"❌ Twitter API error: {response.status_code} - {response.text}")
                            else:
                                logger.error(f"No Twitter account found for user {content_obj.author_id}")
                        except Exception as e:
                            logger.error(f"Failed to post Twitter reply: {e}", exc_info=True)
            
            # Handle DMs
            if "message_create" in event:
                dm_text = event.get("message_create", {}).get("message_data", {}).get("text", "")
                sender_id = event.get("message_create", {}).get("sender_id")
                
                if dm_text:
                    # Generate DM reply
                    reply = await generate_reply(
                        comment_text=dm_text,
                        platform="twitter",
                        tone="professional"
                    )
                    
                    # Send DM reply via Twitter API
                    try:
                        account_result = await db.execute(
                            select(PlatformAccount).where(
                                PlatformAccount.user_id == content_obj.author_id if content_obj else None,
                                PlatformAccount.platform == "twitter",
                                PlatformAccount.is_active == True
                            )
                        )
                        account = account_result.scalars().first()
                        
                        if account:
                            access_token = account.access_token
                            
                            # Send DM via Twitter API
                            url = "https://api.twitter.com/1.1/direct_messages/events/new.json"
                            payload = {
                                "event": {
                                    "type": "message_create",
                                    "message_create": {
                                        "target": {"recipient_id": sender_id},
                                        "message_data": {"text": reply}
                                    }
                                }
                            }
                            
                            headers = {
                                "Authorization": f"Bearer {access_token}",
                                "Content-Type": "application/json"
                            }
                            
                            async with httpx.AsyncClient() as client:
                                response = await client.post(url, json=payload, headers=headers)
                                
                                if response.status_code in (200, 201):
                                    logger.info(f"✅ Twitter DM reply sent successfully: {reply}")
                                else:
                                    logger.error(f"❌ Twitter DM API error: {response.status_code} - {response.text}")
                    except Exception as e:
                        logger.error(f"Failed to send Twitter DM reply: {e}", exc_info=True)
                        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"Error processing Twitter webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.post("/webhook/instagram")
async def instagram_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Receive Instagram comment/DM webhooks via Facebook Graph API.
    
    Handles:
    - New comments on published posts
    - Story mentions
    - Direct messages
    """
    try:
        body = await request.json()
        logger.info(f"Instagram webhook received: {body}")
        
        # Instagram webhooks come via Facebook's Realtime Updates
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") == "comments":
                    comment_data = change.get("value", {})
                    comment_text = comment_data.get("message", "")
                    post_id = comment_data.get("media_id")
                    commenter_id = comment_data.get("from", {}).get("id")
                    comment_id = comment_data.get("id")
                    
                    # Find the content
                    content = await db.execute(
                        select(Content).where(
                            Content.platform_post_id == post_id,
                            Content.platform == "instagram"
                        )
                    )
                    content_obj = content.scalar_one_or_none()
                    
                    if content_obj:
                        # Check if we should auto-reply
                        should_reply = await should_auto_reply(
                            platform="instagram",
                            comment_text=comment_text,
                        )
                        
                        if should_reply:
                            # Generate reply
                            reply = await generate_reply(
                                comment_text=comment_text,
                                platform="instagram",
                                tone="friendly"
                            )
                            
                            # Post reply to Instagram Graph API
                            try:
                                account_result = await db.execute(
                                    select(PlatformAccount).where(
                                        PlatformAccount.user_id == content_obj.author_id,
                                        PlatformAccount.platform == "instagram",
                                        PlatformAccount.is_active == True
                                    )
                                )
                                account = account_result.scalars().first()
                                
                                if account:
                                    access_token = account.access_token
                                    
                                    # Post reply to comment via Instagram Graph API
                                    url = f"https://graph.facebook.com/v18.0/{comment_id}/replies"
                                    payload = {
                                        "message": reply,
                                        "access_token": access_token
                                    }
                                    
                                    async with httpx.AsyncClient() as client:
                                        response = await client.post(url, json=payload)
                                        
                                        if response.status_code in (200, 201):
                                            logger.info(f"✅ Instagram auto-reply posted successfully: {reply}")
                                        else:
                                            logger.error(f"❌ Instagram API error: {response.status_code} - {response.text}")
                                else:
                                    logger.error(f"No Instagram account found for user {content_obj.author_id}")
                            except Exception as e:
                                logger.error(f"Failed to post Instagram reply: {e}", exc_info=True)
                
                elif change.get("field") == "messages":
                    # Handle Instagram DMs
                    message_data = change.get("value", {})
                    message_text = message_data.get("body", "")
                    sender_id = message_data.get("id")
                    
                    if message_text:
                        # Generate DM reply
                        reply = await generate_reply(
                            comment_text=message_text,
                            platform="instagram",
                            tone="professional"
                        )
                        
                        # Send reply via Instagram Graph API (Messenger)
                        try:
                            account_result = await db.execute(
                                select(PlatformAccount).where(
                                    PlatformAccount.user_id == content_obj.author_id if content_obj else None,
                                    PlatformAccount.platform == "instagram",
                                    PlatformAccount.is_active == True
                                )
                            )
                            account = account_result.scalars().first()
                            
                            if account:
                                access_token = account.access_token
                                
                                # Send DM reply via Facebook Graph API (Instagram messaging)
                                url = f"https://graph.facebook.com/v18.0/me/messages"
                                payload = {
                                    "recipient": {"id": sender_id},
                                    "message": {"text": reply},
                                    "access_token": access_token
                                }
                                
                                async with httpx.AsyncClient() as client:
                                    response = await client.post(url, json=payload)
                                    
                                    if response.status_code in (200, 201):
                                        logger.info(f"✅ Instagram DM reply sent successfully: {reply}")
                                    else:
                                        logger.error(f"❌ Instagram DM API error: {response.status_code} - {response.text}")
                        except Exception as e:
                            logger.error(f"Failed to send Instagram DM reply: {e}", exc_info=True)
                        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"Error processing Instagram webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.get("/webhook/{platform}/verify")
async def verify_webhook(platform: str, request: Request):
    """Verify webhook subscriptions for platforms.
    
    Some platforms (Twitter, Facebook) require webhook verification
    before they start sending events.
    """
    from app.config import get_settings
    settings = get_settings()
    
    params = dict(request.query_params)
    
    # Twitter webhook verification
    if platform == "twitter" and "crc_token" in params:
        crc_token = params["crc_token"]
        # TODO: Implement CRC validation with consumer secret
        import hmac
        import hashlib
        import base64
        
        # This is simplified - implement proper validation
        response_token = f"sha256={base64.b64encode(hmac.new(b'secret', crc_token.encode(), hashlib.sha256).digest()).decode()}"
        
        return {"response_token": response_token}
    
    # Facebook/Instagram webhook verification
    if platform in ["facebook", "instagram"] and "hub.challenge" in params:
        if params.get("hub.verify_token") == settings.webhook_verify_token:
            return {"challenge": params["hub.challenge"]}
    
    return {"status": "verification_failed"}
