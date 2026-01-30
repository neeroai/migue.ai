---
title: WhatsApp Webhook Tasks
summary: Granular task breakdown for webhook implementation (Week 1-2)
description: TODO/DOING/DONE task tracking for webhook verification, HMAC validation, normalization, and fire-forget queueing implementation
version: 1.0
date: 2026-01-29
updated: 2026-01-29
scope: Implementation tasks (1-4hr granularity)
status: Active
---

# TASKS - WhatsApp Webhook

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Active

---

## Reference
- SPEC: specs/whatsapp-webhook/SPEC.md
- PLAN: specs/whatsapp-webhook/PLAN.md
- TESTPLAN: specs/whatsapp-webhook/TESTPLAN.md
- Source Specs: specs/01-api-contracts.md, specs/05-whatsapp-integration.md, specs/06-security-compliance.md

**Fresh Context Pattern:** Each task reads SPEC + PLAN + TESTPLAN only

---

## DOING (Current)
| ID | Task | DoD | Est |
|----|------|-----|-----|
| - | (No active tasks) | - | - |

---

## TODO (Priority Order)

### Week 1: Core Webhook Setup

| ID | Task | DoD | Est |
|----|------|-----|-----|
| T001 | Create webhook route file structure | `app/api/whatsapp/webhook/route.ts` exists with Edge Runtime config | 1h |
| T002 | Implement GET verification handler | Returns hub.challenge on valid token, 403 on invalid | 2h |
| T003 | Add unit tests for GET verification | Tests valid token, invalid token, missing params | 1h |
| T004 | Create HMAC validation utility | `lib/whatsapp/hmac.ts` validates x-hub-signature-256 with timing-safe comparison | 3h |
| T005 | Add unit tests for HMAC validation | Tests known good/bad signatures, missing header, malformed format | 2h |
| T006 | Create Zod schemas for WhatsApp payloads | Schemas for text, image, audio, video, document, location, interactive messages | 4h |
| T007 | Implement message normalization function | `normalizeMessage()` converts all types to NormalizedMessage interface | 3h |
| T008 | Add unit tests for normalization | Fixture-based tests for each message type + unsupported type | 3h |

**Total Week 1:** 19 hours

### Week 2: Integration & Fire-Forget

| ID | Task | DoD | Est |
|----|------|-----|-----|
| T009 | Implement POST webhook handler skeleton | Validates HMAC, parses body, returns 200 OK | 2h |
| T010 | Integrate normalization into POST handler | Normalizes messages, handles validation errors gracefully | 2h |
| T011 | Create processed_message_ids table in Supabase | Table with id (PK), processed_at, TTL cleanup function | 1h |
| T012 | Implement idempotency check | Check message.id before processing, insert if new | 2h |
| T013 | Add fire-forget queueing (in-process) | Simple queue that processes async, doesn't block response | 3h |
| T014 | Add structured logging | Log message received, HMAC failures, duplicates, errors | 2h |
| T015 | Add integration tests for POST handler | Full flow: valid webhook → 200 OK, invalid HMAC → 401, duplicate → skipped | 4h |
| T016 | Add error handling & 200 OK guarantee | Try-catch around all logic, always return 200 to prevent retries | 2h |
| T017 | Performance test (1K req/min for 5 min) | Verify p95 < 2s, p99 < 4s, no timeouts | 2h |
| T018 | Deploy to staging & test with real WhatsApp | Webhook verification + real message delivery | 2h |

**Total Week 2:** 22 hours

---

## BLOCKED
| ID | Task | Blocker | Assigned |
|----|------|---------|----------|
| - | (No blocked tasks) | - | - |

---

## DONE (Last 5)
| ID | Task | Closed | Commit |
|----|------|--------|--------|
| - | (No completed tasks yet) | - | - |

---

## Task Notes (Learnings)

### HMAC Validation
- Use `crypto.timingSafeEqual()` to prevent timing attacks
- Signature format: `sha256={hash}` (strip prefix before comparison)
- Test with WhatsApp's example payloads from docs

### Message Normalization
- WhatsApp can send multiple messages in one webhook (process each)
- Interactive messages have nested structure (button_reply, list_reply)
- Future-proof: Handle unknown types as "unsupported" (don't fail)

### Edge Runtime Constraints
- 5s hard timeout (can't extend)
- No Node.js APIs (use Web APIs only)
- crypto.subtle available (use for HMAC)

### Idempotency
- WhatsApp retries failed webhooks for up to 24h
- message.id is globally unique (safe for deduplication)
- Race condition: Use INSERT with ON CONFLICT or Supabase RPC

---

**Token-efficient format:** 50 lines | Clear granularity (1-4hr) | Phase-aligned (Weeks 1-2 = Phase 1)
