# LinkedIn OAuth - How Permissions Work

## 📋 **Understanding LinkedIn's OAuth Flow:**

Unlike Google (which shows checkboxes), LinkedIn shows a **single consent screen** that lists all permissions your app is requesting.

---

## 🔍 **What You'll See When Connecting:**

### **Step 1: Click "Connect LinkedIn"**

When you click the Connect button on `/platforms`, you'll be redirected to LinkedIn.

### **Step 2: LinkedIn Login (if not logged in)**

Enter your LinkedIn email/password.

### **Step 3: Consent Screen (THIS IS THE KEY PART!)**

You'll see a screen that looks like this:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   [Socialium App Logo]                                  │
│                                                         │
│   Socialium wants to access your LinkedIn account       │
│                                                         │
│   This app will be able to:                             │
│                                                         │
│   ✓ View your basic profile information                 │
│   ✓ View your email address                             │
│   ✓ Post on your behalf                                 │
│   ✓ Manage your social content                          │
│   ✓ View your profile information                       │
│                                                         │
│   [  Cancel  ]        [  Allow  ]                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### **Step 4: Click "Allow"**

This approves ALL the permissions listed. There are no individual checkboxes - it's all or nothing.

---

## ✅ **What the Code is Now Requesting:**

The URL being generated includes these scopes:

```
openid                      → Authentication
profile                     → Basic profile info
email                       → Email address
w_member_social            → Post content (WRITE)
r_liteprofile              → Read lite profile (READ) ✅ NEW
r_emailaddress             → Read email (READ) ✅ NEW
r_basicprofile             → Read basic profile (READ) ✅ NEW
r_organization_social      → Read org data (READ) ✅ NEW
```

**All 8 scopes are included in ONE request.**

---

## 🎯 **What You Need to Do:**

### **Option 1: If You See the Consent Screen**

1. Click "Connect LinkedIn" on http://localhost:3000/platforms
2. You'll see the consent screen listing permissions
3. Click **"Allow"** (this approves all permissions)
4. You'll be redirected back to `/platforms?linkedin=success`

### **Option 2: If You Don't See the Consent Screen**

This means you already approved permissions previously and LinkedIn remembered your choice.

**Solution:**

1. **Go to:** https://www.linkedin.com/psettings/member-permissions
2. **Scroll to:** "Other applications" section
3. **Find:** "Socialium" (or your app name)
4. **Click:** "Remove" or "Disconnect"
5. **Now go back to:** http://localhost:3000/platforms
6. **Click:** "Connect LinkedIn"
7. **This time you'll see the consent screen!**
8. **Click "Allow"**

---

## 🔧 **Alternative: Clear LinkedIn's Cookie**

If you can't find it in settings:

1. **Open browser console** (F12)
2. **Go to:** Application/Storage tab
3. **Find cookies for:** `linkedin.com`
4. **Delete cookies** or **Clear site data**
5. **Go back to:** http://localhost:3000/platforms
6. **Click:** "Connect LinkedIn"
7. **Consent screen will appear**
8. **Click "Allow"**

---

## 📸 **How to Verify It Worked:**

### **Check Browser URL When Connecting:**

When you click "Connect LinkedIn", look at the URL in your browser's address bar.

**Should look like:**
```
https://www.linkedin.com/oauth/v2/authorization?
  response_type=code
  &client_id=86bm41kk0ocuqi
  &redirect_uri=http://localhost:8000/api/v1/oauth/linkedin/callback
  &scope=openid+profile+email+w_member_social+r_liteprofile+r_emailaddress+r_basicprofile+r_organization_social
  &state=xyz123
```

**Check the `scope=` parameter!**

**Should include:**
- ✅ `r_liteprofile`
- ✅ `r_emailaddress`
- ✅ `r_basicprofile`
- ✅ `w_member_social`

**If you only see:**
- ❌ `openid profile w_member_social email` (OLD scopes)

Then the backend wasn't restarted properly!

---

## 🚨 **If You Still Don't See Permission Options:**

### **This is Normal! LinkedIn Works Differently Than Google:**

**Google OAuth:**
```
☑ View your email
☑ View your profile
☑ Post on your behalf
[ individual checkboxes ]
```

**LinkedIn OAuth:**
```
This app will be able to:
  ✓ View your basic profile
  ✓ Post on your behalf
  [ single "Allow" button ]
```

**LinkedIn doesn't let you pick and choose - it's ALL permissions or NONE.**

---

## ✅ **Simple Steps (No Confusion):**

1. **Go to:** http://localhost:3000/platforms
2. **Disconnect LinkedIn** (if connected)
3. **Clear browser cookies for linkedin.com** (optional but recommended)
4. **Click "Connect LinkedIn"**
5. **Login to LinkedIn** (if asked)
6. **You'll see:** "Socialium wants to access your LinkedIn account" with a list of permissions
7. **Click:** "Allow" button
8. **Wait:** You'll be redirected back
9. **Done!** Analytics should now work

---

## 🔍 **How to Verify New Token Has Correct Permissions:**

After connecting, run this:

```bash
cd /Users/yashu/socialium/socialium/socialium/backend

python3 -c "
import sqlite3
import httpx

# Get the newest LinkedIn token
conn = sqlite3.connect('socialium.db')
cursor = conn.cursor()
cursor.execute('''
    SELECT access_token, connected_at 
    FROM platform_accounts 
    WHERE platform = \"linkedin\" 
    ORDER BY connected_at DESC 
    LIMIT 1
''')
row = cursor.fetchone()
conn.close()

if not row:
    print('❌ No LinkedIn token found!')
    exit(1)

token, connected_at = row
print(f'Token obtained: {connected_at}')
print(f'Token preview: {token[:30]}...')
print('')

# Test if token can access analytics endpoints
import urllib.parse
post_urn = 'urn:li:share:7467092580632059904'
encoded_urn = urllib.parse.quote(post_urn, safe='')

print('Testing /v2/me endpoint...')
resp = httpx.get(
    'https://api.linkedin.com/v2/me',
    headers={
        'Authorization': f'Bearer {token}',
        'LinkedIn-Version': '202411',
    }
)
print(f'Status: {resp.status_code}')
if resp.status_code == 200:
    print('✅ Token works for basic profile!')
else:
    print(f'❌ Failed: {resp.text[:100]}')
print('')

print('Testing analytics endpoint...')
resp2 = httpx.get(
    f'https://api.linkedin.com/v2/socialActions/{encoded_urn}',
    headers={
        'Authorization': f'Bearer {token}',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': '202411',
    }
)
print(f'Status: {resp2.status_code}')
if resp2.status_code == 200:
    print('✅ Token works for analytics!')
    data = resp2.json()
    print(f'Likes: {data.get(\"likes\", {}).get(\"paging\", {}).get(\"total\", 0)}')
    print(f'Comments: {data.get(\"comments\", {}).get(\"paging\", {}).get(\"total\", 0)}')
else:
    print(f'Response: {resp2.text[:150]}')
"
```

**Expected output:**
```
✅ Token works for basic profile!
✅ Token works for analytics!
Likes: 4
Comments: 1
```

---

## 📝 **Summary:**

- **LinkedIn doesn't show checkboxes** - it shows a list and one "Allow" button
- **Just click "Allow"** - this approves all 8 permissions
- **If you don't see the consent screen** - clear LinkedIn cookies or remove app from LinkedIn settings
- **The code is correct** - it's requesting all necessary scopes
- **One click is all you need** - no individual selection required

---

**Just click "Connect LinkedIn" and then click "Allow" when you see the consent screen!** 🎉
