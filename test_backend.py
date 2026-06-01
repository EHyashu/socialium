#!/usr/bin/env python3
"""Quick test to verify backend content generation endpoint is working."""

import requests
import json

# Test configuration
BASE_URL = "http://localhost:8000"
ENDPOINT = f"{BASE_URL}/api/v1/content/generate"

# Test data
test_payload = {
    "workspace_id": "test-workspace-id",
    "topic": "AI trends 2026",
    "platforms": ["linkedin"],
    "tone": "professional",
    "creativity": 70,
    "generate_variants": False,
    "trend_boost": False,
}

print("🧪 Testing backend content generation endpoint...")
print(f"URL: {ENDPOINT}")
print(f"Payload: {json.dumps(test_payload, indent=2)}")
print()

try:
    response = requests.post(ENDPOINT, json=test_payload)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except requests.exceptions.ConnectionError:
    print("❌ ERROR: Cannot connect to backend!")
    print("   Make sure backend is running on port 8000")
    print("   Run: cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload")
except requests.exceptions.RequestException as e:
    print(f"❌ ERROR: {e}")
except Exception as e:
    print(f"❌ ERROR: {e}")
