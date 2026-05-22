# SOCIALIUM — PHASE 1 IMPLEMENTATION GUIDE

**Status:** ACTIVE  
**Started:** 2025-02-08  
**Priority:** P0 — CRITICAL

---

## CURRENT STATUS

✅ **Phase 1 Audit Complete** — All findings documented  
⏳ **Phase 1 Fixes In Progress** — 3/20 tasks complete

### What's Done Today
1. ✅ Replaced mock platforms page with real API integration
2. ✅ Fixed Twilio Verify Service SID configuration  
3. ✅ Installed Redis locally (running on port 6379)

### What's Blocking You
🔴 **LinkedIn not connected** — Cannot test publishing without OAuth

---

## IMMEDIATE NEXT STEPS (Next 2 Hours)

### Step 1: Connect LinkedIn Account

**Why:** This is the #1 blocker. Without LinkedIn connected, publishing is broken.

**How:**

1. **Start your backend** (if not running):
   ```bash
   cd /Users/yashu/socialium/socialium/socialium/backend
   source venv/bin/activate
   python -m uvicorn app.main:app --reload --port 8000
   ```

2. **Go to platforms page**:
   - Open: `http://localhost:3000/platforms`
   - You should see 4 platform cards (LinkedIn, Twitter, Instagram, Facebook)

3. **Click "Connect LinkedIn"**:
   - This will redirect to LinkedIn OAuth
   - Authorize the application
   - You'll be redirected back to `/platforms`

4. **Verify connection**:
   - LinkedIn card should show "Connected"
   - Should display your LinkedIn username
   - Check database:
     ```bash
     cd backend
     sqlite3 socialium.db "SELECT platform, platform_username, is_active FROM platform_accounts;"
     ```
   - Should see 1 row with your LinkedIn account

5. **If OAuth fails**:
   - Check backend logs for error
   - Verify LinkedIn OAuth credentials in `.env`:
     ```
     LINKEDIN_CLIENT_ID=your_linkedin_client_id
     LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
     LINKEDIN_REDIRECT_URI=http://localhost:3000/platforms
     ```
   - Check LinkedIn app settings at https://www.linkedin.com/developers/

---

### Step 2: Test End-to-End Publishing

**Why:** Verify the core workflow actually works.

**How:**

1. **Generate content**:
   - Go to: `http://localhost:3000/content/generate`
   - Enter topic: "AI in social media marketing"
   - Select platform: LinkedIn
   - Click "Generate"

2. **Save as draft**:
   - Click "Save Draft" button
   - Should redirect to content detail page
   - Verify status: "draft"

3. **Submit for approval**:
   - Go back to generated content
   - Click "Submit for Approval"
   - Should redirect to `/approvals`
   - Check WhatsApp for notification (if configured)

4. **Approve content**:
   - Go to `/approvals`
   - Find your content
   - Click "Approve"
   - Verify status changes to "scheduled"
   - Check `scheduled_at` is set

5. **Wait for publish** (or trigger manually):
   - Option A: Wait 1 minute (publish worker runs every minute)
   - Option B: Trigger manually in Python:
     ```python
     cd backend
     source venv/bin/activate
     python
     ```
     ```python
     import asyncio
     from app.workers.publish_worker import publish_scheduled_content
     asyncio.run(publish_scheduled_content())
     ```

6. **Verify published**:
   - Check content status: should be "published"
   - Check `published_at` is set
   - Check `ai_model_used` contains LinkedIn post ID
   - Go to your LinkedIn profile
   - Verify post is visible

7. **If publishing fails**:
   - Check backend logs for error
   - Check if LinkedIn token is valid:
     ```bash
     sqlite3 socialium.db "SELECT access_token, token_expires_at FROM platform_accounts WHERE platform='linkedin';"
     ```
   - Check publishing service logs
   - Try reconnecting LinkedIn account

---

### Step 3: Add Sentry (30 minutes)

**Why:** You're flying blind without error tracking.

**How:**

1. **Create Sentry account**:
   - Go to: https://sentry.io
   - Sign up (free tier is enough for now)
   - Create new project: "socialium-backend"
   - Copy DSN (looks like: `https://xxx@yyy.ingest.sentry.io/zzz`)

2. **Install Sentry SDK**:
   ```bash
   cd backend
   source venv/bin/activate
   pip install sentry-sdk[fastapi]
   ```

3. **Add to .env**:
   ```bash
   SENTRY_DSN=https://your-dsn-here@yyy.ingest.sentry.io/zzz
   ```

4. **Create Sentry config**:
   Create file: `backend/app/core/sentry_config.py`
   ```python
   import sentry_sdk
   from sentry_sdk.integrations.fastapi import FastApiIntegration
   from app.config import get_settings

   def init_sentry():
       settings = get_settings()
       
       if not settings.sentry_dsn:
           print("⚠️  Sentry DSN not configured, skipping")
           return
       
       sentry_sdk.init(
           dsn=settings.sentry_dsn,
           integrations=[FastApiIntegration()],
           traces_sample_rate=0.1,
           environment=settings.app_env,
       )
       print("✅ Sentry initialized")
   ```

5. **Update config.py**:
   Add to `backend/app/config.py`:
   ```python
   # Sentry
   sentry_dsn: str = ""
   ```

6. **Initialize in main.py**:
   Add to `backend/app/main.py` (at top of lifespan function):
   ```python
   from app.core.sentry_config import init_sentry
   
   @asynccontextmanager
   async def lifespan(app: FastAPI) -> AsyncIterator[None]:
       # Initialize Sentry first
       init_sentry()
       
       print(f"Starting {settings.app_name} in {settings.app_env} mode")
       # ... rest of existing code
   ```

7. **Test Sentry**:
   Add temporary test endpoint in any router:
   ```python
   @router.get("/test-sentry")
   async def test_sentry():
       from sentry_sdk import capture_message
       capture_message("Sentry test message from Socialium")
       return {"status": "check Sentry dashboard"}
   ```
   
   Visit: `http://localhost:8000/api/v1/test-sentry`
   Check Sentry dashboard for the message

---

### Step 4: Add Structured Logging (1 hour)

**Why:** Current logs are inconsistent and hard to query.

**How:**

1. **Create logging config**:
   Create file: `backend/app/core/logging_config.py`
   ```python
   import logging
   import json
   from datetime import datetime

   class JSONFormatter(logging.Formatter):
       """Production JSON logger."""
       
       def format(self, record):
           log_entry = {
               "timestamp": datetime.utcnow().isoformat() + "Z",
               "level": record.levelname,
               "logger": record.name,
               "message": record.getMessage(),
               "module": record.module,
               "function": record.funcName,
               "line": record.lineno,
           }
           
           # Add request ID if available
           if hasattr(record, "request_id"):
               log_entry["request_id"] = record.request_id
           
           # Add exception info
           if record.exc_info:
               log_entry["exception"] = self.formatException(record.exc_info)
           
           # Add custom fields
           if hasattr(record, "extra_data"):
               log_entry["data"] = record.extra_data
           
           return json.dumps(log_entry)

   def setup_logging():
       """Configure production logging."""
       handler = logging.StreamHandler()
       handler.setFormatter(JSONFormatter())
       
       root_logger = logging.getLogger()
       root_logger.handlers = []  # Clear existing handlers
       root_logger.addHandler(handler)
       root_logger.setLevel(logging.INFO)
       
       # Silence noisy loggers
       logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
       logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
       
       print("✅ JSON logging configured")
   ```

2. **Initialize in main.py**:
   Add at top of lifespan function:
   ```python
   from app.core.logging_config import setup_logging
   
   @asynccontextmanager
   async def lifespan(app: FastAPI) -> AsyncIterator[None]:
       # Setup logging first
       setup_logging()
       
       logger = logging.getLogger(__name__)
       logger.info(f"Starting {settings.app_name} in {settings.app_env} mode")
       # ... rest of code
   ```

3. **Test structured logging**:
   ```python
   import logging
   logger = logging.getLogger(__name__)
   
   logger.info("Test structured log", extra={
       "extra_data": {
           "event": "test_log",
           "user_id": "test-user",
       }
   })
   ```
   
   Should output:
   ```json
   {
     "timestamp": "2025-02-08T12:34:56.789Z",
     "level": "INFO",
     "logger": "app.routers.content",
     "message": "Test structured log",
     "module": "content",
     "function": "test_endpoint",
     "line": 42,
     "data": {
       "event": "test_log",
       "user_id": "test-user"
     }
   }
   ```

---

### Step 5: Add Request ID Middleware (30 minutes)

**Why:** Cannot trace requests through system without unique IDs.

**How:**

1. **Create middleware**:
   Create file: `backend/app/middleware/request_id.py`
   ```python
   import uuid
   from fastapi import Request
   from starlette.middleware.base import BaseHTTPMiddleware

   class RequestIDMiddleware(BaseHTTPMiddleware):
       """Add unique request ID to every request."""
       
       async def dispatch(self, request: Request, call_next):
           # Generate or extract request ID
           request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
           request.state.request_id = request_id
           
           # Process request
           response = await call_next(request)
           
           # Add request ID to response headers
           response.headers["X-Request-ID"] = request_id
           
           return response
   ```

2. **Register in main.py**:
   ```python
   from app.middleware.request_id import RequestIDMiddleware
   
   app.add_middleware(RequestIDMiddleware)
   ```

3. **Add to logs**:
   Update logging config to include request_id:
   ```python
   # In logging_config.py, modify JSONFormatter.format():
   if hasattr(record, "request_id"):
       log_entry["request_id"] = record.request_id
   ```

4. **Test**:
   Make any API request:
   ```bash
   curl -v http://localhost:8000/health
   ```
   
   Response should include header:
   ```
   X-Request-ID: abc-123-def-456
   ```
   
   Logs should include:
   ```json
   {"request_id": "abc-123-def-456", ...}
   ```

---

## VERIFICATION CHECKLIST

After completing steps above, verify:

- [ ] LinkedIn account connected (check database)
- [ ] Can generate content successfully
- [ ] Can submit for approval
- [ ] Can approve content
- [ ] Content auto-schedules with optimal time
- [ ] Content publishes to LinkedIn automatically
- [ ] Published post visible on LinkedIn
- [ ] Sentry receiving error reports
- [ ] Logs in JSON format with request IDs
- [ ] Every request has X-Request-ID header

---

## TROUBLESHOOTING

### LinkedIn OAuth Fails

**Error:** "Invalid redirect_uri"
- **Fix:** Check LinkedIn app settings, ensure redirect URI is `http://localhost:3000/platforms`

**Error:** "User denied permission"
- **Fix:** User must approve LinkedIn authorization screen

**Error:** "Token exchange failed"
- **Fix:** Check client ID and secret in `.env`

### Publishing Fails

**Error:** "No LinkedIn account connected"
- **Fix:** Complete OAuth flow first

**Error:** "Access token expired"
- **Fix:** Reconnect LinkedIn account

**Error:** "LinkedIn API error: 403"
- **Fix:** Check LinkedIn app permissions (needs `w_member_social`)

### Sentry Not Working

**Error:** "Sentry not initialized"
- **Fix:** Check `SENTRY_DSN` in `.env`
- **Fix:** Verify `pip install sentry-sdk[fastapi]`

### Logging Not JSON

**Error:** Logs still in old format
- **Fix:** Ensure `setup_logging()` is called BEFORE any other imports in main.py
- **Fix:** Check no other handlers are configured

---

## WHAT TO DOCUMENT

As you implement each step, document:

1. **Configuration changes** (what you changed in .env)
2. **Code changes** (files modified, new files created)
3. **Test results** (what worked, what failed)
4. **Errors encountered** (and how you fixed them)
5. **Time spent** (for future planning)

Update the `STABILIZATION_TRACKER.md` file as you complete tasks.

---

## NEXT AFTER PHASE 1

Once all Phase 1 tasks are complete:

1. Start Phase 2: Workflow Mapping
2. Create integration tests
3. Implement retry logic
4. Add rate limiting
5. Set up CI/CD pipeline

**Don't move to Phase 2 until Phase 1 is 100% complete.**

---

**Remember:** The goal is **reliability**, not features. Every fix makes the system more stable.

**Good luck! 🚀**
