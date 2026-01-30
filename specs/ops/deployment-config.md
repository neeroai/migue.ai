---
title: Deployment Configuration
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Vercel Edge Runtime setup, environment variables, CI/CD pipeline
---

# Deployment Configuration

## Quick Reference
- **Purpose**: Complete deployment setup for Vercel Edge Functions + Supabase integration
- **References**: docs/patterns/edge-runtime-optimization.md, docs-global/platforms/vercel/
- **Platform**: Vercel Edge Runtime (not Node.js runtime)
- **Region**: iad1 (closest to WhatsApp servers)

---

## Vercel Project Setup

### Project Configuration

**File**: vercel.json

```json
{
  "version": 2,
  "buildCommand": "bun run build",
  "outputDirectory": ".next",
  "installCommand": "bun install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NEXT_PUBLIC_APP_URL": "@app-url",
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key"
  },
  "build": {
    "env": {
      "OPENAI_API_KEY": "@openai-api-key",
      "CLAUDE_API_KEY": "@claude-api-key",
      "WHATSAPP_ACCESS_TOKEN": "@whatsapp-access-token",
      "WHATSAPP_VERIFY_TOKEN": "@whatsapp-verify-token",
      "WHATSAPP_WEBHOOK_SECRET": "@whatsapp-webhook-secret",
      "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
      "GOOGLE_CALENDAR_CLIENT_ID": "@google-calendar-client-id",
      "GOOGLE_CALENDAR_CLIENT_SECRET": "@google-calendar-client-secret",
      "CRON_SECRET": "@cron-secret"
    }
  },
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/maintain-windows",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Next.js Configuration

**File**: next.config.ts

```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,

  // Edge Runtime configuration
  experimental: {
    runtime: 'edge',
  },

  // Optimize bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Image optimization (disable for Edge Runtime)
  images: {
    unoptimized: true,
  },

  // Headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://whatsapp.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default config;
```

**Source**: docs/patterns/edge-runtime-optimization.md L35-43

---

## Environment Variables

### .env.example

```bash
# App
NEXT_PUBLIC_APP_URL=https://migue-ai.vercel.app

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # NEVER expose to client

# AI Providers
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-... # Optional fallback

# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_VERIFY_TOKEN=your_verify_token_here # Custom secret
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret_here # From Meta App Dashboard
WHATSAPP_API_VERSION=v23.0

# Google Calendar (OAuth 2.0)
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALENDAR_REDIRECT_URI=https://migue-ai.vercel.app/api/auth/google/callback

# Cron Secret (generate with: openssl rand -hex 32)
CRON_SECRET=your_cron_secret_here

# Feature Flags
ENABLE_CLAUDE_FALLBACK=true
ENABLE_RAG_SEARCH=true
ENABLE_VOICE_TRANSCRIPTION=true

# Monitoring
SENTRY_DSN= # Optional
VERCEL_ANALYTICS_ID= # Auto-configured
```

### Environment Variable Validation

**File**: lib/env.ts

```typescript
import { z } from 'zod';

const envSchema = z.object({
  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // AI Providers
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  CLAUDE_API_KEY: z.string().startsWith('sk-ant-').optional(),

  // WhatsApp
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1),
  WHATSAPP_ACCESS_TOKEN: z.string().startsWith('EAA'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(1),

  // Google Calendar
  GOOGLE_CALENDAR_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com'),
  GOOGLE_CALENDAR_CLIENT_SECRET: z.string().startsWith('GOCSPX-'),

  // Cron
  CRON_SECRET: z.string().min(32),

  // Feature Flags
  ENABLE_CLAUDE_FALLBACK: z.string().transform((v) => v === 'true').optional(),
  ENABLE_RAG_SEARCH: z.string().transform((v) => v === 'true').optional(),
});

export const env = envSchema.parse(process.env);
```

---

## Supabase Connection

### Client Configuration

**File**: lib/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Edge-compatible client (no session persistence)
export const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false, // CRITICAL for Edge Runtime
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
  }
);

// Type-safe queries with generated types
export type Database = any; // TODO: Generate from schema
```

**Source**: docs-global/platforms/supabase/platform-supabase.md L22-39

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File**: .github/workflows/ci.yml

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.3.5
      - run: bun install
      - run: bun run lint

  build:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run build
        env:
          NEXT_PUBLIC_APP_URL: ${{ secrets.NEXT_PUBLIC_APP_URL }}
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables configured in Vercel dashboard
- [ ] Supabase project created and migrations applied
- [ ] WhatsApp Business API app configured with webhook URL
- [ ] Google Calendar OAuth credentials obtained
- [ ] Cron secret generated and stored securely

### Post-Deployment

- [ ] Verify health endpoint: GET /api/health
- [ ] Test webhook verification: GET /api/whatsapp/webhook
- [ ] Send test WhatsApp message
- [ ] Check Vercel logs for errors
- [ ] Verify cron jobs execute correctly
- [ ] Test AI provider fallback (if enabled)

### Monitoring Setup

- [ ] Configure Vercel Analytics
- [ ] Set up error tracking (optional: Sentry)
- [ ] Create dashboard for:
  - Message volume (per hour/day)
  - AI token usage (by provider)
  - Tool execution success rate
  - Average response latency
  - Error rate (by endpoint)

---

## Region Configuration

**Recommended region**: `iad1` (US East - Virginia)

**Rationale**:
- Closest to WhatsApp servers (reduces latency)
- Lowest cold start times for Edge Functions
- Supabase US East region available

**Alternative regions** (if needed):
- `sfo1` (US West - San Francisco) - For California users
- `gru1` (South America - São Paulo) - For Brazilian users
- Keep primary in `iad1` for WhatsApp webhook

**Source**: docs/patterns/edge-runtime-optimization.md L38

---

## Cost Estimates

### Vercel (Pro Plan: $20/month)

| Resource | Limit | Overage Cost |
|----------|-------|--------------|
| Bandwidth | 1TB | $0.15/GB |
| Edge Requests | 1M | $0.65 per 1M |
| Build execution | 100 hours | $40/hour |

**Expected usage (1000 users, 50 messages/day)**:
- Bandwidth: ~10GB/month ($0)
- Edge Requests: ~1.5M/month (~$1)
- **Total**: ~$21/month

### Supabase (Pro Plan: $25/month)

| Resource | Limit | Overage Cost |
|----------|-------|--------------|
| Database size | 8GB | $0.125/GB |
| Bandwidth | 100GB | $0.09/GB |

**Expected usage**:
- Database size: ~2GB first year ($0)
- Bandwidth: ~20GB/month ($0)
- **Total**: ~$25/month

### AI Providers

| Provider | Model | Cost per 1M tokens | Expected monthly |
|----------|-------|-------------------|------------------|
| OpenAI | GPT-4o-mini | $0.15 input, $0.60 output | ~$50 |
| Claude | Haiku 4 | $0.25 input, $1.25 output | ~$0 (fallback only) |

**Total estimated cost**: ~$100/month (1000 users, 50K messages/month)

---

## Testing Checklist

- [ ] Environment variables loaded correctly (check /api/health)
- [ ] Supabase connection works (check database queries)
- [ ] WhatsApp webhook receives messages
- [ ] HMAC signature validation passes
- [ ] AI responses sent successfully
- [ ] Cron jobs execute on schedule
- [ ] Error responses follow standard format
- [ ] Rate limiting triggers correctly

---

**Lines**: 150 | **Tokens**: ~360 | **Status**: Ready for implementation
