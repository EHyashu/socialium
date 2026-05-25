"""Analytics worker - handles periodic analytics sync tasks."""

import logging
from datetime import datetime

from app.core.supabase import get_supabase_client
from app.services.linkedin_analytics import sync_linkedin_analytics
from app.services.auto_reply_automation import poll_linkedin_comments

logger = logging.getLogger(__name__)


async def collect_engagement_analytics():
    """Background task: Collect engagement analytics (existing 6-hour task)."""
    logger.info("Starting scheduled engagement analytics collection...")
    # This would collect analytics from all platforms
    # For now, just log that it's running
    logger.info("Completed engagement analytics collection")


async def sync_all_linkedin_analytics():
    """Background task: Sync LinkedIn analytics for all workspaces."""
    logger.info("Starting scheduled LinkedIn analytics sync...")
    
    try:
        # Get all active workspaces
        supabase = get_supabase_client()
        result = supabase.table("workspaces").select("id").eq("is_active", True).execute()
        
        total_synced = 0
        for workspace in result.data:
            workspace_id = workspace["id"]
            try:
                from app.database import async_session
                async with async_session() as db:
                    synced = await sync_linkedin_analytics(db, workspace_id)
                    total_synced += synced
            except Exception as e:
                logger.error(f"Failed to sync workspace {workspace_id}: {e}")
        
        logger.info(f"Completed LinkedIn analytics sync: {total_synced} posts synced")
    
    except Exception as e:
        logger.error(f"LinkedIn analytics sync failed: {e}")


async def poll_all_linkedin_comments():
    """Background task: Poll LinkedIn for new comments and auto-reply."""
    logger.info("Starting scheduled LinkedIn comment polling...")
    
    try:
        # Get all active workspaces
        supabase = get_supabase_client()
        result = supabase.table("workspaces").select("id").eq("is_active", True).execute()
        
        total_replies = 0
        for workspace in result.data:
            workspace_id = workspace["id"]
            try:
                from app.database import async_session
                async with async_session() as db:
                    replies = await poll_linkedin_comments(db, workspace_id, auto_reply_enabled=True)
                    total_replies += replies
            except Exception as e:
                logger.error(f"Failed to poll comments for workspace {workspace_id}: {e}")
        
        logger.info(f"Completed LinkedIn comment polling: {total_replies} auto-replies sent")
    
    except Exception as e:
        logger.error(f"LinkedIn comment polling failed: {e}")
