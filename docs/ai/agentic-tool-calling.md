---
title: "Agentic Tool Calling Features - Vercel AI SDK 6.0.62"
summary: "Complete guide to multi-step tool execution, parallel calling, streaming, and approval workflows in Edge Runtime"
description: "Comprehensive documentation of Vercel AI SDK 6.0.62 agentic capabilities including ToolLoopAgent, multi-step execution patterns, parallel tool orchestration, streaming tool calls, approval workflows, and Edge Runtime compatibility constraints"
version: "1.0"
date: "2026-01-30 15:30"
updated: "2026-01-30 15:30"
scope: "Architecture"
---

# Agentic Tool Calling Features

## Executive Summary

| Capability | Support | Implementation |
|-----------|---------|----------------|
| Multi-step tool loops | YES | ToolLoopAgent with stopWhen conditions |
| Parallel tool execution | YES | Model-dependent (max 5 tools) |
| Streaming tool calls | YES | Real-time with onChunk callbacks |
| Tool approval workflow | YES | needsApproval flag + 60s timeout |
| Edge Runtime compatible | YES | <100ms cold start, <50KB bundle |
| State management | YES | Full step history tracking |

**Status**: 26 tools defined, 8 tools implemented (calendar, reminders)

---

## Multi-Step Execution Patterns

### Pattern 1: Single-Step (Fast Response)

```typescript
import { streamText, stepCountIs } from 'ai';
import { gemini_flash } from '@/lib/ai/model-router';
import { allTools } from '@/lib/ai/tools';

const result = await streamText({
  model: gemini_flash,
  tools: allTools,
  prompt: userMessage,
  stopWhen: stepCountIs(1),
  toolChoice: 'auto',
});
```

**Use case**: Simple queries requiring single tool call (<1s response)

**Example**: "Show my reminders" → list_reminders → response

---

### Pattern 2: Multi-Step Loop (Complex Task)

```typescript
import { ToolLoopAgent, stepCountIs, hasToolCall } from 'ai';
import { gpt4o } from '@/lib/ai/model-router';
import { allTools } from '@/lib/ai/tools';

const agent = new ToolLoopAgent({
  model: gpt4o,
  tools: allTools,
  stopWhen: [
    stepCountIs(5),
    hasToolCall('send_interactive'),
  ],
});

const result = await agent.stream({
  messages: conversation,
  onStepFinish: (step) => {
    console.log('Step completed:', step.toolCalls);
  },
});
```

**Use case**: Multi-step reasoning requiring multiple tool calls

**Example**: "Schedule meeting tomorrow at 2pm and remind me 1 hour before"
1. Step 1: create_event (calendar)
2. Step 2: create_reminder (1 hour before event)
3. Step 3: send_interactive (confirmation)

---

### Pattern 3: Streaming with Real-time Feedback

```typescript
import { streamText } from 'ai';

const stream = await streamText({
  model: claude,
  tools: allTools,
  prompt: userMessage,
  onChunk: (chunk) => {
    if (chunk.text) {
      sendPartialResponse(chunk.text);
    }
  },
  onStepFinish: (step) => {
    executeTools(step.toolCalls);
  },
});
```

**Use case**: Long responses requiring real-time UI updates

**Benefits**:
- Token-by-token streaming
- Tool input streaming (onInputDelta)
- Better UX for long operations

---

### Pattern 4: Fire-and-Forget Webhook

```typescript
// Edge Runtime (webhook handler)
export const runtime = 'edge';

export async function POST(req: Request) {
  const signature = validateHMAC(req);
  const message = parseWhatsApp(req);

  queueProcessing(message);
  return new Response('OK', { status: 200 });
}

// Serverless (background processing)
async function processMessage(message: Message) {
  const agent = createMultiStepAgent(claude, {
    maxSteps: 5,
    context: message.context,
  });

  const result = await agent.stream({ messages: [message] });
  await sendWhatsApp(result);
}
```

**Use case**: WhatsApp webhook (5s timeout constraint)

**Flow**:
1. Edge: Validate HMAC + parse message (<500ms)
2. Edge: Return 200 OK to WhatsApp
3. Serverless: AI processing + tool execution (async)
4. Serverless: Send WhatsApp response

---

## Tool Choice Strategies

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| 'auto' | Model decides when to call tools | Default agent behavior |
| 'required' | Must call at least one tool | Action-mandatory flows |
| 'none' | Never call tools | Reasoning-only steps |
| {toolName} | Force specific tool | Tool-forced loops |

```typescript
await streamText({
  model: claude,
  tools: allTools,
  toolChoice: 'required',
  prompt: 'Create a reminder for tomorrow at 9am',
});
```

---

## Parallel Tool Execution

### Max Parallel Tools: 5 concurrent

**Independent tools (can parallelize)**:
```typescript
const result = await agent.stream({
  messages: [
    { role: 'user', content: 'Show my calendar and reminders' },
  ],
});
```

**Execution**:
- Wave 1: list_events + list_reminders (parallel)
- Wave 2: Response synthesis

**Dependent tools (must sequence)**:
```typescript
const result = await agent.stream({
  messages: [
    { role: 'user', content: 'Show expense summary' },
  ],
});
```

**Execution**:
- Wave 1: list_expenses
- Wave 2: get_expense_summary (depends on list)
- Wave 3: Response synthesis

---

## Dependency Graph Orchestration

```typescript
import { buildDependencyGraph, topologicalSort } from '@/lib/ai/orchestrator';

const toolCalls = ['list_expenses', 'get_expense_summary', 'create_reminder'];
const graph = buildDependencyGraph(toolCalls);
const waves = topologicalSort(graph);

for (const wave of waves) {
  await Promise.all(wave.map((tool) => executeTool(tool)));
}
```

**Dependency rules**:
- get_expense_summary → list_expenses
- update_event → create_event
- get_timezone → extract_location
- detect_language → transcribe_audio

---

## Tool Approval Workflow

### Approval Matrix

| Tool | Auto-Confirm | User Confirm | Timeout |
|------|--------------|--------------|---------|
| create_event | Confidence >0.9, non-business hours | All other cases | 60s |
| delete_event | Never | Always | 60s |
| update_event | Minor changes (time <30min) | Major changes | 60s |
| create_reminder | Always | Never | - |
| add_expense | Amount <$50, category confident | Amount ≥$50 OR low confidence | 30s |
| delete_reminder | Never | Always | 30s |

### Implementation

```typescript
import { z } from 'zod';

const createEventSchema = z.object({
  title: z.string(),
  datetime: z.string().datetime(),
  amount: z.number().optional(),
});

export const calendarTools = {
  create_event: {
    description: 'Create calendar event',
    parameters: createEventSchema,
    needsApproval: (input: unknown) => {
      const parsed = createEventSchema.safeParse(input);
      if (!parsed.success) return true;

      const eventDate = new Date(parsed.data.datetime);
      const isBusinessHours =
        eventDate.getHours() >= 9 && eventDate.getHours() < 17;

      return isBusinessHours;
    },
    execute: async (params) => {
      // Implementation
    },
  },
};
```

---

## Dynamic Tool Selection

```typescript
const agent = new ToolLoopAgent({
  model: claude,
  tools: allTools,
  prepareCall: async (options) => {
    const complexity = analyzeRequest(options);

    return {
      activeTools: complexity > 5
        ? ['all_tools']
        : ['fast_tools'],
      temperature: complexity > 5 ? 0.5 : 0.3,
    };
  },
});
```

**Use case**: Conditionally enable/disable tools per step based on context

---

## Edge Runtime Constraints

### Compatible (Edge)

**Fast tools (<500ms)**:
- All Supabase reads (100-200ms)
- Calendar operations (200-300ms)
- Language detection (50ms)
- WhatsApp sends (200-300ms)
- Timezone lookups (150-200ms)
- Memory searches (300ms)

**Requirements**:
- Web APIs only (fetch, crypto.randomUUID)
- No Node.js APIs (fs, child_process)
- Lazy load AI SDKs (-40ms cold start)
- Bundle <50KB gzipped

---

### Incompatible (Serverless)

**Long-running tools (>3s)**:
- transcribe_audio (3000ms)
- extract_text_ocr (2000ms)
- store_memory with embeddings (2-5s)

**Requires Node.js APIs**:
- File system operations
- Native crypto (bcrypt)
- Child processes

---

## Retry & Error Handling

| Error Type | Max Attempts | Backoff | Circuit Breaker |
|------------|--------------|---------|-----------------|
| Network timeout | 3 | Exponential (1s, 2s, 4s) | 5 failures / 1min |
| Rate limit (429) | 5 | Linear (60s) | 10 failures / 5min |
| Server error (5xx) | 3 | Exponential (2s, 4s, 8s) | 3 failures / 1min |
| Invalid params (4xx) | 1 | None | - |
| Auth error | 2 | Immediate (refresh token) | 3 failures / 5min |
| Database error | 3 | Exponential (500ms, 1s, 2s) | 5 failures / 1min |

```typescript
import { CircuitBreaker } from '@/lib/ai/circuit-breaker';

const breaker = new CircuitBreaker({
  maxFailures: 5,
  resetTimeout: 60000,
});

await breaker.execute(async () => {
  return await executeToolWithRetry(toolName, params);
});
```

---

## Tool Catalog (26 Tools)

### Calendar Tools (4)
- list_events (200ms) - List calendar events
- create_event (300ms) - Create new event
- update_event (250ms) - Update existing event
- delete_event (200ms) - Delete event

### Reminder Tools (4)
- create_reminder (150ms) - Create reminder
- list_reminders (100ms) - List reminders
- update_reminder (150ms) - Update reminder
- delete_reminder (100ms) - Delete reminder

### Expense Tools (4)
- add_expense (200ms) - Add expense entry
- list_expenses (150ms) - List expenses
- categorize_expense (100ms) - AI categorization
- get_expense_summary (200ms) - Aggregate summary

### Memory Tools (3)
- search_memory (300ms) - pgvector RAG search
- store_memory (200ms) - Store with embeddings
- get_user_preferences (150ms) - User settings

### Language Tools (2)
- detect_language (50ms) - FastText detection
- translate_text (400ms) - Translation API

### Location Tools (2)
- extract_location (200ms) - NER + geocoding
- get_timezone (150ms) - Timezone lookup

### Media Tools (2)
- transcribe_audio (3000ms) - Whisper API
- extract_text_ocr (2000ms) - Tesseract OCR

### WhatsApp Tools (2)
- send_interactive (500ms) - Interactive messages
- send_reaction (200ms) - Message reactions

### Context Tools (2)
- get_conversation_context (200ms) - Chat history
- check_messaging_window (50ms) - 24h window status

---

## Implementation Status

**Phase 1 (Current)**:
- Tool definitions: 8/26 (calendar, reminders)
- Orchestrator: Implemented
- Dependency graph: Implemented
- Edge compatibility: Defined

**Phase 2 (Next)**:
- Implement remaining 18 tools
- Add approval workflow handlers
- Implement circuit breaker integration
- Add metrics collection

**Phase 3 (Future)**:
- Tool usage analytics
- Cost tracking per tool
- Performance optimization
- Tool recommendation engine

---

## Key Constraints

| Constraint | Value | Mitigation |
|-----------|-------|------------|
| WhatsApp timeout | 5s | Fire-and-forget webhook |
| Edge max execution | 30s | Use serverless for AI + tools |
| Edge bundle size | <50KB | Lazy load SDKs |
| Cold start target | <100ms | Edge-only APIs |
| Max parallel tools | 5 | Dependency graph |
| Tool timeout (individual) | 30s | Async queue |
| Tool timeout (global) | 60s | Circuit breaker |

---

## Related Documentation

**Implementation**:
- lib/ai/tools/index.ts - Tool registry
- lib/ai/orchestrator.ts - Orchestration logic
- lib/ai/circuit-breaker.ts - Error handling

**Architecture**:
- docs/architecture/ai-agent-system.md - Agent design
- docs/patterns/tool-orchestration.md - Tool catalog
- docs/patterns/edge-runtime-optimization.md - Edge constraints

**Specs**:
- specs/ai-agent-system/SPEC.md - MVP requirements
- specs/whatsapp-webhook/SPEC.md - Webhook integration
