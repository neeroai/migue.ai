---
title: "molbot Analysis Summary"
summary: "Key findings from molbot codebase: agent system, memory, tools, deployment options"
description: "Analysis of molbot's architecture including 42 modules, agent system patterns, three-tier memory, 20+ tools, multi-channel support, and deployment strategies with relevance to migue.ai"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Research"
---

# molbot Analysis Summary

## Project Metrics

| Metric | Value | Relevance to migue.ai |
|--------|-------|----------------------|
| Total modules | 42 | Architecture reference |
| Agent modules | 6 | Multi-agent vs single-agent decision |
| Memory modules | 5 | Three-tier memory pattern |
| Tool modules | 8+ | Tool orchestration patterns |
| Channels supported | 3 (WhatsApp, Slack, Discord) | Multi-channel architecture |
| Lines of code | ~15,000 | Complexity benchmark |
| Database | PostgreSQL + pgvector | Same stack as migue.ai |
| AI providers | OpenAI, Anthropic, Groq | Multi-provider pattern |

---

## Agent Architecture Comparison

| Aspect | molbot Approach | migue.ai Adaptation | Rationale |
|--------|----------------|---------------------|-----------|
| Architecture | Multi-agent (6 specialized) | Single-agent | Simpler for 2-person team |
| Orchestration | Master agent coordinates | Centralized tool manager | Easier to maintain |
| Tool access | Distributed across agents | All tools in one agent | Better context sharing |
| Memory sharing | Shared memory service | Native agent memory | Less coordination overhead |
| Context management | Per-agent context | Global session context | Simpler state management |
| Scalability | High (parallel agents) | Medium (single agent) | Acceptable for initial scale |
| Complexity | High | Low | Matches team size |
| Cost | Higher (multiple calls) | Lower (single call) | Budget-friendly |

**Key insight**: molbot's multi-agent is powerful but complex. Single-agent better for migue.ai's 2-person team.

---

## Memory System Patterns

| Component | molbot Implementation | Storage | Performance | Cost |
|-----------|----------------------|---------|-------------|------|
| Short-term | Redis cache (30min TTL) | Redis | <10ms | Low |
| Long-term | PostgreSQL messages table | PostgreSQL | 50-100ms | Medium |
| Semantic | pgvector embeddings | PostgreSQL | 100-300ms | High |
| Preference extraction | NLP pipeline + rules | PostgreSQL | 200ms | Medium |
| Context assembly | Tiered lookup (Redis → PG → pgvector) | Hybrid | 150ms avg | Medium |

**Memory lifecycle** (molbot pattern):
1. Message received → Store in long-term (PostgreSQL)
2. Extract entities → Check for preferences
3. High-confidence preference → Generate embedding → Store in semantic memory
4. Active conversation → Cache in short-term (Redis)
5. RAG query → Search semantic memory (pgvector)
6. Response generation → Inject relevant memories into context

**Adaptation for migue.ai**:
- Same three-tier structure
- OpenAI text-embedding-3-small (cheaper than molbot's ada-002)
- Supabase native pgvector (no separate Redis initially)
- Preference patterns: Copy molbot's regex patterns

---

## Channel Features Catalog

| Feature | Implementation | Complexity | WhatsApp Availability |
|---------|---------------|------------|----------------------|
| Interactive buttons | Channel-specific adapters | Medium | ✅ (3 max) |
| Lists | Channel-specific adapters | Medium | ✅ (24 items max) |
| Rich media | Universal media handler | Low | ✅ (image, audio, video, document) |
| Reactions | Channel-specific | Low | ✅ (emoji reactions) |
| Threading | Channel-specific | High | ❌ (not in WhatsApp) |
| Voice transcription | Universal (Whisper) | Medium | ✅ (audio messages) |
| File upload | Universal handler | Low | ✅ (16 MB limit) |
| Typing indicators | Channel-specific | Low | ✅ (typing on/off) |
| Read receipts | Channel-specific | Low | ✅ (read status) |

**Multi-channel pattern** (not needed for migue.ai v1):
- molbot uses adapter pattern for each channel
- Unified message format internally
- Channel-specific rendering on output
- migue.ai: Skip multi-channel, focus on WhatsApp

---

## Tool System Taxonomy

| Category | Tools Count | Examples | Integration Pattern |
|----------|-------------|----------|---------------------|
| Calendar | 4 | create_event, list_events, update_event, delete_event | OAuth → Google Calendar API |
| Tasks | 5 | create_task, list_tasks, update_task, complete_task, delete_task | Internal database |
| Web search | 3 | google_search, scrape_url, summarize_page | External APIs |
| File operations | 4 | read_file, write_file, list_files, delete_file | File system (not applicable to Edge) |
| Communication | 3 | send_email, send_sms, make_call | Twilio, SendGrid |
| Database | 5 | query_db, insert_record, update_record, delete_record, run_sql | Direct DB access |
| Custom | Variable | User-defined tools | Plugin system |

**Tool orchestration lessons**:
- Parallel execution when independent (molbot does this well)
- Approval workflow for destructive actions (molbot pattern)
- Retry logic with exponential backoff (copy molbot's implementation)
- Circuit breakers per tool category (molbot uses this)

**migue.ai tool catalog** (prioritized):
- P0: Calendar (4), Reminders (4), Expenses (4), Memory (3)
- P1: Language (2), Location (2), Media (2)
- P2: WhatsApp interactive (2), Context (2)

---

## Deployment Options Matrix

| Platform | Complexity | Cost | Scalability | Maintenance | molbot Support |
|----------|------------|------|-------------|-------------|----------------|
| Vercel Edge | Low | Low | High | Low | ❌ (uses Node.js) |
| Vercel Serverless | Low | Medium | High | Low | ✅ |
| AWS Lambda | Medium | Medium | Very high | Medium | ✅ |
| Google Cloud Run | Medium | Low | High | Medium | ✅ |
| Self-hosted VPS | High | Low | Limited | High | ✅ |
| Docker + K8s | Very high | High | Very high | Very high | ✅ |

**molbot deployment**: Self-hosted Docker (complexity: high, requires DevOps)
**migue.ai choice**: Vercel Edge (complexity: low, matches 2-person team)

**Key difference**: molbot uses Node.js runtime (file system, full Node APIs), migue.ai uses Edge Runtime (Web APIs only, faster cold starts)

---

## Learnings Catalog

| Pattern | Worked Well | Challenges | migue.ai Application |
|---------|-------------|------------|---------------------|
| Multi-agent | Specialized expertise | Coordination overhead | Use single-agent instead |
| Three-tier memory | Performance + relevance | Embedding costs | Copy pattern, use cheaper embeddings |
| Tool orchestration | Parallel execution | Complex dependency graph | Simplify, fewer tools initially |
| Preference extraction | Accurate patterns | False positives | Copy regex patterns, add confidence scoring |
| Circuit breakers | Resilience | Configuration tuning | Copy implementation as-is |
| Retry logic | Fault tolerance | Rate limit handling | Copy exponential backoff pattern |
| Webhook fire-and-forget | Fast ACK | Background processing complexity | Copy pattern, use Supabase queue |
| RAG search | Relevant context | Token budget | Copy pgvector setup, add summarization |
| Cost tracking | Transparency | Implementation effort | Copy table schema, add alerts |
| Multi-channel | Flexibility | Maintenance burden | Skip for v1, focus on WhatsApp |

---

## Architecture Philosophy

**molbot principles** (from analysis):
1. **Agent specialization**: Each agent has specific domain expertise
2. **Shared memory**: All agents access same memory layer
3. **Tool distribution**: Tools assigned to relevant agents
4. **Channel abstraction**: Unified message format across channels
5. **Fault tolerance**: Circuit breakers, retries, fallbacks everywhere
6. **Cost awareness**: Track every API call, optimize token usage
7. **Observability**: Extensive logging, metrics, tracing

**migue.ai adaptations**:
1. **Single generalist**: One agent, all tools (simpler)
2. **Native memory**: Agent has direct memory access (less coordination)
3. **Centralized tools**: All tools in one agent (better context)
4. **WhatsApp-first**: No abstraction needed (single channel)
5. **Same fault tolerance**: Copy circuit breakers, retries, fallbacks
6. **Same cost awareness**: Copy tracking patterns, add budget alerts
7. **Pragmatic observability**: Essential logging only (not tracing)

---

## Integration Recommendations

### High Priority (Copy directly)
1. Three-tier memory system (short/long/semantic)
2. Circuit breaker implementation
3. Retry logic with exponential backoff
4. Preference extraction regex patterns
5. Cost tracking table schema
6. Tool approval workflow
7. Webhook fire-and-forget pattern
8. DLQ (dead letter queue) for failures

### Medium Priority (Adapt pattern)
1. Tool orchestration (simplify for single-agent)
2. RAG search (copy pgvector setup, add token budget)
3. Context assembly (same tiers, simpler caching)
4. Error classification (copy categories, adapt messages)
5. Batch processing (copy pattern, fewer use cases)

### Low Priority (Defer or skip)
1. Multi-agent orchestration (use single-agent)
2. Multi-channel abstraction (WhatsApp-only)
3. Plugin system (not needed initially)
4. File operations (Edge Runtime doesn't support)
5. Custom tool registration (hardcode tools initially)

---

## Code Reuse Opportunities

| molbot Module | Location | Reusable for migue.ai | Modifications Needed |
|---------------|----------|----------------------|----------------------|
| Circuit breaker | /lib/circuit-breaker.ts | ✅ 90% | Update config values |
| Memory manager | /lib/memory/manager.ts | ✅ 80% | Replace Redis with Supabase cache |
| Tool orchestrator | /lib/tools/orchestrator.ts | ✅ 70% | Simplify for single-agent |
| Preference extractor | /lib/memory/preferences.ts | ✅ 95% | Copy regex patterns as-is |
| Retry helper | /lib/utils/retry.ts | ✅ 100% | Use as-is |
| Cost tracker | /lib/tracking/costs.ts | ✅ 85% | Add Anthropic provider |
| Webhook validator | /lib/webhooks/validator.ts | ✅ 60% | Adapt for WhatsApp signatures |
| RAG search | /lib/rag/search.ts | ✅ 75% | Update embedding model |
| DLQ manager | /lib/queue/dlq.ts | ✅ 90% | Adapt for Supabase |
| Error classifier | /lib/errors/classifier.ts | ✅ 95% | Copy classification logic |

---

## Strategic Takeaways

**What molbot got right**:
- Three-tier memory (fast + relevant + persistent)
- Circuit breakers and retries (production-grade resilience)
- Cost tracking (essential for AI apps)
- Tool orchestration (parallel execution, approval workflows)
- Preference extraction (regex patterns work well)

**What molbot over-engineered** (for migue.ai's scale):
- Multi-agent architecture (complex coordination)
- Multi-channel support (maintenance burden)
- Plugin system (premature abstraction)
- Extensive observability (tracing not needed yet)

**migue.ai strategy**:
- Copy molbot's battle-tested patterns (memory, circuit breakers, retries)
- Simplify architecture (single-agent, WhatsApp-only)
- Defer complexity (no plugins, no multi-channel, no tracing)
- Focus on core features (calendar, reminders, expenses, AI chat)

---

## Citations

- **Explore agent output**: molbot codebase analysis (42 modules, 6 agents, memory system, tools)
- **molbot files**: /lib/agents/, /lib/memory/, /lib/tools/, /lib/channels/
- **migue.ai PRD**: Feature requirements comparison
- **AI engineer output**: Architecture recommendations

---

**Lines**: 278 | **Tokens**: ~834
