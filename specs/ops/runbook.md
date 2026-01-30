---
title: Runbook & Operations Guide
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Development setup, deployment, debugging, common issues, troubleshooting
---

# Runbook & Operations Guide

## Quick Reference
- **Purpose**: Operational guide for development, deployment, debugging, and troubleshooting
- **References**: docs/research/prd-gap-analysis.md, specs/00-implementation-phases.md
- **Team**: 2-person (ClaudeCode&OnlyMe)
- **Support**: Self-service debugging + Vercel logs

---

## Development Setup

### Prerequisites

- Bun 1.3.5+ (package manager)
- Node.js 20+ (for compatibility checks)
- Git (version control)
- Supabase CLI (database migrations)
- Vercel CLI (deployment)

### Initial Setup (15 minutes)

```bash
# 1. Clone repository
git clone https://github.com/neero/migue.ai.git
cd migue.ai

# 2. Install dependencies
bun install

# 3. Copy environment variables
cp .env.example .env.local

# 4. Configure environment variables (see Environment Setup section)

# 5. Run database migrations
supabase db push

# 6. Start development server
bun run dev

# 7. Open http://localhost:3000
```

### Environment Setup

**Required variables**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # CRITICAL: Service role only

# AI Providers
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-... # Optional

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_VERIFY_TOKEN=your_verify_token_here
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret_here

# Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-xxx

# Cron
CRON_SECRET=$(openssl rand -hex 32)
```

**How to obtain credentials**:
1. **Supabase**: Create project at https://supabase.com → Settings → API
2. **OpenAI**: https://platform.openai.com/api-keys
3. **Claude**: https://console.anthropic.com/settings/keys (optional)
4. **WhatsApp**: https://developers.facebook.com/apps → WhatsApp → API Setup
5. **Google Calendar**: https://console.cloud.google.com → APIs & Services → Credentials

---

## Deployment Process

### Initial Deployment

```bash
# 1. Connect to Vercel
vercel login
vercel link

# 2. Configure environment variables in Vercel dashboard
# Project Settings → Environment Variables → Add all .env variables

# 3. Deploy to production
vercel --prod

# 4. Configure WhatsApp webhook URL
# Meta App Dashboard → WhatsApp → Configuration → Webhook URL:
# https://your-app.vercel.app/api/whatsapp/webhook
# Verify Token: (same as WHATSAPP_VERIFY_TOKEN)

# 5. Test webhook
curl "https://your-app.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
# Should return: test123

# 6. Send test WhatsApp message
# Open WhatsApp → Send message to your business number
```

### Continuous Deployment

**Every push to main triggers deployment**:
1. GitHub Actions runs lint + build
2. Vercel deploys to production
3. Verify deployment: https://your-app.vercel.app/api/health

---

## Database Migrations

### Creating Migrations

```bash
# 1. Make changes to schema (supabase/migrations/*.sql)

# 2. Apply migrations locally
supabase db reset

# 3. Test migrations
bun run test:integration

# 4. Push to production
supabase db push --linked

# 5. Verify migration
supabase db diff
```

### Migration Rollback

```bash
# Rollback last migration
supabase db reset --version <previous_version>

# Or manually revert in SQL
supabase db execute "DROP TABLE IF EXISTS new_table;"
```

---

## Debugging Guide

### Check System Health

```bash
# 1. Health endpoint
curl https://your-app.vercel.app/api/health

# Expected response:
# {
#   "status": "healthy",
#   "services": {
#     "database": { "status": "up", "latency": 45 },
#     "ai_primary": { "status": "up", "provider": "openai", "latency": 320 },
#     "whatsapp": { "status": "up" }
#   }
# }

# 2. Check Vercel logs
vercel logs --follow

# 3. Check Supabase logs
supabase db logs --tail 100

# 4. Check webhook logs
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/check-reminders
```

### Common Debugging Commands

```bash
# View recent webhooks
supabase db execute "SELECT * FROM webhooks ORDER BY created_at DESC LIMIT 10;"

# View AI requests by user
supabase db execute "SELECT * FROM ai_requests WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 10;"

# View failed tool executions
supabase db execute "SELECT * FROM tool_executions WHERE status = 'error' ORDER BY created_at DESC LIMIT 10;"

# Check messaging window status
supabase db execute "SELECT * FROM messaging_windows WHERE user_id = 'USER_ID' AND is_open = true;"

# View dead letter queue
supabase db execute "SELECT * FROM dead_letter_queue WHERE status = 'pending' ORDER BY created_at DESC;"
```

---

## Common Issues & Solutions

### Issue 1: Webhook Not Receiving Messages

**Symptoms**: WhatsApp messages sent but no response

**Debug steps**:
1. Check webhook verification:
   ```bash
   curl "https://your-app.vercel.app/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
   ```
2. Check Vercel logs for webhook requests
3. Verify HMAC signature validation (check logs for "Invalid signature")
4. Test with WhatsApp test number

**Solutions**:
- Ensure `WHATSAPP_WEBHOOK_SECRET` matches Meta app configuration
- Check webhook URL is correct in Meta dashboard
- Verify webhook subscriptions enabled (messages, message_status)

### Issue 2: AI Not Responding

**Symptoms**: Webhook received but no AI response sent

**Debug steps**:
1. Check AI provider health:
   ```bash
   curl https://your-app.vercel.app/api/health
   ```
2. Check AI request logs:
   ```sql
   SELECT * FROM ai_requests WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 5;
   ```
3. Check token budget:
   ```typescript
   const budget = await checkTokenBudget(userId);
   console.log('Budget:', budget);
   ```

**Solutions**:
- Verify `OPENAI_API_KEY` is valid
- Check token budget not exceeded (reset monthly limit if needed)
- Try fallback provider (Claude) if OpenAI down
- Check error logs for specific AI provider errors

### Issue 3: Tool Execution Failing

**Symptoms**: AI responds but tool not executing

**Debug steps**:
1. Check tool execution logs:
   ```sql
   SELECT * FROM tool_executions WHERE status = 'error' ORDER BY created_at DESC LIMIT 10;
   ```
2. Check specific tool (e.g., calendar):
   ```bash
   bun run test:integration -- calendar.test.ts
   ```

**Solutions**:
- Google Calendar: Verify OAuth credentials, refresh tokens
- Reminders: Check database connection
- Expenses: Verify Supabase schema

### Issue 4: Rate Limiting Triggering

**Symptoms**: 429 errors in logs

**Debug steps**:
1. Check rate limit records:
   ```sql
   SELECT * FROM rate_limits WHERE key = 'USER_ID' ORDER BY created_at DESC;
   ```

**Solutions**:
- Increase rate limits if legitimate usage
- Reset rate limit window manually:
   ```sql
   DELETE FROM rate_limits WHERE key = 'USER_ID';
   ```
- Block abusive users

### Issue 5: Messaging Window Closed

**Symptoms**: Cannot send freeform messages

**Debug steps**:
1. Check window status:
   ```sql
   SELECT * FROM messaging_windows WHERE user_id = 'USER_ID' AND is_open = true;
   ```

**Solutions**:
- Use template messages outside 24h window
- Wait for user to send message (opens new window)
- Check template messages approved in Meta dashboard

---

## Monitoring & Alerts

### Key Metrics to Monitor

| Metric | Threshold | Alert Action |
|--------|-----------|--------------|
| Error rate | >5% | Check logs, investigate cause |
| Webhook latency | >4s | Optimize processing, consider queuing |
| AI provider latency | >10s | Switch to fallback provider |
| Monthly cost | >$100 | Review token usage, optimize |
| Tool failure rate | >10% | Check tool integrations |
| Database latency | >200ms | Optimize queries, add indexes |

### Vercel Analytics

**Access**: https://vercel.com/your-project/analytics

**Key metrics**:
- Function invocations
- Error rate
- P95 latency
- Edge requests

### Supabase Monitoring

**Access**: https://supabase.com/dashboard/project/YOUR_PROJECT/reports

**Key metrics**:
- Database connections
- Query performance
- Storage usage
- API requests

---

## Backup & Recovery

### Database Backup

```bash
# Automatic backups (Supabase Pro)
# Daily backups retained for 7 days

# Manual backup
supabase db dump -f backup.sql

# Restore from backup
supabase db restore backup.sql
```

### Code Rollback

```bash
# Rollback to previous deployment
vercel rollback

# Or deploy specific commit
git checkout <previous-commit>
vercel --prod
```

---

## Performance Optimization

### Edge Function Optimization

```typescript
// 1. Lazy load AI SDKs
const { generateText } = await import('ai');

// 2. Minimize bundle size
// Only import what you need

// 3. Use streaming for long responses
export async function POST(req: Request) {
  const stream = await generateText({
    model: openai('gpt-4o'),
    prompt: 'Long prompt...',
    experimental_stream: true,
  });

  return new Response(stream.toReadableStream());
}
```

### Database Query Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_messages_user_created ON messages(user_id, created_at DESC);
CREATE INDEX idx_ai_requests_date ON ai_requests(created_at::date);

-- Use materialized views for analytics
CREATE MATERIALIZED VIEW user_cost_summary AS
SELECT user_id, SUM(cost_usd) as total_cost, COUNT(*) as request_count
FROM ai_requests
WHERE created_at >= date_trunc('month', NOW())
GROUP BY user_id;
```

---

## Security Checklist

- [ ] All environment variables in Vercel (not in code)
- [ ] HMAC signature validation enabled
- [ ] RLS policies enabled on all user tables
- [ ] Service role key never exposed to client
- [ ] PII redacted in logs
- [ ] Rate limiting configured
- [ ] Cron secret protection enabled
- [ ] HTTPS only (Vercel default)

---

## Emergency Procedures

### System Down

1. Check Vercel status: https://vercel.com/status
2. Check Supabase status: https://status.supabase.com
3. Check AI provider status: OpenAI, Anthropic
4. If all up, check deployment logs
5. Rollback if recent deploy caused issue

### Data Breach

1. Immediately rotate all API keys (Vercel env vars)
2. Revoke Supabase service role key
3. Generate new WhatsApp webhook secret
4. Audit database access logs
5. Notify affected users (if PII exposed)

---

## Testing Checklist

- [ ] Health endpoint returns 200
- [ ] Webhook verification works
- [ ] Test message processed successfully
- [ ] AI response sent correctly
- [ ] Tool execution works (calendar, reminders, expenses)
- [ ] Rate limiting triggers correctly
- [ ] Cron jobs execute on schedule

---

**Lines**: 150 | **Tokens**: ~360 | **Status**: Ready for implementation
