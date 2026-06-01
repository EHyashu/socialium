# Publish Failure Fallback Strategy

**Date:** June 1, 2026  
**Status:** ✅ Implemented  
**Purpose:** Diagnose WHY content failed to publish and enable automatic retry

---

## 🎯 Problem Solved

Previously, when content failed to publish automatically, users had NO IDEA why it failed. The system would just mark it as `status='failed'` with no explanation.

**Common scenarios:**
- ❌ No LinkedIn account connected → User sees "Failed" but doesn't know they need to connect an account
- ❌ OAuth token expired → User sees "Failed" but doesn't know they need to reconnect
- ❌ No internet connection → User sees "Failed" but doesn't know it will auto-retry when connection is restored
- ❌ API rate limit → User sees "Failed" but doesn't know they should wait and retry

---

## ✅ Solution: Intelligent Failure Classification

### 1. **Failure Reason Classifier**

The system now automatically diagnoses WHY a publish failed and categorizes it:

| Category | Retryable? | Example | User Action |
|----------|------------|---------|-------------|
| `no_platform_connected` | ❌ No | "No LinkedIn account connected" | Connect account in Settings > Platforms |
| `oauth_token_expired` | ❌ No | "Token expired" | Reconnect account to refresh token |
| `oauth_token_revoked` | ❌ No | "Access revoked" | Re-authorize the app |
| `no_internet_connection` | ✅ Yes | "DNS resolution failed" | Check internet, auto-retries in 1min |
| `network_error` | ✅ Yes | "Connection timeout" | Auto-retries with backoff |
| `api_rate_limit` | ✅ Yes | "Too many requests (429)" | Wait 15min, auto-retries |
| `api_authorization_error` | ❌ No | "Unauthorized (401)" | Reconnect account |
| `api_server_error` | ✅ Yes | "Internal server error (500)" | Auto-retries in 5min |
| `content_exceeds_length_limit` | ❌ No | "Content too long" | Edit content to fit limits |
| `invalid_content_format` | ❌ No | "Bad request (400)" | Fix content formatting |
| `platform_account_deactivated` | ❌ No | "Account suspended" | Check account status |
| `unknown_error` | ✅ Yes | Unexpected errors | Auto-retries, check logs |

---

### 2. **Automatic Retry Strategy**

**Retryable failures** (network, rate limits, server errors):
- System keeps `status='scheduled'` (not 'failed')
- Sets `publish_next_retry_at` with exponential backoff
- Publish worker automatically retries at scheduled time

**Retry delays by failure type:**

| Failure Type | 1st Retry | 2nd Retry | 3rd Retry |
|--------------|-----------|-----------|-----------|
| Rate Limit | 15 min | 30 min | 1 hour |
| Network Error | 1 min | 5 min | 15 min |
| No Internet | 1 min | 5 min | 15 min |
| API Server Error | 5 min | 15 min | 30 min |
| Unknown | 1 min | 2 min | 4 min (max 15 min) |

**Non-retryable failures** (no account, expired token, invalid content):
- System sets `status='failed'` immediately
- Stores clear failure reason with action steps
- User must take manual action to fix

---

### 3. **Database Tracking**

New columns added to `contents` table:

```sql
publish_failure_reason TEXT           -- Detailed explanation of WHY it failed
publish_retry_count INTEGER           -- Number of retry attempts (0, 1, 2, ...)
publish_last_retry_at TIMESTAMP       -- When last retry occurred
publish_next_retry_at TIMESTAMP       -- When next retry will occur
```

**Example data:**
```
publish_failure_reason: "[no_platform_connected] No social media account connected. You need to connect your LinkedIn account in Settings > Platforms."
publish_retry_count: 0
publish_last_retry_at: NULL
publish_next_retry_at: NULL
```

OR for retryable failures:
```
publish_failure_reason: "[network_error] Network connection error. The social media API may be temporarily unavailable."
publish_retry_count: 2
publish_last_retry_at: 2026-06-01 10:50:00
publish_next_retry_at: 2026-06-01 11:05:00  -- Will retry in 15 min
```

---

### 4. **API Endpoints**

#### **Get Publish Status with Failure Reason**
```bash
GET /api/v1/publish/{content_id}/publish-status

Response:
{
  "content_id": "9054b02f-3429-420e-9047-f575f48a7b00",
  "status": "failed",
  "scheduled_at": "2026-06-01T06:00:00Z",
  "published_at": null,
  "platform": "linkedin",
  "failure": {
    "reason": "[no_platform_connected] No social media account connected...",
    "retry_count": 0,
    "last_retry_at": null,
    "next_retry_at": null,
    "classification": {
      "category": "no_platform_connected",
      "reason": "No social media account connected. You need to connect your LinkedIn account in Settings > Platforms.",
      "action": "Go to Settings > Platforms and connect your social media account via OAuth.",
      "retryable": false,
      "severity": "critical"
    }
  }
}
```

#### **Manually Retry Publish**
```bash
POST /api/v1/publish/{content_id}/retry-publish

Response (if still fails):
{
  "status": "failed",
  "message": "Publish failed again",
  "failure_reason": "[oauth_token_expired] Your authentication token has expired...",
  "classification": {
    "category": "oauth_token_expired",
    "action": "Reconnect your account in Settings > Platforms to refresh the token.",
    "retryable": false
  },
  "retry_count": 1
}
```

#### **List All Failed Content**
```bash
GET /api/v1/publish/failed

Response:
[
  {
    "id": "9054b02f-...",
    "title": "My LinkedIn Post",
    "platform": "linkedin",
    "scheduled_at": "2026-06-01T06:00:00Z",
    "failure_reason": "[no_platform_connected] No LinkedIn account connected...",
    "retry_count": 0,
    "last_retry_at": null
  }
]
```

#### **List Content Pending Retry**
```bash
GET /api/v1/publish/pending-retry

Response:
[
  {
    "id": "abc123-...",
    "title": "Scheduled Post",
    "platform": "twitter",
    "scheduled_at": "2026-06-01T08:00:00Z",
    "failure_reason": "[api_rate_limit] You've exceeded the API rate limit...",
    "retry_count": 1,
    "next_retry_at": "2026-06-01T11:15:00Z",  -- Will retry automatically
    "last_retry_at": "2026-06-01T11:00:00Z"
  }
]
```

---

### 5. **User Experience Flow**

#### **Scenario 1: No Platform Connected (Non-Retryable)**

```
1. User schedules content for 6:00 AM
2. 6:00 AM arrives, publish worker runs
3. Publish fails: "No LinkedIn account connected"
4. System classifies: no_platform_connected (not retryable)
5. Status changes to 'failed'
6. Failure reason stored: "[no_platform_connected] No social media account connected..."
7. User sees in UI: "Failed - Connect your LinkedIn account in Settings > Platforms"
8. User connects account and clicks "Retry Publish"
9. Content publishes successfully ✅
```

#### **Scenario 2: No Internet Connection (Retryable)**

```
1. User schedules content for 6:00 AM
2. 6:00 AM arrives, publish worker runs
3. Publish fails: "DNS resolution failed"
4. System classifies: no_internet_connection (retryable)
5. Status stays 'scheduled'
6. Failure reason stored: "[no_internet_connection] No internet connection..."
7. Next retry scheduled: 6:01 AM (1 min delay)
8. 6:01 AM - Still no internet, retry fails again
9. Next retry scheduled: 6:06 AM (5 min delay)
10. 6:06 AM - Internet restored, publish succeeds ✅
11. Status changes to 'published', failure reason cleared
```

#### **Scenario 3: API Rate Limit (Retryable with Long Delay)**

```
1. User schedules content for 6:00 AM
2. 6:00 AM arrives, publish worker runs
3. Publish fails: "Too many requests (429)"
4. System classifies: api_rate_limit (retryable)
5. Status stays 'scheduled'
6. Failure reason stored: "[api_rate_limit] You've exceeded the API rate limit..."
7. Next retry scheduled: 6:15 AM (15 min delay)
8. 6:15 AM - Rate limit still active, retry fails
9. Next retry scheduled: 6:45 AM (30 min delay)
10. 6:45 AM - Rate limit cleared, publish succeeds ✅
```

---

## 🔧 Implementation Details

### Files Modified/Created:

1. **backend/app/models/content.py**
   - Added 4 new columns for failure tracking

2. **backend/app/services/publish_failure_classifier.py** ⭐ NEW
   - Intelligent failure classification logic
   - Determines if failure is retryable
   - Calculates retry delays with exponential backoff

3. **backend/app/workers/publish_worker.py**
   - Integrated failure classifier
   - Stores failure reasons in database
   - Implements automatic retry logic
   - Detailed logging with emoji indicators (✅ ❌ ⚠️)

4. **backend/app/routers/publish_management.py** ⭐ NEW
   - API endpoints for viewing failure reasons
   - Manual retry endpoint
   - List failed/pending-retry content

5. **backend/migrations/007_add_publish_failure_tracking.sql** ⭐ NEW
   - Database migration for new columns

6. **backend/migrations/apply_007_migration.py** ⭐ NEW
   - Script to apply migration to SQLite (dev)

---

## 🚀 How to Use

### **Step 1: Apply Migration**

```bash
cd backend
python migrations/apply_007_migration.py
```

### **Step 2: Restart Backend**

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### **Step 3: Test the Fallback**

#### **Test 1: Check publish status**
```bash
curl http://localhost:8000/api/v1/publish/9054b02f-3429-420e-9047-f575f48a7b00/publish-status
```

#### **Test 2: List failed content**
```bash
curl http://localhost:8000/api/v1/publish/failed
```

#### **Test 3: Manually retry**
```bash
curl -X POST http://localhost:8000/api/v1/publish/9054b02f-3429-420e-9047-f575f48a7b00/retry-publish
```

---

## 📊 Monitoring & Observability

### **Log Output Examples:**

**Success:**
```
✅ Published content 9054b02f to linkedin: https://www.linkedin.com/feed/update/12345
```

**Retryable Failure:**
```
⚠️ Content 9054b02f failed (retryable): network_error - Will retry in 60s (attempt 1)
```

**Non-Retryable Failure:**
```
❌ Content 9054b02f failed (not retryable): no_platform_connected - No social media account connected...
```

### **Database Queries:**

**Find all content that failed due to no platform connected:**
```sql
SELECT id, title, platform, scheduled_at, publish_failure_reason
FROM contents
WHERE publish_failure_reason LIKE '%no_platform_connected%';
```

**Find content pending retry:**
```sql
SELECT id, title, publish_retry_count, publish_next_retry_at
FROM contents
WHERE status = 'scheduled'
  AND publish_next_retry_at IS NOT NULL
  AND publish_next_retry_at <= NOW();
```

---

## 🎯 Benefits

1. **Transparency:** Users know EXACTLY why content failed to publish
2. **Actionable:** Clear steps on how to fix the issue
3. **Automatic Retry:** Network issues, rate limits resolve themselves
4. **No Silent Failures:** Every failure is logged and trackable
5. **Intelligent Backoff:** Different retry strategies per failure type
6. **User Control:** Manual retry endpoint for immediate action
7. **Observability:** Full visibility into publish pipeline health

---

## 🔮 Future Enhancements

- [ ] Send WhatsApp notification when critical failure occurs
- [ ] Send email notification for non-retryable failures
- [ ] Dashboard widget showing failed/pending-retry content
- [ ] Automatic token refresh before expiry (prevent failures)
- [ ] Smart retry scheduling based on platform uptime stats
- [ ] Retry analytics (success rate by failure type)

---

**Last Updated:** June 1, 2026  
**Maintainer:** Socialium Engineering Team
