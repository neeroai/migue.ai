---
title: WhatsApp Webhook Implementation Plan
summary: Technical plan for webhook handler with Edge Runtime, HMAC validation, normalization
description: Step-by-step implementation of webhook verification, HMAC security, message normalization, and fire-forget queueing using Next.js Edge Runtime and Zod validation
version: 1.0
date: 2026-01-29
updated: 2026-01-29
scope: Implementation steps, stack validation, dependencies, risks
status: Draft
---

# SDD Implementation Plan - WhatsApp Webhook

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Draft

---

## Reference

**SPEC:** specs/whatsapp-webhook/SPEC.md
**ADR:** specs/whatsapp-webhook/ADR.md (Edge Runtime decision)
**PRD:** specs/PRD.md (WhatsApp integration)

---

## Stack Validated

**Framework:** Next.js 16.0.10 App Router (Edge Runtime)
**Language:** TypeScript 5.7.3
**Validation:** Zod 3.x
**Security:** Node.js crypto (HMAC SHA256)
**Cache:** Supabase (processed_message_ids table)

**Validation Checklist:**
- [x] Stack matches docs-global/stack/ (Next.js 15+, TypeScript 5.6+)
- [x] NO INVENTAR protocol applied (Edge Runtime from Vercel docs, Zod from npm)
- [x] ClaudeCode&OnlyMe filter passed (2-person team, Edge Runtime = managed)
- [x] Dependencies documented (crypto = built-in, Zod = 1 dependency)
- [x] Known limitations listed (Edge Runtime 5s timeout, no Node.js APIs)

**Sources:**
- Next.js Edge Runtime: https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes
- Zod: https://zod.dev/
- WhatsApp Webhook: https://developers.facebook.com/docs/whatsapp/webhooks

---

## Implementation Steps

### S001: Webhook GET Verification Route
**Deliverable:** GET /api/whatsapp/webhook endpoint that responds to WhatsApp verification challenge
**Dependencies:** None
**Acceptance:**
- Responds with `hub.challenge` when `hub.verify_token` matches env
- Returns 403 when token invalid
- Handles missing query params gracefully

**Details:**
- File: `app/api/whatsapp/webhook/route.ts`
- Export: `GET` handler
- Runtime: Edge
- Validation: Check `hub.mode === "subscribe"` and `hub.verify_token === process.env.WHATSAPP_VERIFY_TOKEN`

**Source:** .backup/specs/01-api-contracts.md L34-60

---

### S002: HMAC Signature Validation
**Deliverable:** Crypto utility that validates x-hub-signature-256 header
**Dependencies:** S001 (route structure)
**Acceptance:**
- Validates SHA256 HMAC using WHATSAPP_APP_SECRET
- Rejects requests with invalid/missing signatures
- Handles timing-safe comparison (prevent timing attacks)
- Unit tested with known good/bad signatures

**Details:**
- File: `lib/whatsapp/hmac.ts`
- Export: `validateHMAC(rawBody: string, signature: string): boolean`
- Algorithm: SHA256 HMAC with constant-time comparison
- Signature format: `sha256={hash}`

**Source:** .backup/specs/06-security-compliance.md L47-89, WhatsApp Webhook Security docs

---

### S003: Message Payload Normalization
**Deliverable:** Zod schemas + normalization function for all WhatsApp message types
**Dependencies:** S001 (route exists)
**Acceptance:**
- Handles 8 message types (text, image, audio, video, document, location, interactive, template)
- Normalizes to consistent `NormalizedMessage` interface
- Validates with Zod, returns typed errors
- Unit tested with fixture payloads

**Details:**
- File: `lib/whatsapp/normalize.ts`
- Export: `normalizeMessage(payload: unknown): NormalizedMessage`
- Schema: Zod schemas for each message type
- Output: `{ id, from, timestamp, type, content, metadata }`

**Message Types:**
```typescript
type MessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'interactive'
  | 'template'
  | 'unsupported';
```

**Source:** .backup/specs/01-api-contracts.md L46-120, WhatsApp Business API v2.3

---

### S004: POST Webhook Handler with Fire-Forget
**Deliverable:** POST /api/whatsapp/webhook that validates, normalizes, queues, returns 200 OK
**Dependencies:** S002 (HMAC), S003 (normalization)
**Acceptance:**
- Validates HMAC before processing
- Normalizes incoming messages
- Checks idempotency (message.id not in cache)
- Queues to async processing (fire-forget)
- Returns 200 OK within 5s (avg <2s)
- Logs all steps for observability

**Details:**
- File: `app/api/whatsapp/webhook/route.ts` (add POST export)
- Flow: Validate HMAC → Parse body → Normalize → Check cache → Queue → Return 200
- Queue: Simple in-process queue (later: Supabase Edge Functions or Vercel Queue)
- Response: `{ status: "ok", received: number }`

**Source:** .backup/specs/01-api-contracts.md L34-170, Edge Runtime patterns

---

### S005: Idempotency Cache (Supabase)
**Deliverable:** Supabase table + functions for duplicate detection
**Dependencies:** S004 (webhook handler), specs/database-foundation (Supabase setup)
**Acceptance:**
- Table `processed_message_ids` with TTL (24h)
- Insert or check message.id before processing
- Handles concurrent requests (UNIQUE constraint)
- Tested with duplicate webhook deliveries

**Details:**
- Table: `processed_message_ids (id TEXT PRIMARY KEY, processed_at TIMESTAMPTZ DEFAULT NOW())`
- Function: `checkAndMarkProcessed(messageId: string): boolean`
- TTL: Automatic cleanup after 24h (PostgreSQL `pg_cron` or manual cron)

**Source:** .backup/specs/02-database-schema.md, WhatsApp duplicate delivery behavior

---

### S006: Error Handling & Observability
**Deliverable:** Structured logging, metrics, error boundaries
**Dependencies:** S004 (webhook handler)
**Acceptance:**
- All errors logged with context (message_id, error type)
- Metrics tracked (request count, duration, HMAC failures)
- ALWAYS returns 200 OK (even on internal errors) to prevent retries
- Sentry/logging integration for monitoring

**Details:**
- File: `lib/logger.ts` (structured logging)
- Metrics: Custom middleware or Vercel Analytics
- Error strategy: Try-catch around all logic, log error, return 200 OK
- Observability: Request ID tracking across spans

**Source:** .backup/specs/07-testing-strategy.md, .backup/specs/09-runbook.md L80-150

---

## Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **HMAC timing attack** | Security breach | Low | Use constant-time comparison (`crypto.timingSafeEqual`) |
| **5s timeout exceeded** | WhatsApp retries | Medium | Edge Runtime + minimal processing (fire-forget) |
| **Duplicate processing** | Double AI calls | Medium | Idempotency cache with UNIQUE constraint |
| **Normalization failure** | Lost messages | Low | Catch errors, log, queue as "unsupported" type |
| **Cache unavailable** | Duplicates processed | Low | Graceful degradation (log warning, process anyway) |
| **Malformed payloads** | Server errors | Medium | Zod validation catches, return 200 + log |

---

## Dependencies

**External:**
- WhatsApp Business API (webhook sender)
- Supabase (idempotency cache)
- Vercel (Edge Runtime hosting)

**Internal:**
- specs/ai-agent-system/ (async message processing)
- specs/database-foundation/ (processed_message_ids table)

**Libraries:**
- zod (validation)
- @supabase/supabase-js (cache client)
- Node.js crypto (HMAC - built-in to Edge Runtime)

---

## Performance Targets

- **Response time:** p95 < 2s, p99 < 4s
- **Throughput:** 1000 req/min sustained
- **HMAC validation:** < 10ms
- **Normalization:** < 50ms
- **Total processing:** < 100ms (leaves 4.9s buffer)

---

## Testing Strategy

See specs/whatsapp-webhook/TESTPLAN.md for full details.

**Quick summary:**
- Unit: HMAC validation, normalization for each message type
- Integration: Full webhook flow with mock WhatsApp payloads
- Load: 1K req/min for 5 minutes, verify <5s timeout
- E2E: Real WhatsApp Business API webhook delivery

---

**Token-efficient format:** 180 lines | Actionable steps | Clear dependencies
