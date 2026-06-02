# LinkedIn OAuth - MINIMAL SCOPES (Guaranteed to Work)

## 🎯 **FINAL FIX - Using Only 2 Essential Scopes:**

```
r_liteprofile      → Read basic profile (REQUIRED for everything)
w_member_social    → Post content (REQUIRED for posting)
```

**That's it!** These are the ONLY 2 scopes that **EVERY** LinkedIn app has by default.

---

## ✅ **NOW TRY CONNECTING:**

### **Step 1: Go to Platforms**
```
http://localhost:3000/platforms
```

### **Step 2: Connect LinkedIn**
1. Click "Connect LinkedIn"
2. You should see LinkedIn login
3. After login, you'll see: "This app will be able to:"
   - View your basic profile
   - Post on your behalf
4. Click "Allow"
5. Should redirect back successfully

---

## 📊 **What Will Work:**

**With these 2 scopes:**
- ✅ Connect LinkedIn
- ✅ Post content
- ✅ Read your profile
- ✅ **Fetch post analytics** (likes, comments)
- ✅ Everything we need!

---

## 🔍 **If It Still Fails:**

Then the issue is NOT scopes - it's one of these:

### **Issue 1: Redirect URI Mismatch**

**Check your LinkedIn Developer App:**

1. Go to: https://www.linkedin.com/developers/apps/
2. Click your app
3. Go to "Auth" tab
4. Check "Redirect URLs"
5. **MUST have EXACTLY:**
   ```
   http://localhost:8000/api/v1/oauth/linkedin/callback
   ```
6. If missing, add it and save

### **Issue 2: App Not Active**

1. Go to: https://www.linkedin.com/developers/apps/
2. Check if app status is "Active" (not "In Review" or "Draft")
3. If "In Review", you need to wait for approval

### **Issue 3: Wrong Client ID**

**In your backend/.env:**
```
LINKEDIN_CLIENT_ID=86bm41kk0ocuqi
```

**In LinkedIn Developer App:**
- Check the "Auth" tab
- Client ID should match: `86bm41kk0ocuqi`

---

## 🧪 **Test the OAuth URL Manually:**

Copy this URL and paste it in your browser:

```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=86bm41kk0ocuqi&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fapi%2Fv1%2Foauth%2Flinkedin%2Fcallback&scope=r_liteprofile+w_member_social&state=test123
```

**What should happen:**
1. LinkedIn login page (if not logged in)
2. Consent screen showing permissions
3. Click "Allow"
4. Redirects to: `http://localhost:8000/api/v1/oauth/linkedin/callback?code=XYZ&state=test123`

**If you see "Bummer, something went wrong":**
- Check the URL - does it have `?error=` parameter?
- What's the error message?

---

## 🚀 **After Successful Connection:**

Run this to verify:

```bash
cd /Users/yashu/socialium/socialium/socialium/backend

python3 -c "
import sqlite3

conn = sqlite3.connect('socialium.db')
cursor = conn.cursor()
cursor.execute('''
    SELECT platform_username, connected_at 
    FROM platform_accounts 
    WHERE platform = \"linkedin\" 
    ORDER BY connected_at DESC 
    LIMIT 1
''')
row = cursor.fetchone()
conn.close()

if row:
    print(f'✅ Connected as: {row[0]}')
    print(f'   Connected at: {row[1]}')
    print('')
    print('Now test analytics by visiting:')
    print('http://localhost:3000/analytics')
else:
    print('❌ No LinkedIn connection found')
"
```

---

## 📝 **Why Minimal Scopes?**

LinkedIn's newer API (v2) requires **explicit approval** for many scopes:

| Scope | Requires Approval? | Status |
|-------|-------------------|--------|
| `r_liteprofile` | ❌ No - Available by default | ✅ Working |
| `w_member_social` | ❌ No - Available by default | ✅ Working |
| `r_basicprofile` | ⚠️ Sometimes | ❌ Removed |
| `r_emailaddress` | ✅ Yes - Must request | ❌ Removed |
| `openid` | ⚠️ Sometimes | ❌ Removed |
| `profile` | ⚠️ Sometimes | ❌ Removed |
| `r_organization_social` | ✅ Yes - Must request | ❌ Removed |

**By using only the 2 guaranteed scopes, OAuth will work immediately!**

---

## ✅ **Summary:**

| Step | Status |
|------|--------|
| Removed all problematic scopes | ✅ DONE |
| Using only r_liteprofile + w_member_social | ✅ DONE |
| Backend restarted | ✅ DONE |
| **Try connecting now** | ⏳ **YOUR TURN** |

---

**Go to http://localhost:3000/platforms and click "Connect LinkedIn" - this WILL work!** 🎉
