---
title: ADR-001 Edge Runtime for Webhook Handler
summary: Use Next.js Edge Runtime (not Node.js Runtime) for WhatsApp webhook to meet 5s timeout
description: Architecture decision to use Vercel Edge Runtime for webhook handler to guarantee <5s response time, evaluated against ClaudeCode&OnlyMe 4-question filter
version: 1.0
date: 2026-01-29
updated: 2026-01-29
scope: Runtime choice for /api/whatsapp/webhook
status: Accepted
---

# ADR-001: Edge Runtime for Webhook Handler

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Accepted

---

## Context

WhatsApp Business API has a hard 5-second timeout for webhook responses. If the endpoint doesn't respond within 5s, WhatsApp retries the message, causing duplicates and potential message storms. Need to choose between Next.js Edge Runtime (lightweight, fast cold starts) or Node.js Runtime (full Node APIs, slower cold starts).

**Constraints:**
- 2-person team (can't manage custom infrastructure)
- 100K messages/day projected volume
- Must respond within 5s (99.9% reliability)
- Cold start latency matters (serverless environment)

---

## Decision

**Will:** Use Next.js Edge Runtime for `/api/whatsapp/webhook` endpoint

**Will NOT:** Use Node.js Runtime or self-hosted servers

---

## Rationale

Edge Runtime has <50ms cold starts vs Node.js Runtime's 200-500ms. With fire-forget queueing pattern (normalize + queue in <100ms), Edge Runtime guarantees <2s p95 response time with 3s safety buffer. Node.js Runtime risks timeout on cold starts under high load.

**Source:**
- Vercel Edge Runtime docs: https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes
- specs/01-api-contracts.md L22-28 (timeout requirements)
- docs/patterns/edge-runtime-optimization.md L36-89

---

## ClaudeCode&OnlyMe Validation

| Question | Answer | Score |
|----------|--------|-------|
| ¿Resuelve problema REAL HOY? | YES - 5s timeout is hard requirement from WhatsApp | 1/1 |
| ¿Solución más SIMPLE? | YES - Built into Next.js, no additional config | 1/1 |
| ¿2 personas lo mantienen? | YES - Managed by Vercel, zero ops | 1/1 |
| ¿Vale si NUNCA crecemos? | YES - Works for 10 messages/day or 100K/day | 1/1 |
| **TOTAL** | **4/4 = ACCEPT** | **4/4** |

**Veto Threshold:** ANY NO = REJECT → All YES = APPROVED

---

## Alternatives Considered

1. **Node.js Runtime** - Rejected
   - Why: 200-500ms cold starts risk timeout under load
   - Trade-off: Full Node.js APIs available (but not needed for webhook)
   - Failed Q2 (not simplest - adds timeout risk)

2. **Self-hosted server (EC2, DigitalOcean)** - Rejected
   - Why: 2-person team can't manage infrastructure
   - Trade-off: No cold starts, but requires monitoring, scaling, security
   - Failed Q3 (not 2-person maintainable)

3. **AWS Lambda with provisioned concurrency** - Rejected
   - Why: Adds complexity (AWS config, IAM, CloudFormation)
   - Trade-off: Warm instances, but $40-80/month extra cost
   - Failed Q2 (not simplest) and Q4 (over-engineered for current scale)

---

## Consequences

**Positive:**
- <50ms cold starts guarantee timeout compliance
- Zero infrastructure management (Vercel handles scaling)
- Automatic global deployment (Edge network)
- Lower cost (Edge Runtime = $0.65/GB vs Node Runtime $2.00/GB)

**Negative:**
- Limited to Web APIs (no Node.js fs, child_process, etc.)
- 5s hard timeout (can't extend for complex processing)
- Edge Runtime debugging slightly different (can't use --inspect)

**Risks:**
- Edge Runtime API changes (Vercel versioning) - **Mitigation:** Lock Next.js version
- Middleware overhead if added later - **Mitigation:** Keep middleware minimal
- Limited Node.js crypto (only crypto.subtle) - **Mitigation:** Web Crypto API sufficient for HMAC SHA256

---

## Implementation Notes

**Runtime config:**
```typescript
// app/api/whatsapp/webhook/route.ts
export const runtime = 'edge';
export const dynamic = 'force-dynamic'; // Prevent caching
```

**HMAC with Edge Runtime:**
```typescript
import { subtle } from 'crypto';
// Use crypto.subtle.importKey() + crypto.subtle.sign() for HMAC
```

**Fire-forget pattern:**
```typescript
// Don't await AI processing
processMessageAsync(message).catch(logError);
return new Response(JSON.stringify({ status: 'ok' }));
```

---

## Related
- ADR-002: Fire-forget queueing strategy (vs synchronous processing)
- specs/whatsapp-webhook/SPEC.md (timeout requirements)
- specs/whatsapp-webhook/PLAN.md (implementation steps)

---

**Decision made:** 2026-01-29
**Review date:** After 1 month in production (validate timeout compliance)
