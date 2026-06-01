#!/usr/bin/env python3
"""Test script to verify AI scheduling suggests times within 24 hours."""

import asyncio
import sys
from datetime import datetime, timedelta, timezone

# Add backend to path
sys.path.insert(0, '/Users/yashu/socialium/socialium/socialium/backend')

from app.services.audience_activity_service import AudienceActivityService, TimeSlot


async def test_24h_scheduling():
    """Test that _next_occurrence returns times within 24 hours."""
    service = AudienceActivityService()
    now = datetime.now(timezone.utc)
    
    print("=" * 60)
    print("Testing AI Scheduling 24-Hour Window")
    print("=" * 60)
    print(f"Current time (UTC): {now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Current day: {now.strftime('%A')}")
    print()
    
    # Test different scenarios
    test_cases = [
        (0, 8, "Monday 8 AM"),
        (1, 9, "Tuesday 9 AM"),
        (2, 12, "Wednesday 12 PM"),
        (3, 17, "Thursday 5 PM"),
        (4, 10, "Friday 10 AM"),
        (5, 14, "Saturday 2 PM"),
        (6, 16, "Sunday 4 PM"),
    ]
    
    all_passed = True
    
    for day, hour, label in test_cases:
        result = service._next_occurrence(day, hour, within_24h=True)
        hours_diff = (result - now).total_seconds() / 3600
        
        # Create a TimeSlot and test to_dict()
        slot = TimeSlot(
            day_of_week=day,
            hour=hour,
            score=85.0,
            scheduled_at=result,
            data_source="test"
        )
        slot_dict = slot.to_dict()
        
        # Check if within 24 hours
        is_valid = 0 < hours_diff <= 24
        
        # Check if day_name matches actual scheduled date
        expected_day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][result.weekday()]
        day_label_correct = slot_dict["day_name"] == expected_day_name
        
        status = "✅ PASS" if (is_valid and day_label_correct) else "❌ FAIL"
        
        print(f"{status} | {label:20} | {slot_dict['day_name']:10} | {result.strftime('%Y-%m-%d %H:%M')} | {hours_diff:5.1f}h away")
        
        if not is_valid:
            all_passed = False
            print(f"      ERROR: Time is {hours_diff:.1f} hours away (must be within 24h)")
        
        if not day_label_correct:
            all_passed = False
            print(f"      ERROR: Day name '{slot_dict['day_name']}' doesn't match expected '{expected_day_name}'")
    
    print()
    print("=" * 60)
    
    if all_passed:
        print("✅ ALL TESTS PASSED - All times within 24 hours!")
        return 0
    else:
        print("❌ SOME TESTS FAILED - Check implementation")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_24h_scheduling())
    sys.exit(exit_code)
