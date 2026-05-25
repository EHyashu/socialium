#!/usr/bin/env python3
"""Test and Debug Auto-Reply System.

This script will:
1. Check if LinkedIn posts have platform_user_id
2. Fetch comments from LinkedIn
3. Generate AI replies
4. Show what's working and what's not

Usage: cd backend && python3 ../test_autoreply.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.database import async_session
from app.models.content import Content
from app.models.platform_account import PlatformAccount
from app.services.auto_reply_service import should_auto_reply, generate_reply
from sqlalchemy import select


async def test_autoreply():
    """Test the complete auto-reply flow."""
    print("\n" + "="*60)
    print("🔍 AUTO-REPLY SYSTEM DIAGNOSTIC")
    print("="*60)
    
    async with async_session() as db:
        # Step 1: Check LinkedIn posts
        print("\n📝 Step 1: Checking LinkedIn posts...")
        result = await db.execute(
            select(Content).where(
                Content.platform == "linkedin",
                Content.status == "published"
            )
        )
        posts = result.scalars().all()
        
        if not posts:
            print("❌ No published LinkedIn posts found!")
            print("💡 You need to publish at least one post to LinkedIn first.")
            return
        
        print(f"✅ Found {len(posts)} published LinkedIn post(s)")
        
        for post in posts:
            print(f"\n  📄 Post: {post.title or 'Untitled'}")
            print(f"     ID: {post.id}")
            print(f"     Platform User ID: {post.platform_user_id or '❌ NOT SET'}")
            print(f"     Likes: {post.like_count or 0}")
            print(f"     Comments: {post.comment_count or 0}")
            
            if not post.platform_user_id:
                print("     ⚠️  WARNING: This post cannot be synced without platform_user_id!")
                print("     💡 The post must be published through Socialium to get the LinkedIn URN")
        
        # Step 2: Check LinkedIn account
        print("\n🔑 Step 2: Checking LinkedIn account...")
        if posts:
            author_id = posts[0].author_id
            platform_result = await db.execute(
                select(PlatformAccount).where(
                    PlatformAccount.user_id == author_id,
                    PlatformAccount.platform == "linkedin",
                    PlatformAccount.is_active == True
                )
            )
            platform_account = platform_result.scalars().first()
            
            if not platform_account:
                print("❌ No active LinkedIn account found!")
                print("💡 Connect your LinkedIn account first at /platforms")
                return
            
            if not platform_account.access_token:
                print("❌ LinkedIn access token is missing!")
                print("💡 Re-connect your LinkedIn account")
                return
            
            print(f"✅ LinkedIn account found")
            print(f"   Platform: {platform_account.platform}")
            print(f"   Has Token: {'✅ Yes' if platform_account.access_token else '❌ No'}")
            print(f"   Active: {'✅ Yes' if platform_account.is_active else '❌ No'}")
            
            # Step 3: Test comment fetching
            print("\n🌐 Step 3: Testing LinkedIn API...")
            import httpx
            
            post_urn = posts[0].platform_user_id
            if not post_urn:
                print("❌ Cannot test - first post has no platform_user_id")
                print("💡 Publish a post through Socialium to get the URN")
                return
            
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"https://api.linkedin.com/v2/socialActions/{post_urn}/comments",
                        headers={
                            "Authorization": f"Bearer {platform_account.access_token}",
                            "X-Restli-Protocol-Version": "2.0.0",
                        },
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        comments = data.get("elements", [])
                        print(f"✅ Successfully fetched {len(comments)} comment(s)!")
                        
                        if comments:
                            print("\n💬 Comments found:")
                            for i, comment in enumerate(comments[:5], 1):
                                text = comment.get("text", "")
                                print(f"  {i}. {text[:100]}...")
                                
                                # Test AI reply
                                print(f"     🤖 Testing AI reply...")
                                should = await should_auto_reply("linkedin", text)
                                if should:
                                    reply = await generate_reply(text, "linkedin", "professional")
                                    print(f"     ✅ AI Reply: {reply[:80]}...")
                                else:
                                    print(f"     ⏭️  AI skipped (sentiment filter)")
                    else:
                        print(f"❌ LinkedIn API error: {response.status_code}")
                        print(f"   Response: {response.text[:200]}")
                        
            except Exception as e:
                print(f"❌ Error fetching comments: {e}")
        
        # Summary
        print("\n" + "="*60)
        print("📊 SUMMARY")
        print("="*60)
        
        issues = []
        if not posts:
            issues.append("No published LinkedIn posts")
        elif not any(p.platform_user_id for p in posts):
            issues.append("Posts missing platform_user_id (LinkedIn URN)")
        
        if issues:
            print("\n❌ Issues found:")
            for issue in issues:
                print(f"  • {issue}")
            print("\n💡 To fix:")
            print("  1. Make sure you published posts THROUGH SOCIALIUM (not manually on LinkedIn)")
            print("  2. Check that posts have platform_user_id set")
            print("  3. Re-connect LinkedIn account if token is expired")
        else:
            print("\n✅ Everything looks good!")
            print("💡 Auto-reply should work when scheduled tasks are running")
        
        print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(test_autoreply())
