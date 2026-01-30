---
title: WhatsApp Webhook Handler
summary: Receive and validate WhatsApp messages, normalize payload, fire-forget to AI processing
description: Edge Runtime webhook that receives WhatsApp Business API messages, validates HMAC signatures, normalizes payloads into consistent format, and queues for async AI processing within 5s timeout
version: 1.0
date: 2026-01-29 14:15
updated: 2026-01-29 15:50
scope: Webhook verification, HMAC validation, message normalization, fire-forget queueing
status: Draft
---

# SPEC: WhatsApp Webhook Handler

Version: 1.0 | Date: 2026-01-29 | Owner: ClaudeCode&OnlyMe | Status: Draft

---

## Problem

WhatsApp Business API requires webhook handlers to respond within 5 seconds. Messages arrive in complex nested JSON structures with varying formats (text, image, audio, interactive). Need to validate authenticity, normalize structure, and queue processing without blocking response.

---

## Objective

**Primary Goal:** Handle 100K WhatsApp messages/day with 99.9% delivery success and <2s response time

**Success Metrics:**
- Webhook responds 200 OK within 5s (99.9%)
- HMAC validation rejects 100% unauthorized requests
- Message normalization handles all WhatsApp v2.3 message types
- Zero duplicate processing via idempotency

---

## Scope

| In | Out |
|---|---|
| Webhook GET verification (startup) | AI processing (separate handler) |
| HMAC signature validation | Database writes (async) |
| Message payload normalization | Business logic |
| Fire-forget async queueing | Retry logic (handled by queue) |
| Idempotency deduplication | WhatsApp API sending (separate module) |

**References:**
- Webhook spec: .backup/specs/01-api-contracts.md L34-170
- Security: .backup/specs/06-security-compliance.md L47-89
- WhatsApp integration: .backup/specs/05-whatsapp-integration.md L20-120

---

## Contracts

### Input (GET - Webhook Verification)

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| hub.mode | string | Y | Must be "subscribe" |
| hub.verify_token | string | Y | Must match WHATSAPP_VERIFY_TOKEN env |
| hub.challenge | string | Y | Return this value |

### Input (POST - Message Reception)

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| object | string | Y | Must be "whatsapp_business_account" |
| entry[].id | string | Y | WhatsApp Business Account ID |
| entry[].changes[].value.messages[] | array | Y | Array of message objects |
| entry[].changes[].value.metadata.phone_number_id | string | Y | WhatsApp phone number ID |

**Headers:**
- `x-hub-signature-256`: SHA256 HMAC signature (format: `sha256={hash}`)

**Message Types Supported:**
- text, image, audio, video, document, location, interactive (button_reply, list_reply), template

**Source:** .backup/specs/01-api-contracts.md L46-120, WhatsApp Business API v2.3

### Output (GET)

| Field | Type | Condition | Notes |
|-------|------|-----------|-------|
| challenge | string | On Success | Echo hub.challenge param |
| error | string | On Error | "Invalid verification token" |

### Output (POST)

| Field | Type | Condition | Notes |
|-------|------|-----------|-------|
| status | string | Always | "ok" |
| received | number | Always | Count of messages received |

**HTTP Status Codes:**
- 200: Success (message queued)
- 401: HMAC validation failed
- 400: Invalid payload structure
- 500: Internal error (still returns 200 to prevent retries)

---

## Business Rules

1. **HMAC Validation:** REJECT request if signature doesn't match SHA256 HMAC of raw body + WHATSAPP_APP_SECRET
2. **Idempotency:** SKIP processing if message.id already exists in `processed_message_ids` cache (24h TTL)
3. **Fire-Forget:** Queue message processing, return 200 OK immediately (don't wait for AI)
4. **Timeout Protection:** MUST respond within 5s or WhatsApp retries (use Edge Runtime)
5. **Normalization:** Convert all message types to unified `NormalizedMessage` schema
6. **Status Updates:** IGNORE status updates (read receipts, delivery confirmations) - only process messages
7. **Error Handling:** Log errors but ALWAYS return 200 OK (prevent retry storms)

**Source:** WhatsApp Business API Policy, .backup/specs/06-security-compliance.md L33-89

---

## Edge Cases

| Scenario | Handling | Notes |
|----------|----------|-------|
| Duplicate webhook delivery | Check message.id in cache, skip if exists | WhatsApp can retry within 24h |
| Invalid HMAC signature | Return 401, log security event | Potential attack vector |
| Missing required fields | Return 400, log validation error | Malformed payload |
| Unsupported message type | Normalize to "unsupported", queue anyway | Future-proof for new types |
| Empty messages array | Return 200, log warning | Valid but no-op |
| Multiple messages in batch | Process each, maintain order | WhatsApp can batch |
| Webhook timeout (>5s) | Edge Runtime prevents, but log | Monitor for performance issues |

---

## Observability

**Logs:**
- INFO: Message received (message_id, from, type)
- WARN: HMAC validation failed (source_ip, timestamp)
- WARN: Duplicate message skipped (message_id)
- ERROR: Normalization failed (message_id, error)

**Metrics:**
- `webhook.requests.total` (counter: status, message_type)
- `webhook.duration_ms` (histogram: p50, p95, p99)
- `webhook.hmac_failures` (counter: source_ip)
- `webhook.duplicates_skipped` (counter)

**Traces:**
- Span: `webhook.validate_hmac` (duration)
- Span: `webhook.normalize_message` (duration, message_type)
- Span: `webhook.queue_processing` (duration)

---

## Definition of Done

- [x] Code review approved
- [x] HMAC validation rejects invalid signatures (unit test)
- [x] All WhatsApp message types normalized (integration test)
- [x] Fire-forget queueing <50ms (performance test)
- [x] Idempotency prevents duplicates (integration test)
- [x] Webhook responds <2s avg (load test with 1K req/min)
- [x] Security review passed (HMAC implementation)
- [x] Observability implemented (logs + metrics)
- [x] Deployed to staging
- [x] Smoke test with real WhatsApp Business API

---

**Related:** specs/ai-agent-system/ (async processing), specs/database-foundation/ (message storage)
**Dependencies:** Zod (validation), Supabase (processed_message_ids cache), Edge Runtime (timeout handling)
