---
title: WhatsApp Webhook Test Plan
summary: Unit, integration, and E2E tests for webhook handler with 80% critical path coverage
description: Comprehensive testing strategy for HMAC validation, message normalization, idempotency, and fire-forget queueing using Vitest and webhook simulation
version: 1.0
date: 2026-01-29
updated: 2026-01-29
scope: Unit, integration, load, E2E tests
status: Draft
---

# Test Plan - WhatsApp Webhook

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Draft

---

## Reference

**SPEC Version:** 1.0
**Feature:** WhatsApp Webhook Handler
**Scope:** Unit | Integration | Load | E2E
**Coverage Target:** 80% critical paths (HMAC, normalization, idempotency)

---

## Test Strategy

**Philosophy:** 80% coverage on security-critical flows (HMAC validation, idempotency). Unit tests verify normalization for all 8 message types. Integration tests verify full webhook flow. Load tests validate 5s timeout compliance.

**Approach:**
- **Unit:** Test HMAC, normalization, cache logic in isolation (Vitest)
- **Integration:** Test full POST flow with mock WhatsApp payloads + real Supabase
- **Load:** Test 1K req/min sustained for 5 minutes, verify <5s timeout
- **E2E:** Test real WhatsApp Business API webhook delivery (staging)

**Tools:**
- Vitest (unit + integration, Edge Runtime compatible)
- Artillery (load testing)
- WhatsApp Business API Test Number (E2E)

**Source:** .backup/specs/07-testing-strategy.md L20-89

---

## Unit Tests

| Module | Test Cases | Tool | Status |
|--------|-----------|------|--------|
| **lib/whatsapp/hmac.ts** | Valid signature, Invalid signature, Missing header, Malformed format (no sha256= prefix), Timing-safe comparison | Vitest | TODO |
| **lib/whatsapp/normalize.ts** | Text message, Image message, Audio message, Video message, Document message, Location message, Interactive (button_reply), Interactive (list_reply), Unsupported type, Malformed payload | Vitest | TODO |
| **lib/whatsapp/cache.ts** | Insert new message ID, Check existing ID (returns true), Check new ID (returns false), Concurrent inserts (race condition) | Vitest | TODO |

**Fixtures:** `tests/fixtures/whatsapp/` (one JSON file per message type)

**Critical paths:**
- HMAC validation (100% coverage - security critical)
- Normalization (all 8 message types + unsupported)
- Idempotency check (duplicate detection)

**Source:** .backup/specs/07-testing-strategy.md L53-89

---

## Integration Tests

| Component | Test Cases | Tool | Status |
|-----------|-----------|------|--------|
| **GET /api/whatsapp/webhook** | Valid verification token returns challenge, Invalid token returns 403, Missing hub.mode returns 400 | Vitest + fetch | TODO |
| **POST /api/whatsapp/webhook** | Valid HMAC + text message returns 200, Invalid HMAC returns 401, Duplicate message skipped (idempotent), Multiple messages in batch processed, Unsupported message type handled, Malformed payload returns 400 (but logs error) | Vitest + fetch + Supabase | TODO |

**Mock Strategy:**
- Use real Supabase (test project) for idempotency cache
- Mock AI processing queue (verify queued, don't execute)
- Use fixture payloads from `tests/fixtures/whatsapp/`

**Critical flows:**
- HMAC rejection (security)
- Idempotency (duplicate prevention)
- Fire-forget queueing (response time)

**Source:** .backup/specs/07-testing-strategy.md L103-156

---

## Load Tests (Artillery)

**Setup:** `npm install -D artillery`
**Run:** `artillery run tests/load/webhook.yml`

**Scenario:**
- Ramp to 1000 requests/minute over 1 minute
- Sustain 1000 req/min for 5 minutes
- Mix: 80% text messages, 10% images, 10% interactive

**Targets:**
- p50 < 500ms
- p95 < 2s
- p99 < 4s
- 0 timeouts (>5s)

**Config:**
```yaml
# tests/load/webhook.yml
config:
  target: https://staging.migue.ai
  phases:
    - duration: 60
      arrivalRate: 1000
  variables:
    hmac_secret: "{{ $env.WHATSAPP_APP_SECRET }}"
scenarios:
  - name: "Webhook POST"
    flow:
      - post:
          url: "/api/whatsapp/webhook"
          headers:
            x-hub-signature-256: "{{ hmac }}"
          json:
            # Fixture payload
```

**Source:** .backup/specs/07-testing-strategy.md L222-250

---

## E2E Tests (Real WhatsApp)

**Setup:**
1. Register WhatsApp Business Test Number
2. Configure webhook URL: `https://staging.migue.ai/api/whatsapp/webhook`
3. Send test messages from WhatsApp Test Client

**Happy Paths:**
1. Send text message → Verify 200 OK received
2. Send image message → Verify normalized correctly
3. Send interactive button → Verify button_reply handled
4. Send duplicate message → Verify only processed once

**Critical Flows:**
- Webhook verification (GET challenge)
- HMAC validation (WhatsApp signs requests)
- Message types (text, image, interactive)
- Idempotency (WhatsApp retry behavior)

**Manual checklist:**
- [ ] GET verification successful (webhook connected)
- [ ] Text message received and queued
- [ ] Image message received with media URL
- [ ] Interactive button reply handled
- [ ] Duplicate delivery detected (send same message twice within 1 min)
- [ ] Logs show all steps (received, normalized, queued)

**Source:** WhatsApp Business API Test Environment docs

---

## Quality Gates CI

| Gate | Tool | Command | Target | Status |
|------|------|---------|--------|--------|
| Format | Biome | `bun run lint` | 0 errors | TODO |
| Lint | Biome | `bun run lint` | 0 errors | TODO |
| Types | tsc | `tsc --noEmit` | 0 errors | TODO |
| Unit | Vitest | `bun test` | 80%+ coverage | TODO |
| Build | Next.js | `bun run build` | Exit 0 | TODO |
| Integration | Vitest | `bun test:integration` | All pass | TODO |

**CI Config:** `.github/workflows/ci.yml`

**Blocking gates:** All must pass before merge

**Source:** docs-global/workflows/quality-gates.md

---

## Edge Case Coverage

| Scenario | Test | Expected |
|----------|------|----------|
| Empty messages array | Integration test with `"messages": []` | 200 OK, log warning, no processing |
| Missing required field (from) | Unit test normalization | Zod validation error, return 400 |
| HMAC replay attack (same sig 2x) | Unit test with timestamp check | Reject second request |
| Multiple messages (batch) | Integration test with 3 messages | All 3 queued, order maintained |
| Unsupported future message type | Unit test normalization | Type = "unsupported", queue anyway |
| Webhook timeout (>5s) | Load test with slow endpoint | 0 timeouts (Edge Runtime prevents) |
| Cache unavailable (Supabase down) | Integration test with mock failure | Log warning, process anyway (degraded mode) |

---

## Fixtures

**Location:** `tests/fixtures/whatsapp/`

**Files:**
- `text-message.json` - Simple text message
- `image-message.json` - Image with media_id
- `audio-message.json` - Audio with media_id
- `video-message.json` - Video with media_id
- `document-message.json` - PDF document
- `location-message.json` - GPS coordinates
- `button-reply.json` - Interactive button response
- `list-reply.json` - Interactive list selection
- `unsupported.json` - Unknown future type
- `batch-messages.json` - Multiple messages in one webhook

**Source:** WhatsApp Business API webhook examples

---

## Manual Testing Checklist

- [ ] Desktop: Test webhook verification via Meta App Dashboard
- [ ] Desktop: Trigger webhook with curl + valid HMAC
- [ ] Desktop: Trigger webhook with curl + invalid HMAC (verify 401)
- [ ] Mobile: Send WhatsApp message from test number
- [ ] Mobile: Send image/video (verify media_id captured)
- [ ] Mobile: Reply to interactive message (button)
- [ ] Observability: Check logs in Vercel dashboard
- [ ] Observability: Verify metrics tracked (request count, duration)
- [ ] Security: Attempt HMAC bypass (verify rejection)

---

## Sign-off

**QA Lead:** ClaudeCode&OnlyMe | **Date:** TBD | **Status:** [ ] Ready | [ ] Blocked

**Notes:**
- HMAC validation is BLOCKING (must be 100% before production)
- Load test results determine if Edge Runtime sufficient or need optimization
- E2E test with real WhatsApp validates full integration

---

**Token-efficient format:** 80 lines | Critical path focus | Clear targets
