---
title: "AI Processing Pipeline"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P0"
complexity: "high"
estimated_hours: 24
---

# AI Processing Pipeline

## What It Does

Multi-provider AI processing pipeline with intelligent model routing and AI Gateway fallback. Handles text, audio (via Whisper), image (via Tesseract OCR), and document messages. Primary model is OpenAI GPT-4o-mini via AI Gateway, falls back to Gemini 2.5 Flash Lite on failure or budget constraints.

**Sequential Flow**: markAsRead → typing indicator → AI processing → persist message → reaction

## Why It Exists

**Cost Optimization**: Low-cost primary with GPT-4o-mini ($0.15/$0.60 per 1M tokens) and cost-controlled fallback using Gemini 2.5 Flash Lite ($0.10/$0.40 per 1M tokens)

**Reliability**: Automatic fallback prevents complete service outages when primary provider fails

**Budget Control**: Pre-flight budget checks prevent exceeding $3/day system limit

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/ai-processing-v2.ts | 604 | Main orchestration (text/audio/image/document) |
| lib/ai/proactive-agent.ts | 574 | Vercel AI SDK agent with 3 tools |
| lib/ai/providers.ts | 39 | AI Gateway model catalog |
| lib/ai/gateway.ts | 92 | AI Gateway health utilities |
| lib/ai/model-router.ts | 158 | Intelligent model selection |
| lib/ai/fallback.ts | 163 | Provider chain with 20% buffer |

**Total**: 1,630 lines

### Key Exports

```typescript
// Main entry points
processMessageWithAI(conversationId, userPhone, messageText, isToolMessage)
processAudioMessage(conversationId, userPhone, audioUrl, mimeType)
processDocumentMessage(conversationId, userPhone, mediaUrl, mimeType, caption)

// Vercel AI SDK agent
createProactiveAgent()
respond(conversationId, userPhone, input, isToolMessage)

// Model routing
selectModel(messageText) // Returns 'openai/gpt-4o-mini'
executeWithFallback(primaryProvider, fallbackProvider, operation) // (deprecated when using AI Gateway fallback)

// Provider gateway
getModel(provider) // Lazy-init singleton
```

### External Dependencies

| Service | Cost | Purpose |
|---------|------|---------|
| OpenAI GPT-4o-mini | $0.15/$0.60 per 1M tokens | Primary AI provider |
| Gemini 2.5 Flash Lite | $0.10/$0.40 per 1M tokens | Fallback provider |
| OpenAI Whisper | $0.36/hour | Audio transcription |
| Tesseract OCR | Free | Image text extraction |
| Vercel AI SDK 6.0 | Free | Agent framework |

**Total Budget**: $90/month ($3/day system-wide)

### Agent Tools

**3 tools disponibles**:

1. **create_reminder** - Parse and schedule reminders
2. **create_meeting** - Schedule Google Calendar events
3. **track_expense** - Record expense in tracking system

### Critical Features

| Feature | Implementation |
|---------|----------------|
| Typing indicator | 10+ char threshold (markAsRead + react if <10 chars) |
| Lazy memory | Skip memory for tool messages (optimization) |
| Budget check | Pre-flight check before API call (20% buffer) |
| Fallback chain | OpenAI → Gemini (automatic on failure) |
| Error handling | 3 retries with exponential backoff |

## Test Coverage

| Test | File | Status |
|------|------|--------|
| Fallback loop prevention | tests/unit/fallback-loop-prevention.test.ts | PASS |
| OpenAI response handler | tests/unit/openai-response-handler.test.ts | PASS |

**Coverage**: PARTIAL (core logic tested, edge cases pending)

## Related ADRs

**ADR-003**: Parallelize WhatsApp API calls (markAsRead + reactions)
- Status: PROPOSED but not implemented (still sequential)

**ADR-004**: WhatsApp API v23 constraints (NO streaming, 5s timeout)
- Impact: Must buffer complete response before sending

## Known Issues

**None** - System stable in production

## Logs

**Latency**: 800-1200ms warm, 1350-3400ms cold (acceptable)

**Success Rate**: ~98% (failures mostly budget exhaustion)

**Cost Trend**: $2-3/day (within budget)

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P1 | Implement ADR-003 parallelization (markAsRead + reactions) | 2hr |
| P2 | Add integration tests for multi-provider fallback | 4hr |
| P3 | Optimize typing indicator logic (reduce WhatsApp API calls) | 3hr |

## Implementation Completeness

**Status**: COMPLETE

**Shipped**: 2026-02-01 (Vercel AI SDK 6.0 migration)

**Production**: Stable, 254 tests passing
