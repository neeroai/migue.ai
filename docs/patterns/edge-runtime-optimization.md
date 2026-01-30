---
title: "Edge Runtime Optimization"
summary: "Cold start <100ms, bundle <50KB, streaming responses, Node.js API migration"
description: "Cold start optimization techniques, bundle size analysis, streaming patterns, background task candidates, token budget strategies, and Edge Runtime vs Node.js API comparison"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Patterns"
---

# Edge Runtime Optimization

## Cold Start Optimization Techniques

| Technique | Impact | Tradeoff | Implementation Effort | Priority |
|-----------|--------|----------|----------------------|----------|
| Lazy loading | -40ms | Complexity | Medium | P0 |
| Bundle splitting | -30ms | More files | Low | P0 |
| Remove unused deps | -20ms | Manual audit | High | P1 |
| Tree shaking | -15ms | Config tuning | Low | P1 |
| Edge-compatible APIs only | -25ms | Limited APIs | Medium | P0 |
| Minimize dynamic imports | -10ms | Static structure | Low | P2 |
| Precompiled templates | -15ms | Build time | Medium | P2 |

**Cold start budget**: <100ms (WhatsApp 5s timeout - 100ms margin)

**Optimization checklist**:
- ✅ Use Edge Runtime (not Node.js runtime)
- ✅ Keep bundle <50KB gzipped
- ✅ Lazy load AI SDKs
- ✅ Minimize middleware
- ✅ Avoid heavy dependencies (moment.js, lodash, etc.)
- ✅ Use native Web APIs (fetch, crypto, etc.)

**Edge Runtime config**:
```typescript
// app/api/whatsapp/webhook/route.ts
export const runtime = 'edge';
export const preferredRegion = 'iad1'; // Closest to WhatsApp servers

export async function POST(req: Request) {
  // Edge-optimized handler
}
```

---

## Bundle Size Analysis

| Dependency | Size | Alternative | Savings | Status |
|------------|------|-------------|---------|--------|
| moment.js | 67 KB | date-fns (11 KB) | -56 KB | Replace |
| lodash | 70 KB | Native ES6 | -70 KB | Remove |
| axios | 32 KB | Native fetch | -32 KB | Replace |
| uuid | 18 KB | crypto.randomUUID() | -18 KB | Replace |
| dotenv | 15 KB | process.env (Edge native) | -15 KB | Remove |
| bcrypt | N/A (Node-only) | @edge-runtime/crypto | - | Replace |
| prisma | N/A (Node-only) | @supabase/supabase-js | - | Already using |

**Bundle analyzer config**:
```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'moment': 'date-fns', // Smaller alternative
      };
    }
    return config;
  }
};
```

**Size targets**:
- Total bundle: <50 KB gzipped
- Single route: <20 KB gzipped
- SDK lazy load: <100 KB total (loaded on demand)

---

## Streaming Patterns

| Use Case | Chunk Size | Latency Reduction | Complexity | Example |
|----------|------------|-------------------|------------|---------|
| AI responses | 20-50 tokens | -2s TTFB | Medium | Chat completion streaming |
| Long lists | 10 items | -500ms TTFB | Low | Calendar events |
| File download | 64 KB | -1s TTFB | Low | Document generation |
| Database queries | 100 rows | -300ms TTFB | Low | Expense list |
| Webhook response | N/A | Immediate ACK | High | WhatsApp webhook |

**Streaming AI responses**:
```typescript
export async function POST(req: Request) {
  const { message, userId } = await req.json();

  // Create streaming response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream from OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: message }],
          stream: true
        });

        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(encoder.encode(`data: ${content}\n\n`));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

**Webhook fire-and-forget**:
```typescript
export async function POST(req: Request) {
  // 1. Immediately acknowledge (within 5s)
  const payload = await req.json();

  // Queue for background processing
  await queueWebhook(payload);

  // Return 200 immediately
  return new Response('OK', { status: 200 });
}

async function queueWebhook(payload: any) {
  // Process in background (Edge doesn't support waitUntil)
  // Use external queue (Supabase, Redis, etc.)
  await supabase.from('webhook_queue').insert({
    payload,
    status: 'pending',
    created_at: new Date()
  });
}
```

---

## Background Task Candidates

| Task | Criticality | Frequency | Execution Time | Strategy |
|------|-------------|-----------|----------------|----------|
| AI inference | High | Per message | 2-5s | Inline (streaming) |
| Webhook validation | Critical | Per webhook | 10ms | Inline |
| Message persistence | High | Per message | 50ms | Inline |
| RAG search | Medium | Per query | 300ms | Inline |
| Expense categorization | Low | Per expense | 500ms | Background |
| Daily summaries | Low | Daily | 30s | Cron job |
| Analytics aggregation | Low | Hourly | 60s | Cron job |
| Cache warming | Low | Periodic | 10s | Cron job |

**Background processing** (via Supabase queue):
```typescript
// 1. Queue task
async function queueTask(task: BackgroundTask) {
  await supabase.from('background_tasks').insert({
    type: task.type,
    payload: task.payload,
    status: 'pending',
    priority: task.priority || 5,
    scheduled_for: task.scheduledFor || new Date()
  });
}

// 2. Process queue (separate worker or cron)
export async function GET(req: Request) {
  // Auth check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch pending tasks
  const { data: tasks } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .order('priority', { ascending: false })
    .limit(10);

  // Process tasks
  for (const task of tasks) {
    try {
      await processTask(task);

      await supabase
        .from('background_tasks')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('id', task.id);
    } catch (error) {
      await supabase
        .from('background_tasks')
        .update({
          status: 'failed',
          error: error.message,
          retry_count: task.retry_count + 1
        })
        .eq('id', task.id);
    }
  }

  return Response.json({ processed: tasks.length });
}
```

---

## Token Budget Strategies

| Threshold | Action | Compression Ratio | Context Loss | Priority |
|-----------|--------|-------------------|--------------|----------|
| <50K tokens | No action | 1:1 | None | - |
| 50-80K tokens | Summarize old messages | 5:1 | Minimal | P2 |
| 80-100K tokens | Compress RAG results | 3:1 | Low | P1 |
| 100-120K tokens | Drop old context | N/A | Medium | P1 |
| >120K tokens | Switch to GPT-4o (128K) | - | None | P0 |
| >128K tokens | Hard limit, error | - | - | P0 |

**Token counting**:
```typescript
import { encode } from 'gpt-tokenizer';

function countTokens(text: string): number {
  return encode(text).length;
}

function estimateContextTokens(context: Context): number {
  let total = 0;

  // System prompt
  total += countTokens(SYSTEM_PROMPT);

  // Conversation history
  total += context.messages.reduce(
    (sum, msg) => sum + countTokens(msg.content),
    0
  );

  // RAG memories
  total += context.memories.reduce(
    (sum, mem) => sum + countTokens(mem.content),
    0
  );

  // User preferences
  total += countTokens(JSON.stringify(context.preferences));

  return total;
}
```

**Summarization strategy**:
```typescript
async function compressContext(context: Context): Promise<Context> {
  const tokenCount = estimateContextTokens(context);

  if (tokenCount < 50000) {
    return context; // No compression needed
  }

  // Summarize old messages (keep last 10)
  const recentMessages = context.messages.slice(-10);
  const oldMessages = context.messages.slice(0, -10);

  if (oldMessages.length > 0) {
    const summary = await summarizeMessages(oldMessages);
    return {
      ...context,
      messages: [
        { role: 'system', content: `Previous conversation summary: ${summary}` },
        ...recentMessages
      ]
    };
  }

  return context;
}
```

---

## Edge Runtime vs Node.js API Comparison

| Feature | Edge Runtime | Node.js Runtime | Recommendation |
|---------|-------------|-----------------|----------------|
| Cold start | 50-100ms | 200-500ms | Edge |
| Available APIs | Web APIs only | Full Node.js | Edge (sufficient) |
| File system | ❌ | ✅ | Use Storage API |
| Crypto | ✅ Web Crypto | ✅ Node crypto | Edge (use Web Crypto) |
| Streaming | ✅ | ✅ | Edge (better latency) |
| Database | ✅ HTTP clients | ✅ Any driver | Edge (use Supabase) |
| Max duration | 30s | 60s | Edge (WhatsApp <5s anyway) |
| Memory | 128 MB | 1024 MB | Edge (sufficient) |

**Node.js → Edge Migration**:
```typescript
// ❌ Node.js APIs (don't work in Edge)
import fs from 'fs';
import crypto from 'crypto';
const moment = require('moment');

// ✅ Edge-compatible alternatives
const file = await fetch(url).then(r => r.text());
const hash = await crypto.subtle.digest('SHA-256', data);
import { format } from 'date-fns';
```

---

## Lazy Loading Implementation

```typescript
// ❌ Eager loading (increases bundle size)
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ✅ Lazy loading (load on demand)
let openaiClient: any = null;
let anthropicClient: any = null;

async function getOpenAIClient() {
  if (!openaiClient) {
    const { OpenAI } = await import('openai');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

async function getAnthropicClient() {
  if (!anthropicClient) {
    const Anthropic = await import('@anthropic-ai/sdk');
    anthropicClient = new Anthropic.default({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropicClient;
}

// Usage
export async function POST(req: Request) {
  const client = await getOpenAIClient(); // Loads on first use
  const response = await client.chat.completions.create({...});
  return Response.json(response);
}
```

---

## Citations

- **WhatsApp expert output**: Webhook timeout constraints and Edge optimization
- **AI engineer output**: Edge Runtime patterns and cold start optimization
- **PRD Section 5.1**: Vercel Edge Functions deployment
- **docs-global/platforms/vercel/edge-functions-optimization.md**: Edge optimization guide

---

**Lines**: 218 | **Tokens**: ~654
