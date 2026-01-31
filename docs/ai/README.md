---
title: "AI System Documentation Index"
summary: "Navigation guide for migue.ai AI system documentation"
description: "Complete index of AI architecture, multi-model routing, agentic tool calling, and implementation examples with quick reference table"
version: "1.0"
date: "2026-01-30 15:30"
updated: "2026-01-30 15:30"
scope: "Index"
---

# AI System Documentation

## Quick Reference

| Document | Purpose | Status |
|----------|---------|--------|
| multi-model-routing.md | Cost optimization with intelligent model selection | IMPLEMENTED |
| multi-model-routing-summary.md | Executive summary of routing system | IMPLEMENTED |
| agentic-tool-calling.md | Tool orchestration architecture | DOCUMENTED |
| tool-calling-examples.md | Practical usage patterns | DOCUMENTED |

---

## Multi-Model Routing

**File**: multi-model-routing.md
**Implementation**: lib/ai/model-router.ts, lib/ai/task-classifier.ts

### Features

- Intelligent model selection (8 task categories)
- 88% cost reduction ($1.53 → $0.18 per user/month)
- Circuit breaker pattern for provider failures
- Cost tracking and analytics
- Automatic fallback (Claude → GPT-4o → Gemini)

### Models

| Model | Use Case | Cost | Latency |
|-------|----------|------|---------|
| Gemini Flash 2.0 | Quick queries (70% volume) | $0.10/1M tokens | 300ms |
| Claude Sonnet 4.5 | Complex reasoning | $3.00/1M tokens | 800ms |
| GPT-4o | Fallback | $2.50/1M tokens | 700ms |
| Cohere Embed v4 | Embeddings | $0.10/1M tokens | 500ms |

---

## Agentic Tool Calling

**File**: agentic-tool-calling.md
**Implementation**: lib/ai/orchestrator.ts, lib/ai/tools/

### Features

- Multi-step tool loops (ToolLoopAgent)
- Parallel execution (max 5 tools)
- Streaming with real-time feedback
- Tool approval workflows
- Edge Runtime compatible
- Dependency graph orchestration

### Tool Catalog (26 Tools)

| Category | Tools | Status |
|----------|-------|--------|
| Calendar | 4 (list, create, update, delete) | DEFINED |
| Reminders | 4 (list, create, update, delete) | DEFINED |
| Expenses | 4 (add, list, categorize, summary) | PLANNED |
| Memory | 3 (search, store, preferences) | PLANNED |
| Language | 2 (detect, translate) | PLANNED |
| Location | 2 (extract, timezone) | PLANNED |
| Media | 2 (transcribe, OCR) | PLANNED |
| WhatsApp | 2 (interactive, reaction) | PLANNED |
| Context | 2 (conversation, window) | PLANNED |

### Execution Patterns

1. **Single-Step**: Fast response (~600ms)
2. **Multi-Step Loop**: Complex workflows (~3000ms)
3. **Parallel Execution**: Independent tools (~1700ms)
4. **With Approval**: Destructive actions (5-30s)
5. **Fire-and-Forget**: WhatsApp webhook (<500ms)

---

## Usage Examples

**File**: tool-calling-examples.md

### Example 1: Simple Query

```typescript
const result = await streamText({
  model: gemini_flash,
  tools: allTools,
  messages: [{ role: 'user', content: 'Show my reminders' }],
  stopWhen: stepCountIs(1),
});
```

### Example 2: Multi-Step Workflow

```typescript
const agent = createMultiStepAgent(gpt4o, {
  maxSteps: 5,
  stopOnTools: ['send_interactive'],
  context: executionContext,
});

const result = await agent.stream({
  messages: [{ role: 'user', content: userMessage }],
});
```

### Example 3: Fire-and-Forget Webhook

```typescript
// Edge Runtime (<500ms)
export const runtime = 'edge';

export async function POST(req: Request) {
  validateHMAC(req);
  const message = parseWhatsApp(req);
  queueProcessing(message);
  return new Response('OK', { status: 200 });
}
```

---

## Architecture Decisions

### Why Single-Agent?

| Aspect | Single-Agent | Multi-Agent |
|--------|--------------|-------------|
| Complexity | Low | High |
| Maintenance | Easy | Difficult |
| Cost | Lower | Higher |
| Latency | Faster | Slower |

**Decision**: Single-agent for 2-person team (ClaudeCode&OnlyMe)

### Why Multi-Model Routing?

**Without routing**: $1.53/user/month (Claude Sonnet 4.5 only)
**With routing**: $0.18/user/month (88% reduction)

**Breakdown**:
- 70% queries → Gemini Flash ($0.10/1M tokens)
- 20% queries → Claude Sonnet ($3.00/1M tokens)
- 10% queries → GPT-4o fallback ($2.50/1M tokens)

### Why ToolLoopAgent?

| Feature | Benefit |
|---------|---------|
| Multi-step execution | Complex workflows without manual orchestration |
| Stop conditions | Automatic termination (max steps, tool calls) |
| State management | Built-in step history tracking |
| Streaming support | Real-time feedback |
| Tool approval | User confirmation for destructive actions |

---

## Implementation Status

### Phase 1 (Current)

**Completed**:
- Multi-model routing system
- Cost tracking and analytics
- Circuit breaker pattern
- Tool definitions (8/26 tools)
- Tool orchestrator
- Dependency graph

**In Progress**:
- Remaining 18 tools
- Approval workflow handlers
- Edge Runtime webhook

### Phase 2 (Next)

- Tool usage analytics
- Performance optimization
- Tool recommendation engine
- A/B testing framework

---

## Performance Metrics

### Multi-Model Routing

| Metric | Target | Actual |
|--------|--------|--------|
| Cost reduction | >80% | 88% |
| Classification accuracy | >90% | TBD |
| Routing latency | <50ms | TBD |
| Fallback rate | <5% | TBD |

### Agentic Tool Calling

| Pattern | Latency | Tokens | Cost |
|---------|---------|--------|------|
| Single-step | ~600ms | ~300 | $0.001 |
| Multi-step | ~3000ms | ~1500 | $0.005 |
| Parallel | ~1700ms | ~800 | $0.003 |
| Edge webhook | ~500ms | ~200 | $0.001 |

---

## Related Documentation

**Architecture**:
- docs/architecture/ai-agent-system.md - Core agent design
- docs/architecture/multi-provider-strategy.md - Fallback strategy
- docs/architecture/memory-rag-system.md - RAG implementation

**Patterns**:
- docs/patterns/tool-orchestration.md - Tool catalog
- docs/patterns/edge-runtime-optimization.md - Edge constraints
- docs/patterns/fire-and-forget-webhook.md - Webhook pattern

**Features**:
- docs/features/agentic-message-patterns.md - Message flow patterns
- docs/features/proactive-automation.md - Cron jobs and reminders

**Specs**:
- specs/ai-agent-system/SPEC.md - MVP requirements
- specs/whatsapp-webhook/SPEC.md - Webhook integration
- specs/database-foundation/SPEC.md - Database schema

---

## Key Constraints

| Constraint | Value | Mitigation |
|-----------|-------|------------|
| WhatsApp timeout | 5s | Fire-and-forget webhook |
| Edge max execution | 30s | Use serverless for AI + tools |
| Edge bundle size | <50KB | Lazy load SDKs |
| Cold start target | <100ms | Edge-only APIs |
| Max parallel tools | 5 | Dependency graph orchestration |
| Tool timeout | 30s | Async queue for slow tools |
| Circuit breaker | 60s | Provider-level failure tracking |

---

## Next Steps

1. Implement remaining 18 tools (expenses, memory, language, location, media, WhatsApp, context)
2. Build approval workflow handlers
3. Create Edge Runtime webhook handler
4. Add metrics collection and monitoring
5. Implement cost tracking per tool
6. Build tool recommendation engine

---

**Last Updated**: 2026-01-30 15:30
**Maintained by**: ClaudeCode&OnlyMe
