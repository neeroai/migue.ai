# Architecture & Design Decisions

---

## Next.js 15 App Router over Pages Router (2025-09-25)
**Context**: Project started with Pages Router, needed modern architecture
**Decision**: Migrate to App Router with Edge Functions
**Alternatives**:
- Keep Pages Router (outdated, not recommended by Vercel)
- Use different framework (too much migration effort)
**Rationale**:
- Better performance with Edge Functions
- Modern React patterns (Server Components)
- Future-proof for Next.js evolution
- <100ms latency requirement needs Edge
**Impact**:
- All API routes moved from `/api/` to `/app/api/`
- Route handlers use named exports (GET, POST)
- Build time reduced by 30%

---

## Supabase pgvector over External Vector DB (2025-10-03)
**Context**: RAG implementation needs vector storage
**Decision**: Use Supabase pgvector extension
**Alternatives**:
- Pinecone (managed vector DB)
- Weaviate (self-hosted)
- Milvus (enterprise)
**Rationale**:
- Already using Supabase for relational data
- Unified database reduces complexity
- No additional service costs ($0 in free tier)
- RLS policies for multi-tenant security
- <200ms query target achievable with ivfflat index
**Impact**:
- Need to enable pgvector extension
- Vector column in documents table (1536 dimensions)
- Cosine similarity search queries

---

## Background Audio Transcription (2025-10-03)
**Context**: Whisper API can take 1-5 seconds per minute of audio
**Decision**: Process audio in background, don't block response
**Alternatives**:
- Synchronous processing (poor UX, timeout risk)
- Skip transcription for long audio (loses functionality)
**Rationale**:
- WhatsApp users expect <2s response time
- "Transcribing your message..." provides feedback
- Can send transcription when ready
- Prevents Edge Function timeout (25s limit)
**Impact**:
- `lib/transcription.ts` async processing
- Supabase storage for temporary audio files
- Follow-up message with transcription result

---

## Edge Runtime Only for Streaming (2025-10-03)
**Context**: OpenAI streaming responses need SSE support
**Decision**: Only implement streaming in Edge Runtime compatible way
**Alternatives**:
- Use Node.js runtime for streaming (breaks Edge benefits)
- Skip streaming (poor UX for long responses)
**Rationale**:
- Edge Runtime supports SSE via ReadableStream
- Can chunk WhatsApp messages (1600 char limit)
- Maintains <100ms cold start target
- Compatible with Vercel Edge deployment
**Impact**:
- `lib/streaming.ts` uses ReadableStream
- WhatsApp chunking logic in response handler
- Test streaming in Edge environment only

---

## GPT-3.5-turbo for Simple Intents (Planned)
**Context**: GPT-4o costs 10x more for simple queries
**Decision**: Use GPT-3.5-turbo for "casual" and "greeting" intents
**Alternatives**:
- Always use GPT-4o (expensive)
- Use regex/hardcoded responses (inflexible)
**Rationale**:
- 10x cost savings (~$0.50/day → ~$0.05/day)
- Quality sufficient for casual conversation
- ~20% of requests are simple
- Keeps under $10/day budget target
**Impact**:
- `lib/intent.ts` classifies intent complexity
- `lib/response.ts` selects model based on intent
- Estimated savings: $1-2/day

---

## Unit Tests Over E2E for Edge Runtime (2025-09-20)
**Context**: Edge Runtime doesn't support all testing tools
**Decision**: Focus on comprehensive unit tests, minimal E2E
**Alternatives**:
- Extensive E2E (slow, flaky, Edge incompatible)
- Skip tests (unacceptable for production)
**Rationale**:
- Jest with @edge-runtime/jest-environment works well
- Unit tests catch 80% of issues
- Faster feedback loop
- E2E only for critical user flows
**Impact**:
- 112 unit tests (comprehensive)
- Minimal Playwright E2E (critical flows only)
- Coverage disabled (Edge limitation)

---

**Last Updated**: 2025-10-03
