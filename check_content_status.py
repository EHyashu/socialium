#!/usr/bin/env python3
"""Check if content was actually scheduled in database."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.database import async_session
from app.models.content import Content
from sqlalchemy import select


async def check_content_status():
    """Check all content and their scheduling status."""
    print("\n" + "="*70)
    print("🔍 CONTENT SCHEDULING STATUS CHECKER")
    print("="*70)
    
    async with async_session() as db:
        result = await db.execute(
            select(Content).order_by(Content.created_at.desc()).limit(10)
        )
        contents = result.scalars().all()
        
        if not contents:
            print("\n❌ No content found in database!")
            return
        
        print(f"\n📊 Found {len(contents)} recent content(s):\n")
        
        for i, content in enumerate(contents, 1):
            print(f"{i}. 📝 {content.title or 'Untitled'}")
            print(f"   ID: {content.id}")
            print(f"   Platform: {content.platform}")
            print(f"   Status: {content.status}")
            print(f"   Scheduled At: {content.scheduled_at or 'Not set'}")
            print(f"   Auto Scheduled: {content.auto_scheduled}")
            print(f"   Viral Score: {content.viral_score or 'N/A'}")
            
            if content.status == "scheduled" and content.scheduled_at:
                print(f"   ✅ PROPERLY SCHEDULED!")
            elif content.status in ["draft", "approved"]:
                print(f"   ⏳ Waiting to be scheduled")
            elif content.status == "published":
                print(f"   ✅ Already published")
            
            print()
        
        print("="*70)
        
        # Count by status
        scheduled = [c for c in contents if c.status == "scheduled"]
        draft = [c for c in contents if c.status in ["draft", "approved"]]
        published = [c for c in contents if c.status == "published"]
        
        print(f"📈 Summary:")
        print(f"   Scheduled: {len(scheduled)}")
        print(f"   Draft/Approved: {len(draft)}")
        print(f"   Published: {len(published)}")
        
        if scheduled:
            print(f"\n✅ You have scheduled content!")
            print(f"💡 It should show on:")
            print(f"   - Calendar page: http://localhost:3000/calendar")
            print(f"   - Content page (Scheduled tab): http://localhost:3000/content")
            print(f"   - Scheduling page (Scheduled tab): http://localhost:3000/scheduling")
        else:
            print(f"\n❌ No scheduled content found")
            print(f"💡 Go to http://localhost:3000/scheduling and click 'AI Schedule'")
        
        print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(check_content_status())
