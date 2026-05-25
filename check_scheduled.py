#!/usr/bin/env python3
"""Check scheduled content and when it will publish."""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.database import async_session
from app.models.content import Content
from sqlalchemy import select


async def check_scheduled():
    """Show all scheduled content."""
    print("\n" + "="*60)
    print("📅 SCHEDULED CONTENT CHECKER")
    print("="*60)
    
    async with async_session() as db:
        result = await db.execute(
            select(Content).where(
                Content.status == "scheduled"
            ).order_by(Content.scheduled_at)
        )
        scheduled = result.scalars().all()
        
        if not scheduled:
            print("\n❌ No scheduled content found")
            return
        
        print(f"\n✅ Found {len(scheduled)} scheduled post(s):\n")
        
        now = datetime.now(timezone.utc)
        
        for content in scheduled:
            scheduled_time = content.scheduled_at
            if scheduled_time.tzinfo is None:
                scheduled_time = scheduled_time.replace(tzinfo=timezone.utc)
            
            time_diff = scheduled_time - now
            
            print(f"📝 Content: {content.title or 'Untitled'}")
            print(f"   Platform: {content.platform}")
            print(f"   Scheduled At: {scheduled_time.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            
            if time_diff.total_seconds() > 0:
                hours = int(time_diff.total_seconds() // 3600)
                minutes = int((time_diff.total_seconds() % 3600) // 60)
                print(f"   ⏰ Will publish in: {hours}h {minutes}m")
                print(f"   🟡 Status: Waiting for scheduled time")
            else:
                print(f"   🟢 Status: SHOULD BE PUBLISHING NOW!")
                print(f"   ⚠️  If not published, check publish worker logs")
            
            print()
        
        print("="*60)
        print("💡 Publish worker runs every 1 minute")
        print("💡 Content will auto-publish at the scheduled time")
        print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(check_scheduled())
