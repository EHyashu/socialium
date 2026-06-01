#!/usr/bin/env python3
"""Test the publish failure classifier with various error scenarios."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.publish_failure_classifier import PublishFailureReason


def test_failure_classification():
    """Test various failure scenarios."""
    
    test_cases = [
        {
            "name": "No Platform Connected",
            "error": "No LinkedIn account connected. Please connect your LinkedIn account in Settings.",
            "status_code": None,
        },
        {
            "name": "OAuth Token Expired",
            "error": "LinkedIn API 401: Access token expired",
            "status_code": 401,
        },
        {
            "name": "No Internet Connection",
            "error": "Connection refused: DNS resolution failed",
            "status_code": None,
        },
        {
            "name": "Network Timeout",
            "error": "Connection error: Request timed out after 30s",
            "status_code": None,
        },
        {
            "name": "API Rate Limit",
            "error": "LinkedIn API 429: Too many requests, rate limit exceeded",
            "status_code": 429,
        },
        {
            "name": "API Server Error",
            "error": "LinkedIn API 500: Internal server error",
            "status_code": 500,
        },
        {
            "name": "Content Too Long",
            "error": "Content exceeds character limit (3500 > 3000 max)",
            "status_code": 400,
        },
        {
            "name": "Invalid Content",
            "error": "Bad request (400): Invalid content format",
            "status_code": 400,
        },
        {
            "name": "Account Suspended",
            "error": "Account disabled by platform",
            "status_code": 403,
        },
    ]
    
    print("=" * 80)
    print("PUBLISH FAILURE CLASSIFIER - TEST RESULTS")
    print("=" * 80)
    print()
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"Test {i}: {test_case['name']}")
        print("-" * 80)
        print(f"Error: {test_case['error']}")
        print()
        
        result = PublishFailureReason.classify(
            test_case['error'],
            test_case['status_code']
        )
        
        print(f"Category: {result['category']}")
        print(f"Retryable: {'✅ Yes' if result['retryable'] else '❌ No'}")
        print(f"Severity: {result['severity']}")
        print(f"Reason: {result['reason']}")
        print(f"Action: {result['action']}")
        
        if result['retryable']:
            retry_delay = PublishFailureReason.get_retry_delay(result, 0)
            print(f"First retry in: {retry_delay}s")
        
        print()
        print()


if __name__ == "__main__":
    test_failure_classification()
