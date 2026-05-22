# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it immediately by opening a GitHub Issue with the "security" label.

## Security Best Practices

### ⚠️ CRITICAL: Never Commit Secrets

The following should **NEVER** be committed to version control:

- API keys and secrets
- OAuth client secrets
- Database credentials
- Twilio Account SID and Auth Token
- LinkedIn/Twitter/Instagram API secrets
- Supabase keys
- Any `.env` files

### ✅ What We Do

1. **`.env` files are gitignored** - See `.gitignore` for the complete list
2. **Documentation uses placeholders** - Example values in docs use `your_service_name` format
3. **Secrets are stored securely** - Use a secrets manager or secure environment variables in production

### 🚨 If Secrets Are Exposed

If you accidentally commit secrets to the repository:

1. **IMMEDIATELY rotate/revoke the exposed credentials**
   - LinkedIn: Regenerate client secret at https://www.linkedin.com/developers/
   - Twilio: Regenerate auth token at https://www.twilio.com/console
   - Any other service: Follow their credential rotation process

2. **Remove the secrets from the codebase**
   - Replace with placeholder values
   - Commit the fix immediately

3. **Check git history**
   - The secret will still exist in previous commits
   - Consider force-pushing rewritten history if necessary
   - GitHub may have cached the secret in their security alerts

### 📋 Recent Security Incidents

#### Incident #1 - Documentation Secrets Exposure (2026-05-20)

**What happened:**
- LinkedIn Client Secret was exposed in `docs/PHASE1_IMPLEMENTATION_GUIDE.md`
- Twilio Account SID and Auth Token were exposed in multiple documentation files

**Resolution:**
- ✅ All secrets replaced with placeholder values
- ✅ Fixed in commit `88fe968`
- ⚠️ **ACTION REQUIRED**: Rotate the following credentials:
  - LinkedIn Client Secret (was: `WPL_AP1.lddaMe0y13YLawa1.SihHhQ==`)
  - Twilio Account SID (was: `AC74704c473243c5761724bced816b3b98`)
  - Twilio Auth Token (was: `e80e17a5969828c7b8ed410c573f035f`)

**Affected files:**
- `docs/PHASE1_IMPLEMENTATION_GUIDE.md`
- `FEATURE_IMPLEMENTATION_SUMMARY.md`
- `ENHANCED_FEATURES_SETUP.md`
- `INTEGRATION_STATUS.md`

## Development Guidelines

### Environment Variables

Create a `.env.example` file with placeholder values for developers to copy:

```env
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:3000/platforms

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+1234567890

# Add other services here...
```

### Code Reviews

When reviewing code, check for:
- ❌ Hardcoded credentials
- ❌ API keys in source code
- ❌ Secrets in log statements
- ❌ Secrets in error messages
- ❌ Secrets in comments

### Git History

Before pushing:
1. Review all changes with `git diff`
2. Check for accidental secret inclusion
3. Ensure `.env` files are not staged

## Tools

Use these tools to scan for secrets:

- **git-secrets**: Prevents committing secrets
- **truffleHog**: Scans git history for secrets
- **GitHub Secret Scanning**: Built-in GitHub security feature

## Contact

For security concerns, open a GitHub Issue or contact the maintainers directly.
