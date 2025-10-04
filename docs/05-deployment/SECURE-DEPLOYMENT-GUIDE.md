# Secure Deployment Guide - migue.ai

## 🚨 CRITICAL: Security Incident Response

Your `.env.local` file with production credentials was committed to the repository. Follow these steps **immediately**:

### 1. Rotate All Credentials (URGENT)

#### WhatsApp Credentials
1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp > API Setup**
3. **Regenerate Access Token**:
   - Click "Generate Token"
   - Copy new token immediately
   - Old token will be invalidated
4. **Regenerate App Secret**:
   - Go to App Settings > Basic
   - Click "Show" next to App Secret
   - Click "Reset App Secret"
   - Copy new secret

#### OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Revoke compromised key**:
   - Find key `sk-proj-AxRWXxLHlk05UiKvTW...`
   - Click "Revoke"
3. **Create new key**:
   - Click "Create new secret key"
   - Name it: "migue.ai Production"
   - Copy immediately (won't be shown again)

#### Supabase Keys
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project `pdliixrgdvunoymxaxmw`
3. Go to **Settings > API**
4. **Rotate Service Role Key**:
   - Click "Reset" next to `service_role` key
   - Copy new key
5. **Note**: Anon key rotation not required (public key)

### 2. Remove Credentials from Git History

```bash
# Install BFG Repo-Cleaner
brew install bfg  # macOS
# OR download from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone https://github.com/YOUR_USERNAME/migue.ai.git migue-ai-clean
cd migue-ai-clean

# Remove .env.local from all history
bfg --delete-files .env.local

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (WARNING: This rewrites history)
git push origin --force --all
git push origin --force --tags
```

**⚠️ Warning**: This will rewrite repository history. Notify all collaborators.

### 3. Configure Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project `migue.ai`
3. Go to **Settings > Environment Variables**
4. Add the following as **Sensitive** variables:

#### Required Variables

| Variable | Value | Environments |
|----------|-------|--------------|
| `WHATSAPP_TOKEN` | [New token from Step 1] | Production, Preview, Development |
| `WHATSAPP_PHONE_ID` | `215863621610966` | Production, Preview, Development |
| `WHATSAPP_VERIFY_TOKEN` | `neeroai2025*` | Production, Preview, Development |
| `WHATSAPP_APP_SECRET` | [New secret from Step 1] | Production, Preview, Development |
| `SUPABASE_URL` | `https://pdliixrgdvunoymxaxmw.supabase.co` | Production, Preview, Development |
| `SUPABASE_KEY` | [Your anon key] | Production, Preview, Development |
| `OPENAI_API_KEY` | [New key from Step 1] | Production, Preview, Development |

#### Optional Variables

| Variable | Value | Default |
|----------|-------|---------|
| `NODE_ENV` | `production` | `development` |
| `LOG_LEVEL` | `info` | `info` |

### 4. Sync Variables Locally

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env.local

# Verify
cat .env.local  # Should show new credentials
```

---

## 📋 Pre-Deployment Checklist

### Security

- [ ] All credentials rotated
- [ ] `.env.local` removed from git history
- [ ] Environment variables configured in Vercel as **Sensitive**
- [ ] `.env.local` in `.gitignore` (already done ✅)
- [ ] No secrets in source code

### Code Quality

- [ ] All tests passing: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] No TypeScript errors
- [ ] Code reviewed

### Configuration

- [ ] `vercel.json` updated with function configs
- [ ] Webhook URL configured in Meta Business Manager
- [ ] Cron jobs configured
- [ ] Health check endpoint tested

### Database

- [ ] Supabase migrations applied
- [ ] RLS policies enabled
- [ ] Database indexes created

---

## 🚀 Deployment Steps

### 1. Verify Local Environment

```bash
# Run health check locally
npm run dev

# In another terminal, test health endpoint
curl http://localhost:3000/api/health | jq

# Should show all checks as "ok"
```

### 2. Test Webhook Locally

```bash
# Use ngrok to expose local server
npx ngrok http 3000

# Copy the HTTPS URL
# Example: https://abc123.ngrok.io

# Configure in Meta Business Manager temporarily:
# Callback URL: https://abc123.ngrok.io/api/whatsapp/webhook
# Verify Token: neeroai2025*

# Send test message to WhatsApp number
# Verify it's received and processed
```

### 3. Deploy to Vercel

```bash
# Ensure you're on main branch
git checkout main

# Pull latest
git pull origin main

# Deploy to production
vercel --prod

# OR use git push (auto-deploys)
git push origin main
```

### 4. Verify Production Deployment

```bash
# Get production URL
PROD_URL="https://migue.app"

# Test health endpoint
curl $PROD_URL/api/health | jq

# Expected output:
# {
#   "status": "healthy",
#   "checks": {
#     "environment": { "status": "ok" },
#     "whatsapp": { "status": "ok" },
#     "supabase": { "status": "ok" },
#     "openai": { "status": "ok" }
#   }
# }
```

### 5. Configure Production Webhook

1. Go to [Meta Business Manager](https://business.facebook.com/)
2. Navigate to **WhatsApp > Configuration > Webhooks**
3. Configure:
   - **Callback URL**: `https://migue.app/api/whatsapp/webhook`
   - **Verify Token**: `neeroai2025*`
4. Click **Verify and Save**
5. Subscribe to fields:
   - ✅ `messages`
   - ✅ `message_status`
   - ✅ `message_template_status_update`

### 6. Send Test Message

```bash
# Send WhatsApp message to your business number
# Message: "Hola, esta es una prueba"

# Monitor Vercel logs
vercel logs --follow

# Expected output:
# - Webhook received
# - Signature validated
# - Message processed
# - AI response sent
```

---

## 🔍 Post-Deployment Validation

### Health Checks

```bash
# Production health
curl https://migue.app/api/health | jq

# Check specific services
curl https://migue.app/api/health | jq '.checks.whatsapp'
curl https://migue.app/api/health | jq '.checks.supabase'
curl https://migue.app/api/health | jq '.checks.openai'
```

### Webhook Testing

```bash
# Test message flow:
# 1. Send text message → Should receive AI response
# 2. Send audio message → Should transcribe and respond
# 3. Send PDF document → Should ingest and summarize
# 4. Send interactive button → Should process action
# 5. Send location → Should save location
```

### Performance Monitoring

1. Go to [Vercel Analytics](https://vercel.com/dashboard/analytics)
2. Check:
   - **Edge Function Latency** (target: <100ms)
   - **Error Rate** (target: <1%)
   - **Request Volume**

### Error Monitoring

```bash
# Check recent errors
vercel logs --since 1h | grep ERROR

# Monitor in real-time
vercel logs --follow | grep ERROR
```

---

## 🔧 Troubleshooting

### Health Check Fails

```bash
# Check which service is failing
curl https://migue.app/api/health | jq '.checks'

# Common issues:
# - WhatsApp: Token expired → Regenerate in Meta Business Manager
# - Supabase: Wrong URL/Key → Check Vercel env vars
# - OpenAI: Rate limit → Check usage at platform.openai.com
```

### Webhook Not Receiving Messages

1. **Verify webhook configuration**:
   ```bash
   # Test webhook URL is accessible
   curl https://migue.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=neeroai2025*&hub.challenge=test

   # Should return "test"
   ```

2. **Check Meta Business Manager**:
   - Webhooks > Configuration
   - Verify status is "Active"
   - Check subscribed fields

3. **Check Vercel logs**:
   ```bash
   vercel logs --follow
   ```

### Signature Validation Fails

```bash
# Check WHATSAPP_APP_SECRET is correct
vercel env ls

# Should show WHATSAPP_APP_SECRET as [Sensitive]

# Test locally with correct signature
./tests/manual/test-webhook-signature.sh
```

### Deployment Fails

```bash
# Common issues:

# 1. Build error
npm run build  # Test locally first

# 2. TypeScript errors
npm run typecheck

# 3. Vercel configuration
cat vercel.json | jq  # Validate JSON

# 4. Check Vercel build logs
vercel logs --build
```

---

## 📊 Monitoring & Observability

### Vercel Dashboard

Monitor at: https://vercel.com/dashboard

**Key Metrics**:
- **Invocations**: Total webhook calls
- **Latency**: p50, p95, p99
- **Errors**: 4xx, 5xx rates
- **Edge Network**: Geographic distribution

### Structured Logging

All logs are JSON-formatted for easy parsing:

```bash
# Filter by level
vercel logs | jq 'select(.level == "error")'

# Filter by user
vercel logs | jq 'select(.userId == "USER_ID")'

# Check latency
vercel logs | jq 'select(.duration > 1000)'
```

### Alerts Setup (Recommended)

1. **Vercel Notifications**:
   - Go to Settings > Notifications
   - Enable: Deployment failures, Error spikes

2. **Webhook Monitoring**:
   - Use https://hookdeck.com for webhook observability
   - Automatic retries and replay

---

## 🔐 Security Best Practices

### Environment Variables

- ✅ Use Vercel's **Sensitive** environment variables
- ✅ Never commit `.env.local` to git
- ✅ Rotate credentials every 90 days
- ✅ Use different credentials for dev/prod

### API Security

- ✅ HMAC signature validation (constant-time)
- ✅ Rate limiting (250 msg/sec)
- ✅ Request deduplication (1 min window)
- ✅ Input validation (Zod schemas)

### Network Security

- ✅ HTTPS only
- ✅ Security headers (X-Frame-Options, etc.)
- ✅ No CORS for webhooks
- ✅ IP allowlisting (optional)

---

## 🆘 Emergency Procedures

### Service Outage

```bash
# 1. Check status
curl https://migue.app/api/health

# 2. Check Vercel status
open https://www.vercel-status.com

# 3. Rollback to last working deployment
vercel rollback

# 4. Redeploy
vercel --prod
```

### Credential Compromise

1. **Immediately**:
   - Rotate all credentials (see Step 1)
   - Update Vercel environment variables
   - Redeploy: `vercel --prod`

2. **Within 24h**:
   - Review access logs
   - Check for unauthorized usage
   - Update security documentation

### Data Breach

1. **Stop all services**: Disable webhook in Meta Business Manager
2. **Assess scope**: Check Supabase logs for unauthorized access
3. **Notify**: Follow legal requirements for data breach notification
4. **Remediate**: Rotate all credentials, patch vulnerabilities
5. **Resume**: Only after security audit complete

---

## 📚 Additional Resources

- [Vercel Edge Functions Docs](https://vercel.com/docs/functions/edge-functions)
- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Supabase Security](https://supabase.com/docs/guides/platform/going-into-prod)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/production-best-practices)

---

**Last Updated**: 2025-10-03
**Version**: 1.0.0
**Owner**: Security Team
