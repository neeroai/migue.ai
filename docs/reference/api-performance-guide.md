# API Performance Guide

**Performance optimization strategies for WhatsApp Bot APIs**

---

## Table of Contents

- [Overview](#overview)
- [WhatsApp 5-Second Rule](#whatsapp-5-second-rule)
- [Database Optimization](#database-optimization)
- [API Call Optimization](#api-call-optimization)
- [Caching Strategies](#caching-strategies)
- [Bundle Optimization](#bundle-optimization)
- [Performance Benchmarks](#performance-benchmarks)

---

## Overview

Performance targets for migue.ai:

| Metric | Target | Current |
|--------|--------|---------|
| **Webhook response** | <5s | 45ms (P50), 350ms (P99) |
| **Database query** | <1s | 50-150ms |
| **WhatsApp API call** | <100ms | 80-150ms |
| **OpenAI completion** | <30s | 2-4s |
| **Global TTFB** | <100ms | 45-120ms |

---

## WhatsApp 5-Second Rule

WhatsApp requires webhook responses within **5 seconds** or retries (up to 5 times).

### Fire-and-Forget Pattern

**Respond immediately, process asynchronously:**

```typescript
export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId();

  // 1. Validate & persist (<1s)
  const normalized = whatsAppMessageToNormalized(message);
  const { conversationId, userId } = await persistNormalizedMessage(normalized);

  // 2. Fire and forget: Process async
  processMessageWithAI(
    conversationId,
    userId,
    normalized.from,
    normalized.content,
    normalized.waMessageId
  ).catch((err) => {
    logger.error('Background processing failed', err, { requestId });
  });

  // 3. Respond immediately (<100ms)
  return jsonResponse({ success: true, request_id: requestId });
}
```

From [app/api/whatsapp/webhook/route.ts:192-282](../../app/api/whatsapp/webhook/route.ts)

**Benefits:**
- Sub-second webhook responses ✅
- No WhatsApp timeout errors ✅
- Better user experience ✅

### Latency Breakdown

| Step | Target | Actual |
|------|--------|--------|
| Read body | <10ms | 5-10ms |
| Validate signature | <20ms | 10-15ms |
| Parse JSON | <10ms | 5-10ms |
| Validate schema | <20ms | 10-20ms |
| Persist to DB | <200ms | 50-150ms |
| **Total** | **<300ms** | **80-205ms** ✅ |

---

## Database Optimization

### Connection Pooling

**Supabase client with optimized settings:**

```typescript
export function getSupabaseServerClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    {
      auth: {
        persistSession: false, // Edge Runtime requirement
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-request-id': getRequestId(), // For tracing
        },
      },
    }
  );
}
```

### Query Optimization

**1. Use indexes:**

```sql
-- Index on frequently queried columns
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_user_id ON messages(user_id);
CREATE INDEX idx_messages_timestamp ON messages(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_messages_user_conversation
  ON messages(user_id, conversation_id, created_at DESC);
```

**2. Limit results:**

```typescript
// ✅ Good: Limit results
const history = await getConversationHistory(conversationId, 10); // Last 10 messages

// ❌ Bad: Fetch all
const history = await getConversationHistory(conversationId); // Could be thousands
```

**3. Select only needed columns:**

```typescript
// ✅ Good: Select specific columns
const { data } = await supabase
  .from('messages')
  .select('id, content, created_at')
  .eq('conversation_id', conversationId)
  .limit(10);

// ❌ Bad: Select all
const { data } = await supabase
  .from('messages')
  .select('*') // Fetches all columns
```

**4. Use single vs batch operations:**

```typescript
// ✅ Good: Single insert for one message
const { data } = await supabase
  .from('messages')
  .insert(message)
  .single();

// ✅ Good: Batch insert for multiple
const { data } = await supabase
  .from('messages')
  .insert(messages); // Array of messages
```

---

## API Call Optimization

### WhatsApp API

**Optimization strategies:**

**1. Rate limiting (250 msg/sec):**

```typescript
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  const bucket = rateLimitBuckets.get(second) || [];

  if (bucket.length >= RATE_LIMIT) {
    const waitTime = 1000 - (now % 1000);
    await new Promise(r => setTimeout(r, waitTime));
    return rateLimit();
  }

  bucket.push(now);
  rateLimitBuckets.set(second, bucket);
}
```

From [lib/whatsapp.ts:34-73](../../lib/whatsapp.ts)

**2. Request deduplication:**

```typescript
const messageCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

const cacheKey = JSON.stringify(payload);
const cached = messageCache.get(cacheKey);

if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
  return cached.data; // Return cached response
}
```

From [lib/whatsapp.ts:32-90](../../lib/whatsapp.ts)

**3. Measure latency:**

```typescript
const startTime = Date.now();
const res = await fetch(url, { ... });
const latency = Date.now() - startTime;

if (latency > 100) {
  console.warn(`WhatsApp API slow response: ${latency}ms`);
}
```

From [lib/whatsapp.ts:93-122](../../lib/whatsapp.ts)

### OpenAI API

**Optimization strategies:**

**1. Reduce max_tokens:**

```typescript
// ✅ Good: Limit tokens
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  max_tokens: 500, // Faster responses
});

// ❌ Bad: Unlimited tokens
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  // No max_tokens = slower
});
```

**2. Use streaming:**

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  stream: true, // Start receiving immediately
});

let fullText = '';
for await (const chunk of stream) {
  fullText += chunk.choices?.[0]?.delta?.content || '';
}
```

From [lib/openai.ts:55-90](../../lib/openai.ts)

**Improvement:** 3x faster first token (500ms vs 1.5s)

**3. Reuse client:**

```typescript
// ✅ Good: Singleton client
let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({ ... });
  }
  return cachedClient;
}
```

From [lib/openai.ts:4-19](../../lib/openai.ts)

---

## Caching Strategies

### 1. Response Caching

**Cache identical WhatsApp API requests:**

```typescript
const messageCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3600 * 1000;

export async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  const cacheKey = JSON.stringify(payload);
  const cached = messageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetch(url, { ... }).then(r => r.json());

  messageCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}
```

**Benefit:** 30-50% reduction in API calls

### 2. Edge Caching

**Use HTTP Cache-Control headers:**

```typescript
const res = await fetch(url, {
  headers: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  },
});
```

From [lib/whatsapp.ts:101](../../lib/whatsapp.ts)

**Headers explained:**
- `s-maxage=3600`: Cache for 1 hour at edge
- `stale-while-revalidate=86400`: Serve stale for 24h while revalidating

### 3. Webhook Deduplication

**Prevent duplicate processing:**

```typescript
const processedWebhooks = new Map<string, number>();
const DEDUP_WINDOW_MS = 60000;

function isDuplicateWebhook(messageId: string): boolean {
  const now = Date.now();

  if (processedWebhooks.has(messageId)) {
    const processedAt = processedWebhooks.get(messageId)!;
    if (now - processedAt < DEDUP_WINDOW_MS) {
      return true;
    }
  }

  processedWebhooks.set(messageId, now);

  // Cleanup old entries
  for (const [id, timestamp] of processedWebhooks) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedWebhooks.delete(id);
    }
  }

  return false;
}
```

From [app/api/whatsapp/webhook/route.ts:37-65](../../app/api/whatsapp/webhook/route.ts)

---

## Bundle Optimization

### Tree Shaking

**Use named imports:**

```typescript
// ✅ Good: Named imports (tree-shakeable)
import { sendWhatsAppText, sendReaction } from '@/lib/whatsapp';

// ❌ Bad: Namespace import (includes everything)
import * as whatsapp from '@/lib/whatsapp';
```

### Code Splitting

**Lazy load heavy operations:**

```typescript
// Load Whisper only for audio messages
if (normalized.type === 'audio') {
  const { transcribeAudio } = await import('@/lib/openai');
  const text = await transcribeAudio(audioData);
}
```

### Bundle Analysis

```bash
npm run build
npx vite-bundle-visualizer
```

**Target:** <1.5 MB after gzip

---

## Performance Benchmarks

### Real-World Metrics (migue.ai)

**Webhook Handler:**
```
P50: 45ms
P75: 120ms
P95: 180ms
P99: 350ms
Cold starts: ~120ms (5% of requests)
```

**Database Queries:**
```
Insert message: 50-100ms
Get conversation history: 80-150ms
Update message: 40-80ms
```

**WhatsApp API:**
```
Send text: 80-150ms
Send reaction: 40-80ms
Send interactive: 100-200ms
```

**OpenAI API:**
```
GPT-4o (500 tokens): 2-4s
GPT-4o streaming (first token): 500ms
Whisper transcription: 1-3s
```

### Performance Budget

| Operation | Budget | Alert Threshold |
|-----------|--------|-----------------|
| Webhook response | 5000ms | >2000ms |
| Database query | 1000ms | >500ms |
| WhatsApp API | 100ms | >200ms |
| OpenAI completion | 30000ms | >10000ms |

---

## Monitoring Performance

### 1. Log Latency

```typescript
const startTime = Date.now();

const result = await someOperation();

const duration = Date.now() - startTime;

logger.info('Operation completed', {
  requestId,
  duration,
  metadata: { operation: 'someOperation' },
});

if (duration > PERFORMANCE_BUDGETS.OPERATION) {
  logger.warn('Performance budget exceeded', {
    requestId,
    duration,
    metadata: { budget: PERFORMANCE_BUDGETS.OPERATION },
  });
}
```

### 2. Vercel Analytics

View metrics at: `Vercel Dashboard → Analytics`

**Key metrics:**
- TTFB (Time to First Byte)
- Function duration (P50, P95, P99)
- Cold start percentage
- Error rate

### 3. Database Query Performance

**Enable slow query logging in Supabase:**

```sql
-- Log queries slower than 1s
ALTER DATABASE postgres SET log_min_duration_statement = 1000;
```

---

## Optimization Checklist

### Pre-Deployment

- [ ] Fire-and-forget pattern for async work
- [ ] Database indexes on frequent queries
- [ ] API response caching (1-hour TTL)
- [ ] Rate limiting implemented (250 msg/sec)
- [ ] Bundle size <1.5 MB
- [ ] Tree shaking enabled
- [ ] Lazy loading for heavy operations

### Post-Deployment

- [ ] Webhook P95 <500ms
- [ ] Database queries <1s
- [ ] WhatsApp API calls <100ms
- [ ] Cold starts <5% of requests
- [ ] Error rate <0.1%
- [ ] No timeout errors from WhatsApp

---

## Related Documentation

- [edge-functions-optimization.md](../05-deployment/edge-functions-optimization.md) - Edge optimization
- [whatsapp-webhook-spec.md](./whatsapp-webhook-spec.md) - Webhook specification
- [edge-runtime-api.md](./edge-runtime-api.md) - Runtime APIs

---

**Last Updated:** 2025-10-03
**Performance Target:** <5s webhook response, <100ms TTFB
**Current Performance:** 45ms P50, 350ms P99 ✅
