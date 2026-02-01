---
title: Implementation Phases & Roadmap
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: draft
scope: All 3 phases (MVP, Features, Advanced)
---

# Implementation Phases & Roadmap

## Quick Reference
- **Purpose**: Phased implementation roadmap with dependencies, risks, and success criteria
- **References**: docs/research/prd-gap-analysis.md, specs/PRD.md
- **Timeline**: 8-10 weeks total (3 weeks MVP + 4 weeks Features + 3 weeks Advanced)

---

## Phase Overview

| Phase | Duration | Focus | Deliverable | Success Criteria |
|-------|----------|-------|-------------|------------------|
| Phase 1: MVP | 3 weeks | Core messaging + basic AI | WhatsApp webhook working with AI response | User can send message, get AI response with tool execution |
| Phase 2: Features | 4 weeks | Tools + interactive + reminders | All core features working | User can book appointments, get reminders, track expenses |
| Phase 3: Advanced | 3 weeks | RAG + Flows + proactive automation | Production-ready system | Semantic search, Flows, cost transparency, monitoring |

---

## Phase 1: MVP (Week 1-3)

### Objective
Get WhatsApp webhook receiving messages and AI responding with basic tool execution (calendar, reminders, expenses).

### Dependencies
- Vercel account (Edge Functions)
- Supabase project (PostgreSQL + pgvector)
- WhatsApp Business API access (test number)
- OpenAI API key (Claude optional for Phase 1)

### Implementation Steps

| Week | Task | Deliverable | Owner | Blocker Risk |
|------|------|-------------|-------|--------------|
| 1.1 | Database setup | 14 tables created, RLS policies, migrations | Dev | Medium (RLS complexity) |
| 1.2 | Webhook endpoint | POST /api/whatsapp/webhook with HMAC validation | Dev | Low |
| 1.3 | Message normalization | Parse WhatsApp payloads into internal format | Dev | Low |
| 1.4 | Basic AI integration | OpenAI SDK with 5 core tools (calendar, reminders) | Dev | Medium (tool schema design) |
| 2.1 | Tool execution | Calendar: list/create/update/delete events | Dev | Medium (Google Calendar API) |
| 2.2 | Tool execution | Reminders: create/list/update/delete | Dev | Low |
| 2.3 | Tool execution | Expenses: add/list/categorize | Dev | Low |
| 2.4 | Fire-and-forget pattern | Async processing to meet 5s timeout | Dev | High (Edge Runtime constraints) |
| 3.1 | Cron: reminders | Send WhatsApp messages for due reminders | Dev | Medium (cron config) |
| 3.2 | Testing | Unit tests for webhook, tools, AI integration | Dev | Low |
| 3.3 | Deployment | Vercel production deploy + Supabase prod instance | Dev | Medium (env vars, secrets) |

### Success Criteria
- [ ] User sends "book appointment tomorrow 2pm" → AI creates calendar event
- [ ] User sends "remind me at 9am to call John" → Reminder created, WhatsApp message sent at 9am
- [ ] User sends "I spent $50 on lunch" → Expense logged
- [ ] Webhook responds <5s (fire-and-forget working)
- [ ] HMAC validation blocks invalid requests
- [ ] All Phase 1 tests passing (>80% coverage)

### Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Edge Runtime constraints (no Node.js APIs) | High | High | Use Web APIs only, test early |
| WhatsApp 5s timeout | High | Medium | Implement fire-and-forget pattern first |
| Google Calendar API complexity | Medium | Medium | Start with Supabase-only calendar, add Google later |
| RLS policy errors | Medium | Medium | Test RLS with service role + anon key separately |

---

## Phase 2: Features (Week 4-7)

### Objective
Add interactive messages, WhatsApp Flows, 24h window management, multi-provider AI, circuit breakers.

### Dependencies
- Phase 1 complete (MVP working)
- Claude API key (multi-provider)
- Google Calendar API credentials (optional)

### Implementation Steps

| Week | Task | Deliverable | Owner | Blocker Risk |
|------|------|-------------|-------|--------------|
| 4.1 | Interactive messages | Buttons (max 3) + Lists (max 10 sections) | Dev | Medium (WhatsApp API complexity) |
| 4.2 | Multi-provider AI | Claude Sonnet 4.5 primary + GPT-4o fallback | Dev | Medium (provider selection logic) |
| 4.3 | Circuit breakers | States (closed/half-open/open) + thresholds | Dev | Low |
| 4.4 | Token budget | Max 4,096 per request, context pruning | Dev | Low |
| 5.1 | WhatsApp Flows | Navigate flow (appointment booking) | Dev | High (Flows complexity) |
| 5.2 | 24h window management | Track expires_at, cron maintenance | Dev | Medium |
| 5.3 | Template messages | SERVICE templates (FREE) for re-opening windows | Dev | Medium (WhatsApp template approval) |
| 5.4 | Media handling | Upload/download images, audio transcription (Whisper) | Dev | Medium (Edge Runtime file handling) |
| 6.1 | Typing indicators | Show "typing..." before AI response | Dev | Low |
| 6.2 | Read receipts | Mark messages as read | Dev | Low |
| 6.3 | Reactions | React to user messages (👍, ❤️, etc.) | Dev | Low |
| 7.1 | Testing | Integration tests for interactive, flows, windows | Dev | Medium |
| 7.2 | User testing | 5 users test all features | User | Low |
| 7.3 | Bug fixes | Address user feedback | Dev | Medium |

### Success Criteria
- [ ] User taps button → AI executes correct action
- [ ] User completes Flow → Appointment booked in calendar
- [ ] 24h window expires → Template message re-opens conversation
- [ ] Claude fails → GPT-4o takes over seamlessly
- [ ] Circuit breaker opens after 3 failures → No more requests until cooldown
- [ ] User uploads voice note → Transcribed and processed
- [ ] All Phase 2 tests passing (>80% coverage)

### Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WhatsApp Flows complexity | High | High | Start with Navigate flow (simpler), defer Data Exchange |
| Template message approval delay | Medium | High | Submit templates early, use placeholders |
| Media file size limits (Edge Runtime) | Medium | Medium | Stream files, use Supabase storage |
| Multi-provider cost spike | High | Low | Implement cost tracking from Day 1, alert at 80% budget |

---

## Phase 3: Advanced (Week 8-10)

### Objective
Add RAG semantic search, preference extraction, DLQ processing, proactive automation, monitoring dashboard.

### Dependencies
- Phase 2 complete (all features working)
- Supabase pgvector enabled (HNSW indexes)

### Implementation Steps

| Week | Task | Deliverable | Owner | Blocker Risk |
|------|------|-------------|-------|--------------|
| 8.1 | RAG: embeddings | Generate embeddings for user messages, store in user_memory | Dev | Low |
| 8.2 | RAG: HNSW index | Create HNSW index on user_memory.embedding | Dev | Low |
| 8.3 | RAG: search | search_memory tool uses cosine similarity | Dev | Medium (query optimization) |
| 8.4 | Preference extraction | AI detects preferences ("I prefer morning calls") | Dev | Medium (prompt engineering) |
| 9.1 | Proactive automation | Cron suggests actions (weekly expense summary) | Dev | Medium |
| 9.2 | Dead Letter Queue | Log failed messages, retry with backoff | Dev | Low |
| 9.3 | Cost dashboard | User-facing UI showing token usage, message costs | Dev | Medium |
| 9.4 | Monitoring | Vercel Analytics, Supabase Dashboard, ai_usage queries | Dev | Low |
| 10.1 | Performance audit | Optimize slow queries, reduce cold starts | Dev | Medium |
| 10.2 | Security audit | Verify HMAC, RLS, PII handling, secrets rotation | Dev | Medium |
| 10.3 | Documentation | Runbook, API docs, deployment guide | Dev | Low |
| 10.4 | Final testing | E2E tests, load testing (100 users) | Dev | Medium |

### Success Criteria
- [ ] User says "I prefer morning calls" → AI stores preference, uses in future interactions
- [ ] User asks "what did I spend on coffee?" → RAG finds relevant expenses semantically
- [ ] Cron sends weekly expense summary proactively
- [ ] Failed messages logged in DLQ, retried automatically
- [ ] User views dashboard → Sees token consumption, message costs, projections
- [ ] All Phase 3 tests passing (>85% coverage)
- [ ] Performance: <100ms cold start, <2s AI response, <50KB bundle

### Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| RAG quality (bad search results) | Medium | Medium | Test with 100+ user messages, tune similarity threshold |
| Proactive automation annoyance | High | Medium | Add user preferences (opt-in/out), frequency limits |
| Cost dashboard complexity | Low | Low | Start with simple table, iterate based on user feedback |
| Performance regressions | Medium | Low | Continuous monitoring, benchmark tests in CI |

---

## Dependency Graph

```
Phase 1 (MVP)
├── Database setup → Webhook endpoint
├── Webhook endpoint → Message normalization
├── Message normalization → Basic AI integration
├── Basic AI integration → Tool execution
├── Tool execution → Fire-and-forget pattern
└── Fire-and-forget pattern → Cron reminders

Phase 2 (Features) [Depends on Phase 1]
├── Interactive messages → WhatsApp Flows
├── Multi-provider AI → Circuit breakers
├── 24h window management → Template messages
└── Media handling → (standalone)

Phase 3 (Advanced) [Depends on Phase 2]
├── RAG embeddings → HNSW index → RAG search
├── Preference extraction → Proactive automation
├── Cost dashboard → Monitoring
└── DLQ → (standalone)
```

---

## Weekly Milestones

| Week | Milestone | Demo |
|------|-----------|------|
| 1 | Database + webhook working | Receive WhatsApp message, log to DB |
| 2 | AI responding with tools | Book appointment via WhatsApp |
| 3 | MVP complete | End-to-end: message → AI → tool → response |
| 4 | Interactive messages | User taps button, AI executes |
| 5 | WhatsApp Flows | User completes Flow, appointment booked |
| 6 | Media + windows | Upload voice note, get transcription |
| 7 | Phase 2 complete | All features working, user testing |
| 8 | RAG search working | Semantic search for preferences |
| 9 | Proactive automation | Weekly expense summary sent automatically |
| 10 | Production-ready | Performance, security, monitoring complete |

---

## Critical Path

**Blockers that delay entire project:**
1. **Database RLS policies** (Week 1) - All features depend on correct RLS
2. **Fire-and-forget pattern** (Week 2) - Must work for WhatsApp 5s timeout
3. **Multi-provider AI** (Week 4) - Reliability depends on fallback working
4. **24h window management** (Week 5) - Cost optimization depends on windows

**Non-blocking (can parallelize):**
- Media handling (Week 6)
- Typing indicators (Week 6)
- RAG embeddings (Week 8)
- DLQ processing (Week 9)
- Cost dashboard (Week 9)

---

## Quality Gates

| Phase | Quality Gate | Criteria | Block Deployment? |
|-------|--------------|----------|-------------------|
| Phase 1 | Unit tests | >80% coverage | Yes |
| Phase 1 | HMAC validation | 100% invalid requests blocked | Yes |
| Phase 1 | Fire-and-forget | <5s webhook response | Yes |
| Phase 2 | Integration tests | >80% coverage | Yes |
| Phase 2 | User acceptance | 5 users approve | No (warning) |
| Phase 2 | Cost tracking | ai_usage logs 100% requests | Yes |
| Phase 3 | E2E tests | >85% coverage | Yes |
| Phase 3 | Performance | <100ms cold start, <2s AI response | No (warning) |
| Phase 3 | Security audit | HMAC, RLS, PII handling verified | Yes |

---

## Rollback Strategy

| Phase | Rollback Trigger | Rollback Action | Recovery Time |
|-------|------------------|-----------------|---------------|
| Phase 1 | Webhook failing >50% | Revert to previous deploy | 5 min |
| Phase 2 | Circuit breaker stuck open | Disable multi-provider, use OpenAI only | 2 min |
| Phase 2 | Flows breaking conversations | Disable Flows, fallback to text | 5 min |
| Phase 3 | RAG bad results | Disable semantic search, use keyword search | 2 min |
| Phase 3 | Cost spike >$10/day | Enable cost limits, block expensive calls | 1 min |

---

## Budget Estimates

| Phase | Development Time | Cost (AI API) | Cost (WhatsApp) | Total Cost |
|-------|------------------|---------------|-----------------|------------|
| Phase 1 | 120 hours | $50 (testing) | $10 (test messages) | $60 |
| Phase 2 | 160 hours | $100 (testing) | $30 (interactive, flows) | $130 |
| Phase 3 | 120 hours | $150 (RAG, load testing) | $20 (monitoring) | $170 |
| **Total** | **400 hours** | **$300** | **$60** | **$360** |

**Assumptions:**
- 2-person team (ClaudeCode&OnlyMe): 20 hours/week per person = 40 hours/week total
- AI API: $0.15-$0.60 per 1M tokens (OpenAI + Claude testing)
- WhatsApp: $0.0008-0.0308 per message (Colombia pricing)

---

## Success Metrics

| Metric | Phase 1 Target | Phase 2 Target | Phase 3 Target | Measurement |
|--------|----------------|----------------|----------------|-------------|
| Webhook uptime | 99% | 99.5% | 99.9% | Vercel Analytics |
| AI response time | <5s | <3s | <2s | ai_usage.latency_ms |
| Tool execution success | >90% | >95% | >98% | tool_executions.status |
| User satisfaction | N/A | >4.0/5 | >4.5/5 | User survey |
| Cost per user/month | <$1 | <$0.75 | <$0.50 | ai_usage + messages_v2 |
| Test coverage | >80% | >80% | >85% | Vitest report |

---

## Verification Checklist

**Phase 1 (MVP):**
- [ ] Database: 14 tables created, RLS working, migrations idempotent
- [ ] Webhook: HMAC validation 100%, fire-and-forget <5s
- [ ] AI: OpenAI SDK integrated, 5 core tools working
- [ ] Tools: Calendar, reminders, expenses CRUD working
- [ ] Cron: Reminders sent at scheduled time
- [ ] Tests: >80% coverage, all passing

**Phase 2 (Features):**
- [ ] Interactive: Buttons + Lists working
- [ ] Multi-provider: Claude primary, GPT-4o fallback working
- [ ] Circuit breakers: Open/close states working
- [ ] Flows: Navigate flow booking appointments
- [ ] Windows: 24h tracking, template re-opening
- [ ] Media: Image/audio upload, Whisper transcription
- [ ] Tests: >80% coverage, all passing

**Phase 3 (Advanced):**
- [ ] RAG: HNSW index, semantic search working
- [ ] Preferences: AI extracts and uses preferences
- [ ] Proactive: Weekly summaries sent
- [ ] DLQ: Failed messages logged and retried
- [ ] Cost dashboard: User-facing UI showing costs
- [ ] Monitoring: Vercel + Supabase dashboards configured
- [ ] Performance: <100ms cold start, <2s AI response
- [ ] Security: HMAC, RLS, PII handling audited
- [ ] Tests: >85% coverage, all passing

---

## Notes

- This roadmap is a living document, update weekly based on progress
- Quality gates are BLOCKING - do not skip or defer
- User feedback in Phase 2 is critical for Phase 3 priorities
- Budget estimates assume 2-person team (ClaudeCode&OnlyMe)
- See specs/PRD.md for product requirements
- See docs/research/prd-gap-analysis.md for gap analysis
