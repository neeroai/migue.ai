---
title: ADR 002 - Vercel Edge Functions for Webhooks
summary: Decision to use Vercel Edge Functions for WhatsApp webhook handling with <100ms global latency
description: Architecture decision covering runtime selection, edge vs serverless tradeoffs, and performance optimization for WhatsApp webhook endpoints
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: infrastructure
status: accepted
---

# ADR 002: Vercel Edge Functions for Webhooks

## Status

**Accepted** - 2026-01-28

## Context

migue.ai needs to handle WhatsApp webhook requests with:
- <500ms response time (WhatsApp requirement: 5s, our target: 500ms)
- Global availability (LATAM primary, worldwide capable)
- High reliability (>99.5% uptime)
- Cost efficiency (<$0.10 per user/month infrastructure)
- Fire-and-forget pattern support

**Current Stack**:
- Next.js 16.0.10
- Bun 1.3.5 (package manager)
- Supabase PostgreSQL (database)

**Deployment Options**:
1. Vercel Edge Functions (global CDN)
2. Vercel Serverless Functions (region-specific)
3. Self-hosted (AWS Lambda, Cloud Run)

## Decision

**Primary Runtime**: Vercel Edge Functions for webhook endpoints

**Secondary Runtime**: Vercel Serverless Functions for long-running AI processing

## Rationale

### Performance Comparison

| Metric | Edge Functions | Serverless Functions | Self-Hosted (AWS) |
|--------|----------------|----------------------|-------------------|
| Cold start | 0-50ms | 100-500ms | 200-1000ms |
| Global latency (LATAM) | 50-100ms | 150-300ms | 200-500ms |
| Max execution time | 30s | 60s | Unlimited |
| Concurrent requests | Unlimited | 1000 per region | Depends on config |

**Webhook Latency Breakdown** (measured):

```
Edge Functions:
├── Network (LATAM → Edge) : 50-80ms
├── Signature validation   : 50-100ms
├── Return 200 OK         : 10-20ms
└── Total                 : 110-200ms ✅

Serverless Functions:
├── Network (LATAM → us-east-1) : 100-150ms
├── Cold start (10% of requests) : 100-300ms
├── Signature validation        : 50-100ms
├── Return 200 OK              : 10-20ms
└── Total                      : 260-570ms ⚠️
```

**Target**: <500ms → **Edge Functions meet requirement consistently**

### Cost Analysis

**Vercel Pricing** (Pro plan, $20/month):
- Edge Functions: Included 1M requests, then $0.65 per 1M
- Serverless Functions: Included 1M requests, then $0.60 per 1M
- GB-hours: Included 1000, then $0.18 per GB-hour

**Estimated Usage** (1000 active users):
- Webhook requests: ~80,000/month (20 messages/user/week)
- AI processing: ~80,000/month (same)
- Additional requests: ~20,000/month (cron jobs, etc.)
- Total: ~180,000/month → Within free tier ✅

**Projected Cost** (Year 1):
- Months 1-6 (< 1M requests): $0/month
- Months 7-12 (1-3M requests): ~$1-5/month
- **Total infrastructure**: <$0.10 per user/month ✅

### Hybrid Approach

**Edge Functions** (fast, global):
- `POST /api/whatsapp/webhook` - Signature validation, 200 response
- `GET /api/whatsapp/webhook` - Webhook verification

**Serverless Functions** (longer execution):
- Background AI processing (3-8s)
- Cron jobs (reminder checks, window maintenance)
- Complex operations (calendar sync, OCR)

**Pattern**:
```typescript
// app/api/whatsapp/webhook/route.ts (Edge Runtime)
export const runtime = 'edge';

export async function POST(req: Request) {
  // Fast operations only
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();

  if (!validateSignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Trigger serverless function for AI processing
  await fetch('https://yourdomain.com/api/internal/process-message', {
    method: 'POST',
    body,
    headers: { 'Authorization': `Bearer ${INTERNAL_SECRET}` }
  });

  return new Response('OK', { status: 200 });
}
```

```typescript
// app/api/internal/process-message/route.ts (Serverless)
export const maxDuration = 30; // 30s timeout

export async function POST(req: Request) {
  // Long-running AI processing
  const webhook = await req.json();
  const aiResponse = await processWithAI(webhook); // 3-8s
  await sendWhatsAppMessage(aiResponse);
  return Response.json({ success: true });
}
```

## Implementation

### Edge Function Constraints

**What's Available**:
- Web APIs: `fetch`, `Request`, `Response`, `Headers`
- Crypto: `crypto.subtle` for HMAC validation
- JSON parsing: `JSON.parse`, `JSON.stringify`
- Text encoding: `TextEncoder`, `TextDecoder`

**What's NOT Available**:
- Node.js APIs: `fs`, `path`, `child_process`
- Dynamic imports (use static imports)
- Large dependencies (>1MB bundle size)

**Workarounds**:

```typescript
// ❌ Don't use Node.js crypto
import crypto from 'crypto'; // Not available in Edge

// ✅ Use Web Crypto API
const signature = await crypto.subtle.sign(
  'HMAC',
  await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ),
  new TextEncoder().encode(body)
);
```

### Configuration

**next.config.ts**:
```typescript
const config = {
  experimental: {
    runtime: 'edge', // Default runtime
  }
};
```

**Per-route runtime**:
```typescript
// Edge runtime (fast, global)
export const runtime = 'edge';

// Serverless runtime (long execution)
export const runtime = 'nodejs';
export const maxDuration = 30; // Max 60s on Pro plan
```

### Monitoring

**Vercel Analytics** (built-in):
- Request latency (p50, p95, p99)
- Error rate
- Geographic distribution
- Cold start frequency

**Custom Metrics**:
```typescript
// app/api/whatsapp/webhook/route.ts
const startTime = Date.now();

// ... processing ...

const duration = Date.now() - startTime;
console.log(`Webhook processed in ${duration}ms`, {
  path: '/api/whatsapp/webhook',
  duration,
  status: 200
});
```

**Vercel automatically logs** structured console output for analytics

## Consequences

### Positive

1. **Low latency**: <200ms webhook response globally
2. **High availability**: Multi-region edge deployment
3. **Cost efficient**: Free tier covers early growth
4. **Zero ops**: No server management, auto-scaling
5. **Observability**: Built-in Vercel Analytics

### Negative

1. **API constraints**: No Node.js APIs in edge runtime
2. **Bundle size limits**: 1MB max for edge functions
3. **Vendor lock-in**: Vercel-specific deployment
4. **Debugging complexity**: Edge environment differs from local

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Vercel outage | Low | High | Deploy to multiple regions, have backup hosting ready |
| Edge cold starts increase | Medium | Low | Monitor p95 latency, optimize bundle size |
| Costs exceed budget | Low | Medium | Set spending alerts at $50/month, optimize request count |
| Bundle size exceeds 1MB | Medium | Medium | Tree-shake dependencies, use dynamic imports for heavy libs |

## Alternatives Considered

### Alternative 1: Serverless Functions Only

**Pros**: Simpler (single runtime), more Node.js APIs available
**Cons**: 2-3x higher latency (cold starts), slower global performance
**Rejected**: Latency target not met consistently

### Alternative 2: AWS Lambda + API Gateway

**Pros**: More control, unlimited execution time, cheaper at scale
**Cons**: Ops overhead (2-person team), no edge network, cold starts
**Rejected**: Ops complexity violates 2-person team principle

### Alternative 3: Self-Hosted (Cloud Run, ECS)

**Pros**: Full control, any runtime, unlimited execution
**Cons**: Requires DevOps expertise, server management, scaling complexity
**Rejected**: 2-person team cannot maintain infrastructure

## Validation Plan

### Performance Testing

**Target**: p95 webhook latency <500ms from LATAM

```bash
# Load test from Colombia
artillery run --config artillery.yml webhook-test.yml

# webhook-test.yml
config:
  target: 'https://migue-ai.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Sustained load"
scenarios:
  - name: "Webhook POST"
    flow:
      - post:
          url: "/api/whatsapp/webhook"
          headers:
            x-hub-signature-256: "sha256=..."
          json:
            object: "whatsapp_business_account"
```

**Success Criteria**:
- p50 < 200ms
- p95 < 500ms
- p99 < 1000ms
- Error rate < 0.1%

### Bundle Size Monitoring

```bash
# Check edge function bundle size
npm run build
du -sh .next/server/app/api/whatsapp/webhook/route.js

# Should be < 500KB (target), max 1MB
```

### Failover Testing

**Scenario**: Simulate Vercel outage

```bash
# 1. Deploy backup to Cloudflare Workers
wrangler deploy

# 2. Update DNS to point to Cloudflare
# (manual process, ~ 5 min)

# 3. Verify webhook still works
curl -X POST https://backup.migue-ai.workers.dev/webhook
```

**Target**: <10 min recovery time

## Review Schedule

- **Weekly** during Phase 1 (implementation)
- **Monthly** for first 3 months post-launch
- **Quarterly** thereafter
- **Ad-hoc** if p95 latency >500ms or costs >$50/month

## References

**C1**: Vercel Edge Functions Docs - https://vercel.com/docs/functions/edge-functions
**C2**: Vercel Pricing - https://vercel.com/pricing (Pro plan)
**C3**: Web Crypto API - MDN documentation for HMAC in Edge runtime
**C4**: molbot project - Performance benchmarks for webhook latency

---

**Decision Maker**: Javier Polo (CEO)
**Stakeholders**: ClaudeCode&OnlyMe team
**Implementation**: Phase 1 (Weeks 1-3)
