---
title: Fire-and-Forget Webhook Pattern
summary: Webhook pattern that returns 200 immediately and processes asynchronously to prevent retry storms
description: Technical pattern for handling WhatsApp webhooks with immediate response and background processing, learned from archived migue.ai code and molbot project
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: architecture
---

# Fire-and-Forget Webhook Pattern

## Problem Statement

**Challenge**: WhatsApp Cloud API has strict timeout requirements
- Webhook must respond within 5 seconds
- AI processing takes 3-8 seconds (GPT-4o-mini)
- If timeout occurs, WhatsApp retries webhook
- Retries cause duplicate messages and race conditions

**Impact Without Pattern**:
- Duplicate AI processing costs
- Users receive duplicate responses
- Webhook endpoint overwhelmed by retries
- Poor user experience (multiple identical messages)

## Solution: Fire-and-Forget

**Principle**: Acknowledge receipt immediately, process in background

### Flow Diagram

```
1. WhatsApp sends webhook POST
   ↓
2. Validate HMAC signature (100ms)
   ↓
3. Return 200 OK immediately (<500ms total)
   ↓
4. Background processing starts
   ↓ (async, no blocking)
5. Load user context (200ms)
   ↓
6. Call AI provider (2-5s)
   ↓
7. Execute tools if needed (500ms-2s)
   ↓
8. Send response via WhatsApp API (300ms)
   ↓
9. Log completion
```

**Key Insight**: Steps 1-3 are synchronous, steps 4-9 are asynchronous

## Implementation Pattern

### Basic Structure

```typescript
// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  const signature = req.headers.get('x-hub-signature-256');
  const body = await req.text();

  // Step 1: Validate signature (MUST be fast)
  if (!validateSignature(body, signature)) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Step 2: Parse webhook data
  const webhook = JSON.parse(body);

  // Step 3: Return 200 IMMEDIATELY (fire-and-forget)
  // Use Promise without await - runs in background
  processWebhookAsync(webhook).catch((error) => {
    console.error('Background processing failed:', error);
    // Log to error tracking (Sentry, etc.)
  });

  return new Response('OK', { status: 200 });
}
```

### Background Processing

```typescript
async function processWebhookAsync(webhook: WhatsAppWebhook) {
  try {
    // Extract message data
    const message = extractMessage(webhook);
    if (!message) return; // Status updates, etc.

    // Load user context
    const user = await getOrCreateUser(message.from);
    const context = await getConversationContext(user.id, limit: 10);

    // Update 24h window
    await updateMessagingWindow(user.id);

    // Process with AI
    const aiResponse = await processWithAI(message.text, context);

    // Execute tools if AI requested them
    if (aiResponse.tool_calls) {
      await executeTools(aiResponse.tool_calls, user.id);
    }

    // Send response
    await sendWhatsAppMessage(user.phone, aiResponse.content);

    // Log success
    await logMessageSuccess(message.id);

  } catch (error) {
    // Log failure for retry
    await logMessageFailure(message.id, error);

    // Send user-friendly error message
    await sendWhatsAppMessage(
      message.from,
      "Lo siento, tuve un problema. ¿Puedes intentar de nuevo?"
    );
  }
}
```

## Signature Validation

**Critical**: Validate BEFORE returning 200, but keep it fast

```typescript
import crypto from 'crypto';

function validateSignature(body: string, signature: string | null): boolean {
  if (!signature) return false;

  const APP_SECRET = process.env.WHATSAPP_APP_SECRET!;

  // Signature format: "sha256=<hash>"
  const signatureHash = signature.split('sha256=')[1];

  // Calculate expected hash
  const expectedHash = crypto
    .createHmac('sha256', APP_SECRET)
    .update(body)
    .digest('hex');

  // Constant-time comparison (prevents timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signatureHash),
    Buffer.from(expectedHash)
  );
}
```

**Performance**: ~100ms (acceptable within 5s window)

## Error Handling

### Idempotency Protection

**Problem**: Even with fire-and-forget, duplicate webhooks can arrive

**Solution**: Track processed message IDs

```typescript
async function processWebhookAsync(webhook: WhatsAppWebhook) {
  const messageId = webhook.entry[0].changes[0].value.messages[0].id;

  // Check if already processed
  const alreadyProcessed = await checkProcessed(messageId);
  if (alreadyProcessed) {
    console.log('Duplicate webhook, ignoring:', messageId);
    return;
  }

  // Mark as processing (optimistic lock)
  await markAsProcessing(messageId);

  try {
    // ... actual processing ...
    await markAsCompleted(messageId);
  } catch (error) {
    await markAsFailed(messageId, error);
  }
}
```

### Retry Logic

**Pattern**: Exponential backoff for failed messages

```typescript
async function retryFailedMessage(messageId: string, attempt: number = 1) {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = 1000 * Math.pow(2, attempt); // 2s, 4s, 8s

  if (attempt > MAX_ATTEMPTS) {
    await logPermanentFailure(messageId);
    return;
  }

  await sleep(BACKOFF_MS);

  try {
    await processMessage(messageId);
  } catch (error) {
    await retryFailedMessage(messageId, attempt + 1);
  }
}
```

## Performance Metrics

### Target Latency

| Stage | Target | Measured |
|-------|--------|----------|
| Signature validation | <200ms | ~100ms |
| Webhook response | <500ms | ~350ms |
| Background processing | <8s | 3-7s (p95) |
| Total user experience | <8s | 4-8s |

### Monitoring

```typescript
// Log webhook processing times
async function processWebhookAsync(webhook: WhatsAppWebhook) {
  const startTime = Date.now();

  try {
    // ... processing ...

    const duration = Date.now() - startTime;
    await logMetric('webhook.processing.duration', duration);

    if (duration > 10000) {
      // Alert if processing takes >10s
      await alertSlowProcessing(webhook.id, duration);
    }
  } catch (error) {
    // ...
  }
}
```

## Edge Cases

### User Sends Multiple Messages Rapidly

**Problem**: User sends 5 messages in 2 seconds

**Solution**: Queue messages, process sequentially per user

```typescript
// Use in-memory queue (or Redis for multi-instance)
const userQueues = new Map<string, Promise<void>>();

async function processWebhookAsync(webhook: WhatsAppWebhook) {
  const userId = webhook.entry[0].changes[0].value.contacts[0].wa_id;

  // Get or create queue for this user
  const previousPromise = userQueues.get(userId) || Promise.resolve();

  // Chain this message after previous one
  const currentPromise = previousPromise
    .then(() => actuallyProcessMessage(webhook))
    .catch((error) => console.error('Processing failed:', error));

  userQueues.set(userId, currentPromise);

  // Clean up completed promises
  currentPromise.finally(() => {
    if (userQueues.get(userId) === currentPromise) {
      userQueues.delete(userId);
    }
  });
}
```

### Webhook Received After 24h Window Expired

**Problem**: Cannot send response if window expired

**Solution**: Track window, send template if needed

```typescript
async function processWebhookAsync(webhook: WhatsAppWebhook) {
  const user = await getOrCreateUser(message.from);

  // Check if window is open
  const windowOpen = user.window_expires_at > new Date();

  if (!windowOpen) {
    // Send template to re-open window
    await sendTemplateMessage(user.phone, 'window_reopen', {
      name: user.name
    });

    // Queue the actual response for after user responds
    await queueMessage(user.id, aiResponse.content);
    return;
  }

  // Normal processing...
}
```

## Vercel Edge Function Constraints

**Important**: Edge Functions have limitations

| Constraint | Impact | Workaround |
|------------|--------|-----------|
| No Node.js APIs | Cannot use `child_process`, `fs` | Use Web APIs, fetch for external calls |
| 1MB response limit | Cannot return large payloads | Always return small JSON (fire-and-forget already does this) |
| 30s max execution | Background processing must complete | Use Vercel Serverless Functions for long tasks |

**Recommendation**: Keep webhook handler in Edge Functions (fast), move AI processing to Serverless if needed

## Testing Strategy

### Unit Tests

```typescript
describe('Fire-and-Forget Webhook', () => {
  it('returns 200 within 500ms', async () => {
    const startTime = Date.now();
    const response = await POST(mockWebhookRequest);
    const duration = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(duration).toBeLessThan(500);
  });

  it('validates signature correctly', () => {
    const validSignature = generateSignature(mockBody);
    expect(validateSignature(mockBody, validSignature)).toBe(true);

    const invalidSignature = 'sha256=invalid';
    expect(validateSignature(mockBody, invalidSignature)).toBe(false);
  });

  it('processes message in background', async () => {
    const spy = jest.spyOn(processWebhookAsync);
    await POST(mockWebhookRequest);

    expect(spy).toHaveBeenCalledTimes(1);
    // Note: Don't await background processing in webhook handler
  });
});
```

### Integration Tests

```bash
# Manual test with curl
curl -X POST https://yourdomain.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$(echo -n '{"test":"data"}' | openssl dgst -sha256 -hmac "$APP_SECRET" | cut -d' ' -f2)" \
  -d '{"test":"data"}'

# Should return 200 immediately
# Check logs for background processing
```

## Sources

**C1**: Archived migue.ai code - `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/app/api/whatsapp/webhook/route.ts` L15-L45
**C2**: molbot project - `/Users/mercadeo/neero/molbot/src/webhooks/whatsapp-handler.ts` L80-L120
**C3**: WhatsApp Cloud API Docs - "Webhooks" section on timeout requirements
**C4**: Vercel Edge Functions Docs - Constraints and best practices

## Related Patterns

- **24h Window Management** - Tracks when messages can be sent
- **Message Queue Pattern** - Handles retry logic for failed messages
- **Idempotency Keys** - Prevents duplicate processing

---

**Status**: Production-proven (used in archived migue.ai + molbot)
**Complexity**: Medium
**Performance Impact**: High positive (prevents retry storms, improves UX)
