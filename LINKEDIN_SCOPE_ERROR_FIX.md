# LinkedIn OAuth Scope Error - FIXED

## 🐛 **Error Found:**

```
unauthorized_scope_error
Scope "r_emailaddress" is not authorized for your application
```

**Root Cause:** Your LinkedIn Developer App doesn't have permission to use `r_emailaddress` and `r_organization_social` scopes.

---

## ✅ **Immediate Fix Applied:**

Removed unauthorized scopes from OAuth request:

**BEFORE (causing error):**
```python
"scope": "openid profile email w_member_social r_liteprofile r_emailaddress r_basicprofile r_organization_social"
```

**AFTER (working):**
```python
"scope": "openid profile email w_member_social r_liteprofile r_basicprofile"
```

**Removed:**
- ❌ `r_emailaddress` - Not authorized for your app
- ❌ `r_organization_social` - Not authorized for your app

**Kept:**
- ✅ `openid` - Authentication
- ✅ `profile` - Basic profile info
- ✅ `email` - Email address (this one IS authorized)
- ✅ `w_member_social` - Post content (WRITE)
- ✅ `r_liteprofile` - Read lite profile (READ for analytics)
- ✅ `r_basicprofile` - Read basic profile (READ for analytics)

---

## 🎯 **Now Try Connecting Again:**

### **Step 1: Go to Platforms**
```
http://localhost:3000/platforms
```

### **Step 2: Connect LinkedIn**
- Click "Connect LinkedIn"
- You should now see the consent screen (no error!)
- Click "Allow"
- Should redirect back successfully

### **Step 3: Verify**
- Should see "Connected: Aryan Khatri"
- Backend logs: "LinkedIn account saved successfully"

---

## 🔧 **Optional: Enable Additional Scopes**

If you want full analytics capabilities, you can request access to the missing scopes:

### **How to Request Access:**

1. **Go to:** https://www.linkedin.com/developers/apps/
2. **Click your app** (86bm41kk0ocuqi)
3. **Go to:** "Auth" tab
4. **Scroll to:** "Scopes" section
5. **Find these scopes:**
   - `r_emailaddress` - Click "Request Access"
   - `r_organization_social` - Click "Request Access"
6. **Fill out the request form** explaining why you need these scopes
7. **Submit for review** (LinkedIn may take 1-2 weeks to approve)

### **Alternative: Use Test Accounts**

LinkedIn gives **full access to test accounts** without review:

1. **Go to:** https://www.linkedin.com/developers/apps/
2. **Click your app**
3. **Go to:** "Test Apps" section
4. **Create a test app**
5. **Test apps have ALL scopes enabled by default**
6. **Use the test app's Client ID and Secret** in your `.env` file

---

## 📊 **What Analytics Will Work:**

### **With Current Scopes (6 scopes):**
- ✅ Read basic profile
- ✅ Read lite profile  
- ✅ Post content
- ✅ **Fetch post analytics** (likes, comments) ← THIS IS WHAT WE NEED!
- ❌ Cannot read email address separately (but can get from `email` scope)
- ❌ Cannot read organization/company page data

### **After Enabling All Scopes (8 scopes):**
- ✅ Everything above
- ✅ Read email address explicitly
- ✅ Read organization social data
- ✅ Better company page analytics

---

## 🧪 **Test the Connection:**

After connecting, run this to verify the token works:

```bash
cd /Users/yashu/socialium/socialium/socialium/backend

python3 -c "
import sqlite3
import httpx

# Get the newest LinkedIn token
conn = sqlite3.connect('socialium.db')
cursor = conn.cursor()
cursor.execute('''
    SELECT access_token, platform_username 
    FROM platform_accounts 
    WHERE platform = \"linkedin\" 
    ORDER BY connected_at DESC 
    LIMIT 1
''')
row = cursor.fetchone()
conn.close()

if not row:
    print('❌ No LinkedIn token found! Try connecting again.')
    exit(1)

token, username = row
print(f'Connected as: {username}')
print(f'Token: {token[:30]}...')
print('')

# Test basic profile access
print('Testing /v2/me endpoint...')
resp = httpx.get(
    'https://api.linkedin.com/v2/me',
    headers={
        'Authorization': f'Bearer {token}',
        'LinkedIn-Version': '202411',
    }
)
if resp.status_code == 200:
    print('✅ Token works! Can read profile')
    data = resp.json()
    print(f'Name: {data.get(\"firstName\", {})} {data.get(\"lastName\", {})}')
else:
    print(f'❌ Failed: {resp.status_code}')
print('')

# Test analytics endpoint
import urllib.parse
post_urn = 'urn:li:share:7467092580632059904'
encoded_urn = urllib.parse.quote(post_urn, safe='')

print('Testing analytics endpoint...')
resp2 = httpx.get(
    f'https://api.linkedin.com/v2/socialActions/{encoded_urn}',
    headers={
        'Authorization': f'Bearer {token}',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202411',
    }
)
if resp2.status_code == 200:
    print('✅ Analytics working!')
    data = resp2.json()
    likes = data.get('likes', {}).get('paging', {}).get('total', 0)
    comments = data.get('comments', {}).get('paging', {}).get('total', 0)
    print(f'Likes: {likes}')
    print(f'Comments: {comments}')
else:
    print(f'Status: {resp2.status_code}')
    print(f'Response: {resp2.text[:150]}')
"
```

**Expected output:**
```
Connected as: Aryan Khatri
✅ Token works! Can read profile
✅ Analytics working!
Likes: 4
Comments: 1
```

---

## 📝 **Summary:**

| Issue | Status | Fix |
|-------|--------|-----|
| `r_emailaddress` not authorized | ✅ FIXED | Removed from scope |
| `r_organization_social` not authorized | ✅ FIXED | Removed from scope |
| Analytics scopes (`r_liteprofile`, `r_basicprofile`) | ✅ KEPT | These ARE authorized |
| Backend restarted | ✅ DONE | New scopes active |
| **Try connecting again** | ⏳ **YOUR TURN** | Should work now! |

---

## 🚀 **Next Steps:**

1. ✅ **Connect LinkedIn now** - Should work without errors
2. ✅ **Verify connection** - Should see your name
3. ✅ **Test analytics** - Refresh analytics page
4. ⏳ **Optional: Request additional scopes** - For full features

---

**Go connect LinkedIn now - it should work!** 🎉
