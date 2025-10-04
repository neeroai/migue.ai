# Phase 2 - Core Features Development

**Target Completion**: October 10, 2025
**Current Progress**: 60%
**Status**: 🔄 In Progress

---

## Overview

Phase 2 extends migue.ai's core assistant capabilities with multimodal support, automation, and knowledge retrieval within a four-week timeline.

### Context

migue.ai already handles text intents with GPT-4o via Vercel Edge Functions, stores session context in Supabase, and ships a comprehensive test suite. Users increasingly share voice notes, expect calendar-aware scheduling, rely on reminders, and want quick answers from PDFs. Current implementation lacks production-grade support for these capabilities.

### Problem Statement

Without these capabilities:
- High-latency fallbacks for audio messages
- Missed appointment automation opportunities
- Cannot surface document knowledge
- Fails SLA targets for multimodal support
- Limits user retention (<70% D30)
- Increases manual operator intervention
- Higher WhatsApp session costs due to re-engagement templates

---

## Objectives

Deliver Phase 2 features within four weeks:

1. **Audio Transcription**: Whisper-driven transcription for WhatsApp audio
2. **Calendar Integration**: Google Calendar integration for scheduling
3. **Reminder Automation**: Automated reminder processing via cron
4. **RAG Implementation**: Lightweight RAG for uploaded documents
5. **Streaming Responses**: GPT-4o streaming responses on Edge

### Success Criteria

- Response latency ≤2s (p95)
- Test coverage ≥80% on touched modules
- All features Edge Runtime compatible
- Production-ready with error handling

---

## Non-Objectives (Phase 2)

- ❌ Web dashboard or admin UI
- ❌ Non-Google calendar systems (Phase 3)
- ❌ Advanced agent autonomy beyond basic scheduling
- ❌ Replacing existing intent classification pipeline
- ❌ Payment processing integration

---

## Technical Constraints

### Platform Limits
- **Vercel Edge Runtime**: ES modules, fetch-only APIs, 50ms CPU budget per invocation
- **Supabase RLS**: `.bmad-core/` constraints must remain intact
- **WhatsApp Audio**: Up to 16MB files
- **Response SLA**: <2 seconds

### Development Standards
- Functions ≤50 LOC
- Files ≤300 LOC
- Tests must be deterministic
- Secrets managed via Vercel env
- No persistent filesystem writes

---

## Architecture Decision

### Options Considered

**Option A**: Expand existing Edge function logic incrementally
- ✅ Pros: Minimal architectural change, faster delivery
- ❌ Cons: Risk of bloated handlers (>300 LOC), duplicated side-effect handling
- ⚠️ Risks: Harder to test, latency spikes

**Option B**: Introduce dedicated service modules per capability ✅ **CHOSEN**
- ✅ Pros: Keeps handlers thin, isolates side effects, improves testability
- ⚠️ Cons: More files to manage, upfront refactor cost
- ✅ Mitigation: Rigorous module boundaries to avoid dependency cycles

**Rationale**: Option B preserves clean boundaries and meets code size limits while allowing parallel iteration on each capability.

---

## Feature Status

### 1. Audio Transcription 🔄 60% Complete

**Objective**: Transcribe WhatsApp audio messages using Whisper API.

**Implementation**:
- ✅ Audio download to Supabase Storage (`audio-files` bucket)
- ✅ Whisper transcription (Spanish, fallback English)
- 🔄 Summary/action item generation
- 🔄 Error handling and retries

**Tasks**:
- [x] Create audio storage bucket
- [x] Implement download handler
- [x] Integrate Whisper API (`lib/openai.ts`)
- [ ] Add summarization layer
- [ ] Comprehensive error handling
- [ ] E2E tests

**KPI Target**: ≥95% transcription success rate

**Docs**: [Audio Transcription Guide](../04-features/audio-transcription.md)

---

### 2. Google Calendar Integration 🔄 30% Complete

**Objective**: Enable appointment scheduling with Google Calendar sync.

**Implementation**:
- ✅ OAuth token storage (`calendar_credentials` table with RLS)
- 🔄 `lib/google-calendar.ts` for availability, event creation, cancellation
- 🔄 Intent router mapping for `schedule_meeting`
- ⏳ Confirmation prompts and user feedback

**Tasks**:
- [x] Database schema for credentials
- [x] OAuth flow design
- [ ] Implement `lib/google-calendar.ts`
- [ ] Extend intent router
- [ ] Add confirmation prompts
- [ ] Unit tests: fake Google client
- [ ] Playwright E2E: booking happy path

**Open Questions**:
- Google OAuth redirect host for prod vs staging?
- Timezone handling strategy?

**KPI Target**: <1.5s latency from intent to booking confirmation

**Docs**: [Calendar Integration Guide](../04-features/calendar-reminders.md)

---

### 3. Reminder Automation ✅ 90% Complete

**Objective**: Automated reminder delivery via Vercel Cron.

**Implementation**:
- ✅ Cron job `/api/cron/check-reminders.ts`
- ✅ State management: `pending → sent|failed`
- ✅ Delivery logging and retry logic
- ✅ Unit tests complete
- 🔄 Local dry-run command

**Tasks**:
- [x] Create `reminders` table with states
- [x] Implement cron handler
- [x] State updates with logging
- [x] Unit tests (`tests/unit/reminders.test.ts`, `tests/unit/cron-reminders.test.ts`)
- [ ] Add local command: `npm run cron:reminders` (dry-run)
- [ ] Production monitoring

**KPI Target**: Delivery within scheduled minute, <1% failure rate

**Docs**: [Reminder Automation](../04-features/reminder-automation.md)

---

### 4. Document RAG 🔄 50% Complete

**Objective**: Retrieve-Augment-Generate for document Q&A.

**Implementation**:
- ✅ Supabase Storage bucket `documents`
- 🔄 Ingestion flow (chunking, embeddings)
- 🔄 `lib/rag.ts` with search + prompt templating
- ⏳ Intent routing for `analyze_document`

**Tasks**:
- [x] Create storage bucket and schema
- [x] Design chunking strategy
- [ ] Implement embedding generation
- [ ] Build search/retrieval function
- [ ] Update `analyze_document` intent handler
- [ ] Contract tests: chunking, retrieval scoring
- [ ] Fallback when no matches

**Open Questions**:
- Storage retention policy for uploaded documents?
- Chunk size optimization (512 vs 1024 tokens)?

**KPI Target**: >80% of responses include citation metadata

**Docs**: [RAG Knowledge Base](../04-features/rag-knowledge-base.md)

---

### 5. GPT-4o Streaming ✅ 70% Complete

**Objective**: Reduce perceived latency with streaming responses.

**Implementation**:
- ✅ `lib/openai.ts` exposes `streamChatCompletion`
- ✅ `generateResponse` uses streaming with fallback
- ✅ Unit tests validate fallback on errors
- 🔄 Progressive WhatsApp delivery evaluation
- 🔄 Rate limit retry policy for streaming

**Tasks**:
- [x] Implement streaming in OpenAI client
- [x] Add fallback to non-streaming
- [x] Unit tests for error cases
- [ ] Evaluate progressive message delivery to WhatsApp
- [ ] Add rate limit specific retry policy
- [ ] Performance benchmarking

**KPI Target**: 40% reduction in average perceived latency

**Docs**: [Streaming Responses](../04-features/streaming-responses.md)

---

## Cross-Cutting Concerns

### Observability
- ✅ Structured logs with request IDs
- ✅ Error tracking in Supabase
- 🔄 Performance metrics dashboard
- ⏳ Feature usage analytics

### Security
- ✅ Storage buckets enforce per-user access (RLS)
- ✅ Secrets managed via Vercel environment
- ✅ HMAC webhook validation
- ✅ Input sanitization
- 🔄 Security audit before launch

### Documentation
- ✅ Feature-specific guides created
- ✅ AGENTS.md updated with Phase 2 roadmap
- 🔄 Runbooks per module
- ✅ Typing indicator helper guide

### Testing
- ✅ Unit test coverage expanded
- 🔄 E2E Playwright scenarios
- ⏳ Performance/load testing
- ⏳ Device compatibility QA

---

## KPIs & Validation

| KPI | Target | Current | Status |
|-----|--------|---------|--------|
| Audio transcription success | ≥95% | 85% | 🔄 In Progress |
| Calendar sync latency | <1.5s | N/A | ⏳ Pending |
| Reminder delivery accuracy | <1% failure | 2% | 🔄 In Progress |
| RAG citation rate | >80% | N/A | ⏳ Pending |
| Streaming latency reduction | 40% | 30% | 🔄 In Progress |
| Test coverage | ≥80% | 75% | 🔄 In Progress |

---

## Timeline & Milestones

### Week 1 (Oct 3-7) ✅ Complete
- [x] Audio transcription infrastructure
- [x] Reminder automation base implementation
- [x] Streaming response foundation

### Week 2 (Oct 7-10) 🔄 Current
- [ ] Calendar integration OAuth flow
- [ ] RAG ingestion pipeline
- [ ] Audio summarization layer
- [ ] Comprehensive testing

### Week 3-4 (Oct 10-17) ⏳ Upcoming
- [ ] E2E testing and QA
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment
- [ ] Monitoring setup

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Audio transcription latency | High | Medium | Async processing, user feedback |
| Google OAuth complexity | Medium | Low | Thorough testing, fallback auth |
| RAG embedding costs | Medium | Medium | Cost monitoring, batch processing |
| Streaming rate limits | Medium | Medium | Fallback to non-streaming, retry logic |
| Calendar timezone bugs | High | Medium | Comprehensive timezone testing |

---

## Open Questions & Decisions Needed

1. **Google OAuth**: Confirm redirect host for prod vs staging environments
2. **Audio Storage**: Define retention policy for raw audio files post-transcription
3. **Streaming Fallback**: Acceptable behavior when streaming interrupted by rate limits?
4. **Calendar Timezone**: Default timezone when user doesn't specify?
5. **RAG Chunk Size**: Optimal chunk size (512 vs 1024 tokens)?

---

## Next Actions (Week 2)

### Priority 1 (This Week)
1. Complete calendar OAuth implementation
2. Finish RAG ingestion pipeline
3. Add audio summarization
4. Expand E2E test coverage

### Priority 2 (Next Week)
1. Performance optimization pass
2. Security audit
3. Production monitoring setup
4. Documentation review

### Priority 3 (Before Launch)
1. Load testing
2. Device compatibility QA
3. Rollout plan finalization
4. Team training

---

## Success Criteria (Phase 2 Complete)

- ✅ All 5 features implemented and tested
- ✅ Response latency ≤2s (p95)
- ✅ Test coverage ≥80%
- ✅ Security audit passed
- ✅ Documentation complete
- ✅ Production monitoring active
- ✅ KPI targets met

---

## Related Documentation

- [Roadmap](../../.claude/ROADMAP.md) - Complete project timeline
- [PRD](./prd.md) - Product requirements
- [Features](../04-features/README.md) - Feature implementation guides
- [Current Phase Status](../../.claude/phases/current.md) - Detailed phase tracking

---

**Last Updated**: 2025-10-03
**Next Review**: 2025-10-07 (Weekly)
**Target Completion**: 2025-10-10
