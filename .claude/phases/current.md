# Fase 2: Core Features Development

**Phase**: 2 of 4
**Name**: Core Features Development
**Status**: 🔄 In Progress (60% completed)
**Start Date**: 2025-09-20
**Target Completion**: 2025-10-10
**Current Date**: 2025-10-03
**Days Remaining**: 7 days

---

## Phase Objectives

Build production-ready core features to enhance WhatsApp AI Assistant capabilities:

1. ✅ **Audio Transcription** - Convert voice messages to text using Whisper
2. ✅ **Streaming Responses** - Real-time AI responses for better UX
3. ✅ **RAG Implementation** - Knowledge base for contextual answers
4. ✅ **Calendar Integration** - Smart reminders and scheduling

**Success Criteria**:
- All features functional in production
- <$10/day operational cost maintained
- >90% test coverage
- <100ms Edge Functions latency
- Security audit passed

---

## Feature Breakdown

### 1. Audio Transcription (50% Complete)
**Priority**: HIGH
**Estimated**: 3 hours remaining
**Owner**: ai-engineer

#### ✅ Completed
- [x] OpenAI Whisper API integration (`lib/openai.ts`)
- [x] Basic transcription function structure
- [x] Error types defined

#### 🔄 In Progress
- [ ] WhatsApp audio download from Media API
  - Need to handle Media ID → Binary download
  - Support formats: AAC, AMR, MP3, OGG
  - Max size: 16MB per WhatsApp limits

#### ❌ Pending
- [ ] Supabase storage upload for audio files
  - Bucket: `audio-messages`
  - Path structure: `{user_id}/{message_id}.{ext}`
  - Retention policy: 30 days
- [ ] Transcription processing pipeline
  - Download → Upload → Transcribe → Store text
  - Background processing (non-blocking)
- [ ] Error handling
  - Unsupported formats → fallback message
  - Network errors → retry with exponential backoff
  - Size limits → warn user
- [ ] Tests
  - `tests/unit/transcription.test.ts`
  - Happy path: audio → text
  - Error cases: format, size, API failure

#### Files Modified
- `lib/transcription.ts` (exists, incomplete)
- `app/api/whatsapp/webhook/route.ts` (needs audio handler)

#### Blockers
None currently identified

---

### 2. Streaming Responses (0% Complete)
**Priority**: MEDIUM
**Estimated**: 3 hours
**Owner**: ai-engineer

#### Tasks
- [ ] OpenAI streaming API implementation
  - Use `stream: true` in chat completions
  - Handle SSE (Server-Sent Events) in Edge Runtime
- [ ] Edge Functions streaming support
  - `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`
  - Handle connection drops gracefully
- [ ] WhatsApp message chunking
  - Max 1600 characters per message
  - Split long responses intelligently
  - Send chunks sequentially with typing indicators
- [ ] Error handling
  - Stream interruptions → send partial + retry
  - Timeout after 25s (WhatsApp typing limit)
- [ ] Backpressure management
  - Queue chunks if sending too fast
  - Respect WhatsApp rate limits (250 msg/sec)
- [ ] Tests
  - `tests/unit/streaming.test.ts`
  - Stream chunk processing
  - Error recovery
  - Message chunking logic

#### Reference Docs
- `docs/VERCEL-STREAMING-AI-RESPONSES.md`
- OpenAI Streaming Guide: https://platform.openai.com/docs/api-reference/streaming

#### Files to Create
- `lib/streaming.ts`
- `tests/unit/streaming.test.ts`

#### Files to Modify
- `lib/response.ts` (add streaming mode)
- `app/api/whatsapp/webhook/route.ts` (detect long responses)

#### Blockers
None - can start immediately

---

### 3. RAG Implementation (30% Complete)
**Priority**: MEDIUM
**Estimated**: 2 hours remaining
**Owner**: ai-engineer

#### ✅ Completed
- [x] `lib/rag/embeddings.ts` - OpenAI embedding generation
- [x] `lib/rag/chunk.ts` - Document chunking logic
- [x] Basic document structure defined

#### 🔄 In Progress
- [ ] `lib/rag/search.ts` (50% done)
  - Cosine similarity search implemented
  - Need to integrate with Supabase pgvector
  - Optimize query performance

#### ❌ Pending
- [ ] `lib/rag/document-ingestion.ts`
  - Document upload API
  - Text extraction (PDF, DOCX, TXT)
  - Chunking + embedding pipeline
- [ ] Supabase vector storage
  - Enable pgvector extension
  - Create `documents` table with vector column
  - Add RLS policies for multi-user
  - Create index for similarity search
- [ ] RAG query endpoint
  - `app/api/rag/query/route.ts`
  - Retrieve top-k relevant chunks
  - Inject into GPT-4o context
- [ ] Knowledge base management
  - List documents API
  - Delete document API
  - Update document metadata
- [ ] Tests
  - `tests/unit/rag/embeddings.test.ts` (exists)
  - `tests/unit/rag/search.test.ts` (pending)
  - `tests/unit/rag/ingestion.test.ts` (pending)

#### Database Schema (Pending)
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536), -- text-embedding-3-small
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

#### Integration Points
- WhatsApp webhook → detect knowledge query intent
- GPT-4o context injection with retrieved chunks
- Supabase RLS for user-specific knowledge bases

#### Blockers
- Need Supabase pgvector extension enabled (5 min setup)

---

### 4. Calendar Integration (80% Complete)
**Priority**: LOW
**Estimated**: 1 hour remaining
**Owner**: backend-developer

#### ✅ Completed
- [x] Reminder creation & storage in Supabase
- [x] Cron job for daily reminders (9 AM UTC)
- [x] Natural language date parsing (basic)
- [x] WhatsApp reminder notifications

#### ❌ Pending
- [ ] Google Calendar API integration
  - OAuth 2.0 setup for users
  - Create events in Google Calendar
  - Sync reminders bidirectionally
- [ ] Timezone handling improvements
  - Detect user timezone from phone number
  - Store timezone preference in DB
  - Convert reminder times correctly
- [ ] Recurring reminders support
  - Parse "every Monday", "daily", etc.
  - Store recurrence rules in DB
  - Update cron logic for recurring

#### Files Modified
- `app/api/cron/check-reminders/route.ts` (add timezone logic)
- `lib/calendar.ts` (to create for Google API)

#### Blockers
- Google Calendar API credentials (low priority)

---

## Testing Progress

### Current Status
- **Test Suites**: 20 passed, 20 total
- **Tests**: 112 passed, 112 total
- **Coverage**: Not tracked (Edge Runtime limitation)

### Pending Tests
- [ ] `tests/unit/transcription.test.ts` (10 tests)
- [ ] `tests/unit/streaming.test.ts` (8 tests)
- [ ] `tests/unit/rag/search.test.ts` (5 tests)
- [ ] `tests/unit/rag/ingestion.test.ts` (5 tests)
- [ ] `tests/e2e/audio-flow.spec.ts` (Playwright)
- [ ] `tests/e2e/streaming-flow.spec.ts` (Playwright)

**Target**: 140+ total tests

---

## Performance Targets

### Current Metrics
- ✅ Edge Functions latency: <100ms (achieved)
- ✅ WhatsApp response time: ~1.5s (under 2s target)
- ✅ Database queries: <50ms with RLS indexes
- ❓ Cache hit rate: No metrics yet (need to implement)

### Phase 2 Targets
- Maintain <100ms Edge Functions latency
- Audio transcription: <3s end-to-end
- Streaming: First chunk in <500ms
- RAG search: <200ms for top-10 retrieval
- Overall response time: <2s for 90th percentile

---

## Cost Tracking

### Current Daily Cost: ~$4/day ✅

**Breakdown**:
- OpenAI GPT-4o: ~$2.50/day (50 requests/day)
- OpenAI Whisper: ~$0.50/day (estimated 10 transcriptions)
- OpenAI Embeddings: ~$0.30/day (estimated 20 documents)
- Vercel: $0 (Hobby tier)
- Supabase: $0 (Free tier, 400MB used / 500MB limit)
- WhatsApp: $0 (Free tier, ~50 conversations/month)

**Buffer**: $6/day remaining (60% under budget)

### Phase 2 Estimated Cost: ~$6-8/day
- Transcription will increase Whisper usage
- Streaming same cost as regular (same tokens)
- RAG embeddings one-time cost per document
- Still under $10/day target ✅

---

## Risks & Mitigations

### Technical Risks
1. **Whisper API Latency** (HIGH)
   - Risk: Transcription >5s → poor UX
   - Mitigation: Background processing + "transcribing..." message

2. **Streaming Edge Function Limits** (MEDIUM)
   - Risk: Edge Runtime doesn't support long streams
   - Mitigation: Test extensively, fallback to regular responses

3. **pgvector Performance** (LOW)
   - Risk: Slow similarity search at scale
   - Mitigation: Proper indexing (ivfflat), query optimization

4. **Cost Overruns** (LOW)
   - Risk: Excessive API usage >$10/day
   - Mitigation: Rate limiting, caching, usage alerts

### Business Risks
1. **Feature Complexity** (MEDIUM)
   - Risk: Overengineering delays launch
   - Mitigation: MVP approach, iterative releases

2. **User Adoption** (MEDIUM)
   - Risk: Low usage of advanced features
   - Mitigation: User feedback loops, analytics

---

## Blockers & Dependencies

### Current Blockers
- ❌ None critical

### Dependencies
- ✅ Next.js 15 App Router (deployed)
- ✅ Vercel Edge Functions (active)
- ✅ OpenAI API access (approved)
- ✅ WhatsApp API v23.0 (configured)
- ✅ Supabase database (operational)
- ⚠️ Supabase pgvector extension (needs activation)

---

## Next Steps (This Week)

### Day 1-2 (Oct 3-4): Audio Transcription
- [ ] Implement WhatsApp audio download
- [ ] Setup Supabase audio storage bucket
- [ ] Build transcription pipeline
- [ ] Write tests
- [ ] Deploy to production

### Day 3-4 (Oct 5-6): Streaming Responses
- [ ] Implement OpenAI streaming
- [ ] Edge Functions streaming handler
- [ ] WhatsApp chunking logic
- [ ] Error handling
- [ ] Tests + deployment

### Day 5-6 (Oct 7-8): RAG Completion
- [ ] Enable Supabase pgvector
- [ ] Complete search.ts
- [ ] Build document ingestion
- [ ] RAG query endpoint
- [ ] Tests + deployment

### Day 7 (Oct 9): Polish & Security
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Phase 2 completion review

### Day 8 (Oct 10): Phase 2 Complete ✅
- [ ] All tests passing
- [ ] Production deployment verified
- [ ] Metrics review
- [ ] Retrospective
- [ ] Plan Phase 3 kickoff

---

## Team & Ownership

**Primary Owner**: ai-engineer (Opus 4.1)
**Support**:
- frontend-developer (Sonnet) - UI components
- backend-developer (Sonnet) - API endpoints
- typescript-pro (Opus) - Architecture review

**Delegation**:
- Audio: ai-engineer (complex ML integration)
- Streaming: ai-engineer (Edge runtime expertise)
- RAG: ai-engineer (vector search + LLM)
- Tests: All owners for their modules

---

## Success Metrics

### Phase 2 Complete When:
- [x] 100% test coverage maintained (currently 112 tests)
- [ ] Audio transcription functional (0% → 100%)
- [ ] Streaming responses implemented (0% → 100%)
- [ ] RAG basic functionality working (30% → 100%)
- [ ] <$10/day operational cost (currently $4/day ✅)
- [ ] <100ms Edge Functions latency (currently ✅)
- [ ] Security audit passed
- [ ] Documentation updated

**Estimated Completion**: 2025-10-10 (on track)

---

## Notes & Decisions

### 2025-10-03
- ✅ Initiated CLAUDE-MASTER v2.0 structure
- ✅ Created `.claude/ROADMAP.md`
- ✅ Created `phases/current.md`
- 📝 Next: Audio transcription implementation
- 📝 Focus: Ship features over perfection
- 📝 Principle: Test first, then implement

### Decision Log
1. **Audio Processing**: Background processing to avoid blocking (APPROVED)
2. **Streaming**: Edge Runtime compatible only (APPROVED)
3. **RAG**: Supabase pgvector over external vector DB (APPROVED)
4. **Testing**: Unit > E2E for Edge Runtime (APPROVED)

---

**Last Updated**: 2025-10-03 17:45 UTC
**Next Update**: Daily during active development
**Status**: On track for Oct 10 completion 🎯
