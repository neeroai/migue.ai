# Edge Functions Error Handling

**Comprehensive error handling and resilience patterns for Vercel Edge Functions**

---

## Table of Contents

- [Overview](#overview)
- [Error Types](#error-types)
- [Error Handling Patterns](#error-handling-patterns)
- [Timeout Management](#timeout-management)
- [Retry Strategies](#retry-strategies)
- [Graceful Degradation](#graceful-degradation)
- [Error Logging](#error-logging)
- [Best Practices](#best-practices)

---

## Overview

Edge Functions have unique constraints that require robust error handling:

- **25-second timeout** (300s for streaming)
- **No persistent state** between invocations
- **Network errors** from third-party APIs
- **Streaming disconnections** from OpenAI/WhatsApp
- **Memory constraints** (128 MB limit)

This guide covers production-tested error handling patterns from migue.ai.

---

## Error Types

### 1. Network Errors

**Common causes:**
- WhatsApp API timeouts
- OpenAI API rate limits
- Supabase connection failures
- Media download failures

**Example:**
```typescript
try {
  const res = await fetch(url, { timeout: 10000 });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
} catch (error: any) {
  if (error.name === 'AbortError') {
    // Timeout error
    logger.error('Request timeout', error);
  } else if (error.code === 'ECONNRESET') {
    // Connection reset
    logger.error('Connection reset', error);
  } else {
    // Other network error
    logger.error('Network error', error);
  }
}
```

### 2. Validation Errors

**Common causes:**
- Invalid webhook payloads
- Malformed JSON
- Schema validation failures

**Example:**
```typescript
const validationResult = safeValidateWebhookPayload(jsonBody);

if (!validationResult.success) {
  logger.warn('[webhook] Validation failed', {
    requestId,
    metadata: { issues: validationResult.error.issues.slice(0, 3) },
  });

  return jsonResponse(
    {
      error: 'Invalid webhook payload',
      request_id: requestId,
      issues: validationResult.error.issues.slice(0, 3),
    },
    400
  );
}
```

From [app/api/whatsapp/webhook/route.ts:97-111](../../app/api/whatsapp/webhook/route.ts)

### 3. Application Errors

**Custom error class with context:**

```typescript
/**
 * Custom error class with additional context
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Usage
throw new AppError(
  'User not found',
  'USER_NOT_FOUND',
  404,
  { userId }
);
```

From [lib/logger.ts:21-31](../../lib/logger.ts)

### 4. Timeout Errors

**Edge Functions timeout after 25 seconds:**

```typescript
// Set request timeout shorter than Edge limit
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s

try {
  const res = await fetch(url, {
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return await res.json();
} catch (error: any) {
  if (error.name === 'AbortError') {
    throw new AppError('Request timeout', 'TIMEOUT', 408);
  }
  throw error;
}
```

---

## Error Handling Patterns

### 1. Try-Catch with Fallback

**Basic pattern for recoverable errors:**

```typescript
try {
  await markAsRead(messageId);
} catch (err: any) {
  // Non-critical: log but don't fail request
  logger.error('Mark as read error', err);
}
```

From [lib/ai-processing.ts:142-146](../../lib/ai-processing.ts)

**Benefits:**
- Graceful degradation
- Non-blocking errors
- Audit trail in logs

### 2. Fire-and-Forget Error Handling

**For async background tasks:**

```typescript
// Process with AI asynchronously (don't block webhook response)
processMessageWithAI(
  conversationId,
  userId,
  normalized.from,
  normalized.content,
  normalized.waMessageId
).catch((err) => {
  logger.error('Background AI processing failed', err, {
    requestId,
    conversationId,
    userId,
  });
});

// Return success immediately
return jsonResponse({ success: true, request_id: requestId });
```

From [app/api/whatsapp/webhook/route.ts:193-207](../../app/api/whatsapp/webhook/route.ts)

**Benefits:**
- Sub-second webhook responses
- Meets WhatsApp 5-second timeout
- Errors logged but don't block flow

### 3. Finally Block for Cleanup

**Always cleanup resources:**

```typescript
const typingManager = createTypingManager(userPhone, messageId);
const processingNotifier = createProcessingNotifier(conversationId, userPhone);

try {
  // Process message...
  await processMessageWithAI(/* ... */);
} catch (error: any) {
  logger.error('AI processing error', error);

  // Send error reaction
  try {
    await reactWithWarning(userPhone, messageId);
  } catch (err: any) {
    logger.error('Reaction error', err);
  }
} finally {
  // Always cleanup
  await typingManager.stop();
  processingNotifier.stop();
}
```

From [lib/ai-processing.ts:253-264](../../lib/ai-processing.ts)

**Benefits:**
- No resource leaks
- Guaranteed cleanup
- Prevents memory issues

### 4. Nested Try-Catch for Multiple Fallbacks

**Handle errors at multiple levels:**

```typescript
try {
  // Mark as read immediately
  try {
    await markAsRead(messageId);
  } catch (err: any) {
    logger.error('Mark as read error', err);
  }

  // Quick acknowledgment with thinking reaction
  try {
    await reactWithThinking(userPhone, messageId);
  } catch (err: any) {
    logger.error('Reaction error', err);
  }

  // Main processing
  const result = await processMessage(message);

} catch (error: any) {
  logger.error('Processing error', error);

  // Error reaction
  try {
    await reactWithWarning(userPhone, messageId);
  } catch (err: any) {
    logger.error('Reaction error', err);
  }
}
```

From [lib/ai-processing.ts:141-165](../../lib/ai-processing.ts)

**Benefits:**
- Multiple fallback levels
- Detailed error tracking
- Resilient to partial failures

---

## Timeout Management

### Edge Function Timeout Limits

| Type | Timeout | Use Case |
|------|---------|----------|
| Regular | 25s | Webhooks, API calls |
| Streaming | 300s (5 min) | AI streaming responses |

### Webhook Response Timeout (WhatsApp)

WhatsApp requires webhook responses within **5 seconds**:

```typescript
export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId();

  try {
    // Validate and persist (< 1s)
    const normalized = await validateAndPersist(req);

    // Fire and forget: Process async
    processMessageWithAI(/* ... */).catch((err) => {
      logger.error('Background processing failed', err);
    });

    // Respond within 5 seconds
    return jsonResponse({ success: true, request_id: requestId });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
}
```

From [app/api/whatsapp/webhook/route.ts:77-289](../../app/api/whatsapp/webhook/route.ts)

### Processing Timeout Notification

Inform users if processing takes >30 seconds:

```typescript
/**
 * Create processing notification manager
 * Sends "still processing" message after 30s delay
 */
function createProcessingNotifier(
  conversationId: string,
  userPhone: string
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const message = 'Sigo procesando tu solicitud, dame unos segundos…';

  return {
    start() {
      if (timer) return;
      timer = setTimeout(() => {
        (async () => {
          try {
            await sendTextAndPersist(conversationId, userPhone, message);
          } catch (err: any) {
            logger.error('Processing notice error', err);
          }
        })();
      }, 30000); // 30 seconds
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
```

From [lib/ai-processing.ts:88-119](../../lib/ai-processing.ts)

---

## Retry Strategies

### Exponential Backoff

Retry transient failures with increasing delays:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1} after ${delay}ms`, {
          metadata: { error: error.message },
        });
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}

// Usage
const result = await retryWithBackoff(
  () => fetch(url).then(r => r.json()),
  3, // Max 3 retries
  1000 // Start with 1s delay
);
```

**Backoff schedule:**
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay

### OpenAI Client Retries

The OpenAI SDK has built-in retry logic:

```typescript
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30s timeout
  maxRetries: 2, // Retry up to 2 times
});
```

From [lib/openai.ts:12-16](../../lib/openai.ts)

### WhatsApp API Retry (Rate Limiting)

Token bucket with automatic retry:

```typescript
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  // ... bucket management ...

  const bucket = rateLimitBuckets.get(second)!;

  // If limit exceeded, wait and retry
  if (bucket.length >= RATE_LIMIT) {
    const waitTime = 1000 - (now % 1000);
    await new Promise(r => setTimeout(r, waitTime));
    return rateLimit(); // Recursive retry
  }

  bucket.push(now);
}
```

From [lib/whatsapp.ts:51-73](../../lib/whatsapp.ts)

---

## Graceful Degradation

### Progressive Feature Fallbacks

**Degrade gracefully when features fail:**

```typescript
try {
  // Try interactive buttons first
  await sendInteractiveButtons(userPhone, message, buttons);
} catch (error: any) {
  logger.warn('Interactive buttons failed, falling back to text', {
    metadata: { error: error.message },
  });

  // Fallback to plain text
  await sendWhatsAppText(
    userPhone,
    message + '\n\n' + buttons.map(b => `- ${b.title}`).join('\n')
  );
}
```

### Partial Response on Error

**Return partial results instead of failing completely:**

```typescript
try {
  const result = await ingestWhatsAppDocument(mediaUrl, userId, content);
  const response = formatIngestionResponse(result);
  await sendTextAndPersist(conversationId, userPhone, response);
} catch (error: any) {
  logger.error('Document processing error', error);

  // Send user-friendly error message
  const errorMessage =
    error?.message?.includes('Unsupported document type')
      ? 'Lo siento, solo puedo procesar archivos PDF e imágenes.'
      : 'Tuve problemas al procesar el documento. ¿Puedes intentar enviarlo de nuevo?';

  try {
    await sendTextAndPersist(conversationId, userPhone, errorMessage);
  } catch (err: any) {
    logger.error('Error message send failed', err);
  }
}
```

From [lib/ai-processing.ts:370-396](../../lib/ai-processing.ts)

---

## Error Logging

### Structured Error Logging

**Use structured logs for better debugging:**

```typescript
/**
 * Log entry structure
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  conversationId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

// Log with context
logger.error('Background AI processing failed', err, {
  requestId,
  conversationId,
  userId,
});
```

From [lib/logger.ts:36-53](../../lib/logger.ts)

### Error Context Enrichment

**Add contextual information to errors:**

```typescript
try {
  await processDocument(mediaUrl);
} catch (error: any) {
  logger.error('Document processing error', error, {
    conversationId,
    userId,
    metadata: {
      mediaUrl: normalized.mediaUrl,
      documentType: normalized.type,
    },
  });
}
```

From [lib/ai-processing.ts:371-377](../../lib/ai-processing.ts)

### Log Level Management

**Control verbosity based on environment:**

```typescript
function log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
  const env = getEnv();

  // Skip debug logs in production unless LOG_LEVEL is debug
  if (level === 'debug' && env.LOG_LEVEL !== 'debug') {
    return;
  }

  // Skip info logs if LOG_LEVEL is warn or error
  if (level === 'info' && (env.LOG_LEVEL === 'warn' || env.LOG_LEVEL === 'error')) {
    return;
  }

  // Output as JSON for structured logging (Vercel Logs)
  console.log(JSON.stringify(entry));
}
```

From [lib/logger.ts:58-98](../../lib/logger.ts)

---

## Best Practices

### 1. Validate Early, Fail Fast

```typescript
// Validate inputs first
if (!messageId || !userPhone) {
  return jsonResponse({ error: 'Missing required fields' }, 400);
}

// Then validate signature
const signatureOk = await validateSignature(req, rawBody);
if (!signatureOk) {
  return jsonResponse({ error: 'Invalid signature' }, 401);
}

// Finally validate schema
const validationResult = safeValidateWebhookPayload(jsonBody);
if (!validationResult.success) {
  return jsonResponse({ error: 'Invalid payload' }, 400);
}
```

### 2. Use Specific Error Types

```typescript
// ❌ Bad: Generic error
throw new Error('Something went wrong');

// ✅ Good: Specific error with code
throw new AppError(
  'Failed to transcribe audio',
  'TRANSCRIPTION_FAILED',
  500,
  { mediaUrl, duration }
);
```

### 3. Never Swallow Errors

```typescript
// ❌ Bad: Silent failure
try {
  await markAsRead(messageId);
} catch {}

// ✅ Good: Log all errors
try {
  await markAsRead(messageId);
} catch (err: any) {
  logger.error('Mark as read error', err, { messageId });
}
```

### 4. Return User-Friendly Messages

```typescript
// ❌ Bad: Technical error to user
return jsonResponse({ error: error.stack }, 500);

// ✅ Good: User-friendly message, log technical details
logger.error('AI processing error', error, { conversationId });
return jsonResponse({ error: 'Processing failed, please try again' }, 500);
```

### 5. Monitor Error Rates

```typescript
// Track error metrics
let errorCount = 0;
const ERROR_THRESHOLD = 10;

if (errorCount++ > ERROR_THRESHOLD) {
  logger.error('High error rate detected', new Error('Error threshold exceeded'), {
    metadata: { errorCount, threshold: ERROR_THRESHOLD },
  });
  // Trigger alert via Vercel monitoring
}
```

---

## Common Error Scenarios

### 1. WhatsApp API Errors

| Status | Cause | Solution |
|--------|-------|----------|
| 400 | Invalid phone number | Validate phone format |
| 401 | Invalid token | Check WHATSAPP_TOKEN env |
| 403 | Rate limit exceeded | Implement token bucket |
| 404 | Message not found | Check message ID |
| 500 | WhatsApp server error | Retry with backoff |

**Handling:**
```typescript
const res = await fetch(url, { ... });

if (!res.ok) {
  const detail = await res.text().catch(() => '');
  console.error(`WhatsApp API error ${res.status}:`, detail);

  if (res.status === 429) {
    // Rate limit - wait and retry
    await new Promise(r => setTimeout(r, 5000));
    return sendWhatsAppRequest(payload); // Retry
  }

  throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
}
```

From [lib/whatsapp.ts:108-112](../../lib/whatsapp.ts)

### 2. OpenAI API Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Timeout | Slow response | Reduce max_tokens |
| Rate limit | Too many requests | Implement queuing |
| Invalid request | Bad parameters | Validate inputs |
| Content filter | Flagged content | Handle gracefully |

**Handling:**
```typescript
try {
  const response = await client.chat.completions.create({ ... });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response');
  }

  return choice.message.content;
} catch (error: any) {
  if (error.status === 429) {
    throw new AppError('OpenAI rate limit', 'RATE_LIMIT', 429);
  } else if (error.status === 400) {
    throw new AppError('Invalid OpenAI request', 'INVALID_REQUEST', 400);
  }
  throw error;
}
```

From [lib/openai.ts:39-52](../../lib/openai.ts)

### 3. Supabase Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Connection timeout | Slow query | Add indexes |
| RLS policy denied | Missing permissions | Update RLS |
| Unique constraint | Duplicate entry | Handle idempotency |

**Handling:**
```typescript
const { data, error } = await supabase
  .from('messages')
  .insert({ ... });

if (error) {
  if (error.code === '23505') {
    // Unique constraint violation (duplicate)
    logger.warn('Duplicate message ignored', { metadata: { error } });
    return null;
  }

  throw new AppError(
    'Database error',
    'DB_ERROR',
    500,
    { error: error.message }
  );
}
```

---

## Testing Error Handling

### Unit Tests

```typescript
// tests/unit/error-handling.test.ts
describe('Error Handling', () => {
  it('should handle WhatsApp API timeout', async () => {
    // Mock timeout
    fetchMock.mockReject(new Error('Timeout'));

    await expect(sendWhatsAppText('123', 'test'))
      .rejects.toThrow('Timeout');
  });

  it('should retry on transient errors', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const result = await retryWithBackoff(() => fetch(url));
    expect(result).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// tests/e2e/webhook-errors.test.ts
describe('Webhook Error Handling', () => {
  it('should return 401 on invalid signature', async () => {
    const response = await POST(
      new Request('https://test.com/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'X-Hub-Signature-256': 'sha256=invalid' },
        body: JSON.stringify({ entry: [] }),
      })
    );

    expect(response.status).toBe(401);
  });
});
```

---

## Related Documentation

- [edge-functions-optimization.md](./edge-functions-optimization.md) - Performance optimization
- [edge-security-guide.md](./edge-security-guide.md) - Security best practices
- [edge-observability.md](./edge-observability.md) - Monitoring and debugging

---

**Last Updated:** 2025-10-03
**Timeout Limit:** 25s (regular), 300s (streaming)
**Retry Strategy:** Exponential backoff with max 3 retries
**Error Budget:** <0.1% error rate (production target)
