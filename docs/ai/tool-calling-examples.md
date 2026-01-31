---
title: "Tool Calling Examples - Practical Usage Patterns"
summary: "Real-world examples of agentic tool calling for common WhatsApp AI assistant scenarios"
description: "Practical implementation examples including simple queries, multi-step workflows, parallel execution, approval flows, error handling, and Edge Runtime optimization patterns"
version: "1.0"
date: "2026-01-30 15:30"
updated: "2026-01-30 15:30"
scope: "Examples"
---

# Tool Calling Examples

## Example 1: Simple Query (Single-Step)

**User**: "Show my reminders for today"

### Implementation

```typescript
import { streamText, stepCountIs } from 'ai';
import { gemini_flash } from '@/lib/ai/model-router';
import { allTools } from '@/lib/ai/tools';

export async function handleSimpleQuery(userMessage: string, userId: string) {
  const result = await streamText({
    model: gemini_flash,
    tools: allTools,
    messages: [
      { role: 'user', content: userMessage },
    ],
    stopWhen: stepCountIs(1),
    toolChoice: 'auto',
    system: `You are a helpful assistant. User ID: ${userId}`,
  });

  return result;
}
```

### Execution Flow

1. Model receives: "Show my reminders for today"
2. Tool call: list_reminders({ userId, status: 'pending' })
3. Response: "You have 3 reminders today: ..."

**Latency**: ~100ms (tool) + ~500ms (LLM) = ~600ms total

---

## Example 2: Multi-Step Workflow

**User**: "Schedule a meeting tomorrow at 2pm and remind me 1 hour before"

### Implementation

```typescript
import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai';
import { gpt4o } from '@/lib/ai/model-router';
import { createMultiStepAgent } from '@/lib/ai/orchestrator';

export async function handleComplexWorkflow(
  userMessage: string,
  context: ToolExecutionContext
) {
  const agent = createMultiStepAgent(gpt4o, {
    maxSteps: 5,
    stopOnTools: ['send_interactive'],
    context,
  });

  const result = await agent.stream({
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  return result;
}
```

### Execution Flow

1. **Step 1**: create_event({ title: "Meeting", datetime: "tomorrow 2pm" })
   - Result: event_id = "evt_123"

2. **Step 2**: create_reminder({ message: "Meeting in 1 hour", datetime: "tomorrow 1pm" })
   - Result: reminder_id = "rem_456"

3. **Step 3**: send_interactive({ type: 'confirmation', content: { event, reminder } })
   - Stop condition met (hasToolCall('send_interactive'))

**Latency**: ~300ms + ~150ms + ~500ms + ~2000ms (LLM x3) = ~3000ms total

---

## Example 3: Parallel Tool Execution

**User**: "Show my calendar and expenses for this week"

### Implementation

```typescript
import { streamText } from 'ai';
import { claude } from '@/lib/ai/model-router';
import { buildDependencyGraph, topologicalSort } from '@/lib/ai/orchestrator';

export async function handleParallelQuery(
  userMessage: string,
  context: ToolExecutionContext
) {
  const result = await streamText({
    model: claude,
    tools: allTools,
    messages: [
      { role: 'user', content: userMessage },
    ],
    maxSteps: 2,
  });

  return result;
}
```

### Execution Flow

**Wave 1 (Parallel)**:
- list_events({ dateRange: thisWeek, userId })
- list_expenses({ dateRange: thisWeek, userId })

**Wave 2**:
- Synthesize response with both results

**Latency**: max(200ms, 150ms) + ~1500ms (LLM) = ~1700ms total
**vs Sequential**: 200ms + 150ms + ~1500ms = ~1850ms (8% slower)

---

## Example 4: Tool Approval Workflow

**User**: "Delete all my reminders"

### Implementation

```typescript
import { streamText } from 'ai';
import { claude } from '@/lib/ai/model-router';

export async function handleWithApproval(
  userMessage: string,
  context: ToolExecutionContext
) {
  const result = await streamText({
    model: claude,
    tools: allTools,
    messages: [
      { role: 'user', content: userMessage },
    ],
    onToolCall: async (toolCall) => {
      if (toolCall.toolName === 'delete_reminder') {
        const approved = await requestUserApproval(
          `Delete reminder: ${toolCall.args.reminderId}?`,
          30000
        );

        if (!approved) {
          throw new Error('User denied approval');
        }
      }
    },
  });

  return result;
}

async function requestUserApproval(
  message: string,
  timeout: number
): Promise<boolean> {
  return new Promise((resolve) => {
    sendWhatsAppInteractive({
      type: 'button',
      body: message,
      buttons: [
        { id: 'approve', title: 'Approve' },
        { id: 'deny', title: 'Deny' },
      ],
    });

    const timeoutId = setTimeout(() => resolve(false), timeout);

    listenForResponse((response) => {
      clearTimeout(timeoutId);
      resolve(response === 'approve');
    });
  });
}
```

### Execution Flow

1. Model calls: delete_reminder({ reminderId: "rem_123" })
2. Approval request sent to user via WhatsApp
3. User responds: "Approve" within 30s
4. Tool executes
5. Confirmation sent

**Latency**: Variable (user approval time: 5-30s)

---

## Example 5: Error Handling & Retry

**User**: "Add $50 lunch expense"

### Implementation

```typescript
import { streamText } from 'ai';
import { claude } from '@/lib/ai/model-router';
import { CircuitBreaker } from '@/lib/ai/circuit-breaker';

const expenseBreaker = new CircuitBreaker({
  maxFailures: 3,
  resetTimeout: 60000,
});

export async function handleWithRetry(
  userMessage: string,
  context: ToolExecutionContext
) {
  const result = await streamText({
    model: claude,
    tools: {
      add_expense: {
        description: 'Add expense entry',
        parameters: addExpenseSchema,
        execute: async (params) => {
          return await expenseBreaker.execute(async () => {
            return await addExpenseWithRetry(params, {
              maxAttempts: 3,
              backoff: 'exponential',
            });
          });
        },
      },
    },
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  return result;
}

async function addExpenseWithRetry(
  params: ExpenseParams,
  config: RetryConfig
) {
  let attempt = 0;

  while (attempt < config.maxAttempts) {
    try {
      return await supabase.from('expenses').insert(params);
    } catch (error) {
      attempt++;

      if (attempt >= config.maxAttempts) throw error;

      const delay = config.backoff === 'exponential'
        ? Math.pow(2, attempt) * 1000
        : 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
```

### Execution Flow

1. **Attempt 1**: Database error (network timeout)
2. **Wait**: 1s
3. **Attempt 2**: Database error (network timeout)
4. **Wait**: 2s
5. **Attempt 3**: Success
6. Response sent

**Latency**: 200ms + 1000ms + 200ms + 2000ms + 200ms = ~3600ms

---

## Example 6: Edge Runtime Optimization

**WhatsApp Webhook**: Must respond <5s

### Implementation

```typescript
// app/api/whatsapp/webhook/route.ts
export const runtime = 'edge';

export async function POST(req: Request) {
  const startTime = Date.now();

  const signature = req.headers.get('x-hub-signature-256');
  if (!validateHMAC(signature, await req.text())) {
    return new Response('Unauthorized', { status: 401 });
  }

  const message = parseWhatsAppMessage(await req.json());

  queueProcessing(message);

  const latency = Date.now() - startTime;
  console.log(`Webhook latency: ${latency}ms`);

  return new Response('OK', { status: 200 });
}

// Serverless function (background)
async function queueProcessing(message: WhatsAppMessage) {
  const agent = createMultiStepAgent(claude, {
    maxSteps: 5,
    context: {
      userId: message.from,
      conversationId: message.conversationId,
      messageId: message.id,
      timestamp: new Date(),
      userTimezone: 'America/Bogota',
      userLanguage: 'es',
    },
  });

  const result = await agent.stream({
    messages: [
      { role: 'user', content: message.text },
    ],
  });

  await sendWhatsAppResponse(message.from, result.text);
}
```

### Execution Flow

**Edge Runtime** (<500ms):
1. Validate HMAC (50ms)
2. Parse message (10ms)
3. Queue processing (5ms)
4. Return 200 OK (5ms)

**Serverless** (async):
5. AI processing + tool execution (2-5s)
6. Send WhatsApp response (300ms)

**Total user-facing latency**: ~500ms (WhatsApp receives 200 OK)

---

## Example 7: Dynamic Tool Selection

**Context**: Adjust tools based on request complexity

### Implementation

```typescript
import { ToolLoopAgent } from 'ai';
import { claude } from '@/lib/ai/model-router';
import { getEdgeCompatibleTools, getServerlessOnlyTools } from '@/lib/ai/tools';

export async function handleWithDynamicTools(
  userMessage: string,
  context: ToolExecutionContext
) {
  const agent = new ToolLoopAgent({
    model: claude,
    tools: allTools,
    prepareCall: async (options) => {
      const hasMediaAttachment = options.messages.some(
        (m) => m.experimental_attachments?.length > 0
      );

      if (hasMediaAttachment) {
        return {
          activeTools: Object.keys(allTools),
          temperature: 0.3,
        };
      }

      return {
        activeTools: Object.keys(getEdgeCompatibleTools()),
        temperature: 0.5,
      };
    },
    stopWhen: stepCountIs(3),
  });

  const result = await agent.stream({
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  return result;
}
```

### Execution Flow

**Text-only message**:
- Active tools: 20 edge-compatible tools
- Excluded: transcribe_audio, extract_text_ocr

**Message with audio**:
- Active tools: All 26 tools
- Included: transcribe_audio

---

## Example 8: Streaming with Real-time Feedback

**User**: "Summarize my expenses this month"

### Implementation

```typescript
import { streamText } from 'ai';
import { claude } from '@/lib/ai/model-router';

export async function handleWithStreaming(
  userMessage: string,
  context: ToolExecutionContext
) {
  const stream = await streamText({
    model: claude,
    tools: allTools,
    messages: [
      { role: 'user', content: userMessage },
    ],
    onChunk: async (chunk) => {
      if (chunk.text) {
        await sendWhatsAppPartial(context.userId, chunk.text);
      }
    },
    onStepFinish: async (step) => {
      if (step.toolCalls) {
        const toolNames = step.toolCalls.map((tc) => tc.toolName).join(', ');
        await sendWhatsAppStatus(
          context.userId,
          `Executing: ${toolNames}...`
        );
      }
    },
  });

  return stream;
}
```

### User Experience

```
[10:00:00] User: Summarize my expenses this month
[10:00:01] Bot: Executing: list_expenses...
[10:00:02] Bot: This month you spent
[10:00:02] Bot: This month you spent $1,234
[10:00:03] Bot: This month you spent $1,234 across
[10:00:03] Bot: This month you spent $1,234 across 15 transactions
[10:00:04] Bot: This month you spent $1,234 across 15 transactions. Top categories: Food...
```

**Benefits**:
- Real-time progress updates
- Better perceived performance
- User engagement

---

## Performance Comparison

| Pattern | Latency | Tokens | Cost | Use Case |
|---------|---------|--------|------|----------|
| Single-step | ~600ms | ~300 | $0.001 | Simple queries |
| Multi-step | ~3000ms | ~1500 | $0.005 | Complex workflows |
| Parallel | ~1700ms | ~800 | $0.003 | Independent tools |
| With approval | 5-30s | ~500 | $0.002 | Destructive actions |
| With retry | ~3600ms | ~400 | $0.002 | Error handling |
| Edge-optimized | ~500ms | ~200 | $0.001 | WhatsApp webhook |
| Dynamic tools | Variable | Variable | Variable | Context-dependent |
| Streaming | ~4000ms | ~1000 | $0.004 | Long responses |

---

## Related Documentation

**Implementation**:
- docs/ai/agentic-tool-calling.md - Architecture
- lib/ai/orchestrator.ts - Orchestration logic
- lib/ai/tools/index.ts - Tool registry

**Patterns**:
- docs/patterns/tool-orchestration.md - Tool catalog
- docs/patterns/fire-and-forget-webhook.md - Webhook pattern
- docs/patterns/edge-runtime-optimization.md - Edge constraints
