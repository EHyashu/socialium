#!/usr/bin/env python3
"""Apply migration 007 to add publish failure tracking columns."""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import engine, Base
from app.models.content import Content
from sqlalchemy import text


async def apply_migration():
    """Apply the migration to add publish failure tracking columns."""
    print("🔧 Applying migration 007: Add publish failure tracking columns...")
    
    async with engine.begin() as conn:
        try:
            # SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS
            # We need to check if columns exist first
            
            # Check if columns already exist
            result = await conn.execute(text("PRAGMA table_info(contents)"))
            columns = [row[1] for row in result.fetchall()]
            
            columns_to_add = [
                "publish_failure_reason",
                "publish_retry_count",
                "publish_last_retry_at",
                "publish_next_retry_at"
            ]
            
            for column in columns_to_add:
                if column in columns:
                    print(f"  ✅ Column '{column}' already exists")
                else:
                    print(f"  ➕ Adding column '{column}'...")
                    if column == "publish_failure_reason":
                        await conn.execute(text(
                            "ALTER TABLE contents ADD COLUMN publish_failure_reason TEXT"
                        ))
                    elif column == "publish_retry_count":
                        await conn.execute(text(
                            "ALTER TABLE contents ADD COLUMN publish_retry_count INTEGER DEFAULT 0"
                        ))
                    elif column in ["publish_last_retry_at", "publish_next_retry_at"]:
                        await conn.execute(text(
                            f"ALTER TABLE contents ADD COLUMN {column} TIMESTAMP"
                        ))
                    print(f"  ✅ Column '{column}' added")
            
            print("\n✅ Migration 007 applied successfully!")
            print("\n📊 New columns added:")
            print("  - publish_failure_reason: Detailed explanation of WHY publish failed")
            print("  - publish_retry_count: Number of retry attempts")
            print("  - publish_last_retry_at: When last retry occurred")
            print("  - publish_next_retry_at: When next retry will occur")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(apply_migration())
