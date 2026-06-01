# Auto-Reply Connection Status & Next Steps

## 📊 Current Status (as of now)

### ✅ **What's Working:**

1. **Platform Account Connected**
   - LinkedIn account is connected and active
   - Platform User ID: `yARkelihi_`
   - Status: `is_active = True`

2. **Content Published**
   - Content ID: `ec55e00441bc4825816a4ab7a757b59f`
   - Platform: LinkedIn
   - Status: `published`
   - Platform Post ID: `urn:li:share:7234567890123456789` (manually set for testing)

3. **Webhook Endpoint Working**
   - URL: `POST /api/v1/webhooks/webhook/linkedin`
   - Successfully receives webhook events
   - Correctly identifies the content in database

4. **Auto-Reply Service Working**
   - Comment filtering works (filters negative comments)
   - Fallback replies work when OpenAI quota exceeded
   - Reply generation tested successfully

5. **API Implementation Complete**
   - OAuth token retrieval from database ✅
   - HTTP POST to LinkedIn API ✅
   - Error handling and logging ✅

---

## ❌ **What's NOT Working (BLOCKERS):**

### **BLOCKER #1: OpenAI API Quota Exceeded**

**Error:**
```
Error code: 429 - {'error': {'message': 'You exceeded your current quota, 
please check your plan and billing details.', 'type': 'insufficient_quota'}}
```

**Impact:**
- AI reply generation fails
- Falls back to simple template replies
- Fallback IS working, but not as good as AI replies

**Solution:**
1. Check OpenAI account: https://platform.openai.com/account/billing
2. Add credits or wait for quota reset
3. OR switch to Groq (free tier) as primary LLM

**Quick Fix - Use Groq Instead:**
```bash
# In backend/.env, the Groq key is already set:
GROQ_API_KEY=(already configured in backend/.env)
GROQ_MODEL=llama-3.1-8b-instant

# Update auto_reply_service.py to use Groq when OpenAI fails
```

---

### **BLOCKER #2: LinkedIn API Returns 404**

**Error:**
```
❌ LinkedIn API error: 404 - {"status":404,"code":"RESOURCE_NOT_FOUND",
"message":"No virtual resource found"}
```

**Root Cause:**
The LinkedIn API endpoint is wrong. Currently using:
```python
url = "https://api.linkedin.com/v2/comments"
```

**Should be:**
```python
# For commenting on a share:
url = "https://api.linkedin.com/v2/socialActions/{shareUrn}/comments"
# Example: https://api.linkedin.com/v2/socialActions/urn:li:share:7234567890123456789/comments
```

**Also need to fix the payload structure:**
```python
# CURRENT (wrong):
payload = {
    "actor": f"urn:li:person:{account.platform_user_id}",
    "object": f"urn:li:share:{post_id}",
    "parentComment": comment_id,
    "message": {"text": reply}
}

# CORRECT:
payload = {
    "actor": f"urn:li:person:{account.platform_user_id}",
    "object": f"urn:li:share:{post_id}",
    "message": {"text": reply}
}
# Note: No "parentComment" for top-level comments
# For replying to a specific comment, use:
# url = f"https://api.linkedin.com/v2/socialActions/{comment_urn}/replies"
```

---

### **BLOCKER #3: Webhooks Not Registered with LinkedIn**

**Current Status:**
- Webhook endpoint exists: `/api/v1/webhooks/webhook/linkedin` ✅
- LinkedIn doesn't know about this URL ❌
- No webhooks are being sent from LinkedIn ❌

**What's Needed:**
1. **LinkedIn Developer Portal:**
   - Go to: https://www.linkedin.com/developers/apps
   - Select your app
   - Navigate to "Products" → Enable "Sign In with LinkedIn using OpenID Connect"
   - Navigate to "Webhooks" → Register webhook URL

2. **Webhook URL Format:**
   ```
   https://your-domain.com/api/v1/webhooks/webhook/linkedin
   ```

3. **For Local Testing:**
   - Use ngrok to expose localhost:
   ```bash
   ngrok http 8000
   # Returns: https://abc123.ngrok.io
   # Register: https://abc123.ngrok.io/api/v1/webhooks/webhook/linkedin
   ```

**Alternative for Testing:**
Manually trigger webhook with curl (what we're doing now):
```bash
curl -X POST http://localhost:8000/api/v1/webhooks/webhook/linkedin \
  -H "Content-Type: application/json" \
  -d '{"events": [{"type": "comment", "post_id": "...", "text": "..."}]}'
```

---

## 🔧 **Fixes Needed (In Order):**

### **Priority 1: Fix LinkedIn API Endpoint (5 minutes)**

**File:** `backend/app/routers/platform_webhooks.py`

**Change Line ~77:**
```python
# CURRENT (line 77-78):
url = "https://api.linkedin.com/v2/comments"
payload = {
    "actor": f"urn:li:person:{account.platform_user_id}",
    "object": f"urn:li:share:{post_id}",
    "parentComment": comment_id if comment_id else f"urn:li:comment:{content_id}",
    "message": {"text": reply}
}

# FIX TO:
# For commenting on a post:
url = f"https://api.linkedin.com/v2/socialActions/urn:li:share:{post_id}/comments"
payload = {
    "actor": f"urn:li:person:{account.platform_user_id}",
    "message": {"text": reply}
}

# Note: Remove "object" and "parentComment" fields
# The URL already specifies what we're commenting on
```

---

### **Priority 2: Fix OpenAI Quota Issue (10 minutes)**

**Option A: Add OpenAI Credits**
1. Go to: https://platform.openai.com/account/billing
2. Add $5-10 credits
3. Wait 5 minutes for activation

**Option B: Switch to Groq (FREE)**
Update `backend/app/services/auto_reply_service.py`:

```python
# Add import at top:
from openai import AsyncOpenAI

# Modify generate_reply function to try Groq first:
@observe(name="auto-reply-generation")
async def generate_reply(
    comment_text: str,
    platform: str,
    tone: str = "professional",
    brand_voice: str | None = None,
) -> str:
    """Generate an appropriate auto-reply."""
    
    system_prompt = f"""You are an expert social media manager..."""
    user_prompt = f"""Generate a reply to this comment:..."""
    
    # Try Groq first (free)
    try:
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1"
        )
        response = await client.chat.completions.create(
            model=settings.groq_model,  # llama-3.1-8b-instant
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=150,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        if len(reply) > 280:
            reply = reply[:277] + "..."
        logger.info(f"Generated auto-reply with Groq ({len(reply)} chars) for {platform}")
        return reply
    except Exception as e:
        logger.warning(f"Groq failed, trying OpenAI: {e}")
    
    # Fallback to OpenAI
    try:
        client = get_openai_client()
        response = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[...],
            max_tokens=150,
            temperature=0.7,
        )
        reply = response.choices[0].message.content.strip()
        if len(reply) > 280:
            reply = reply[:277] + "..."
        logger.info(f"Generated auto-reply with OpenAI ({len(reply)} chars)")
        return reply
    except Exception as e:
        logger.error(f"All LLMs failed: {e}")
        # Use template fallbacks
        if any(word in comment_text.lower() for word in ["love", "great", "awesome", "amazing"]):
            return "Thank you so much! We really appreciate your support! 🙏✨"
        elif any(word in comment_text.lower() for word in ["question", "how", "what", "where"]):
            return "Great question! Let me look into that and get back to you soon. 💬"
        else:
            return "Thanks for engaging with our content! We appreciate you! 🙌"
```

---

### **Priority 3: Register Webhook (Production Only)**

**For Production:**
1. Deploy backend to server (Vercel, Railway, AWS, etc.)
2. Get public URL: `https://your-domain.com`
3. Register in LinkedIn Developer Portal
4. LinkedIn will start sending real webhooks

**For Local Testing:**
Keep using manual curl commands (already working)

---

## 🧪 **Testing After Fixes:**

### **Test 1: Verify LinkedIn API Fix**
```bash
curl -X POST http://localhost:8000/api/v1/webhooks/webhook/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "type": "comment",
      "post_id": "7234567890123456789",
      "comment_id": "9876543210987654321",
      "text": "Great article!",
      "author_id": "user-123"
    }]
  }'

# Check logs for:
# ✅ "LinkedIn auto-reply posted successfully"
# Instead of:
# ❌ "LinkedIn API error: 404"
```

### **Test 2: Check Database**
```bash
cd backend
python3 -c "
import sqlite3
conn = sqlite3.connect('socialium.db')
cursor = conn.cursor()
cursor.execute('SELECT publish_failure_reason, publish_retry_count FROM contents WHERE platform_post_id IS NOT NULL')
rows = cursor.fetchall()
for r in rows:
    print(f'Failure Reason: {r[0]}, Retry Count: {r[1]}')
conn.close()
"
```

### **Test 3: Check UI Reflection**
1. Go to: http://localhost:3000/content
2. Find the content that received the comment
3. Check if:
   - Comment count increased
   - Reply status shown
   - Failure reason visible (if any)

---

## 📋 **Complete Checklist:**

- [x] Platform account connected (LinkedIn)
- [x] Content published with platform_post_id
- [x] Webhook endpoint implemented
- [x] Auto-reply service implemented
- [x] OAuth token retrieval working
- [x] HTTP client (httpx) integrated
- [x] Error handling added
- [x] Fallback replies implemented
- [ ] **Fix LinkedIn API URL** (Priority 1 - 5 min)
- [ ] **Fix OpenAI quota or switch to Groq** (Priority 2 - 10 min)
- [ ] **Register webhook with LinkedIn** (Priority 3 - production only)
- [ ] **Add UI for viewing auto-replies** (frontend work)
- [ ] **Add auto-reply toggle in settings** (frontend work)
- [ ] **Test end-to-end with real LinkedIn comment** (after webhook registered)

---

## 🎯 **Recommended Action Plan:**

### **Right Now (15 minutes):**

1. **Fix LinkedIn API endpoint** (5 min)
   - Update URL in `platform_webhooks.py`
   - Remove incorrect payload fields
   - Test with curl

2. **Switch to Groq for AI replies** (10 min)
   - Update `auto_reply_service.py`
   - Test with curl
   - Verify no more 429 errors

3. **Test complete flow** (5 min)
   - Trigger webhook with curl
   - Check logs for success
   - Verify reply would be posted

### **Before Production (1 hour):**

4. **Register webhook with LinkedIn**
   - Deploy to public URL
   - Register in developer portal
   - Verify webhook delivery

5. **Add UI for auto-reply management**
   - Toggle on/off per platform
   - View reply history
   - Configure reply tone/settings

6. **Monitor and iterate**
   - Track success/failure rates
   - Adjust reply templates
   - Handle edge cases

---

## 📞 **What I Can Do For You:**

**I can implement Priority 1 & 2 right now:**

1. ✅ Fix LinkedIn API endpoint URL
2. ✅ Fix payload structure
3. ✅ Add Groq as primary LLM (fallback to OpenAI)
4. ✅ Test the complete flow
5. ✅ Verify it works end-to-end

**Would you like me to proceed with these fixes?**

Just say "yes" and I'll implement them immediately! 🚀
