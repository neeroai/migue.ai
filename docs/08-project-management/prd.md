# Product Requirements Document (PRD) - migue.ai

**Version**: 4.0
**Last Updated**: 2025-10-03
**Status**: Living Document
**Current Phase**: Fase 2 - Core Features (60% complete)

---

## 1. Context and Problem

Professionals and small businesses in Latin America need a personal assistant on WhatsApp for productivity tasks (appointments, reminders, content analysis). Current solutions are fragmented or have high costs/latency.

### Market Need
- **WhatsApp Prevalence**: Primary communication channel in LatAm
- **Productivity Gap**: Lack of integrated AI assistants for small businesses
- **Cost Barrier**: Existing solutions are expensive or require technical expertise
- **Fragmentation**: Multiple tools needed for different tasks

---

## 2. Objective, Personas, and Scope (MVP)

### Objective

Create a personal assistant on WhatsApp with low latency (1-2s), available 24/7, that automates appointments, remembers tasks, transcribes audio, summarizes PDFs/videos, and offers basic RAG; scalable and cost-efficient.

### Target Personas

1. **Independent Professional** (consultant/coach)
   - Needs: Appointment scheduling, note-taking, document analysis
   - Pain points: Time management, client follow-ups

2. **Small Business** (SMB services)
   - Needs: Customer communication, appointment management, automated reminders
   - Pain points: Manual scheduling, missed appointments

3. **Student/Creator**
   - Needs: Audio transcription, document summaries, knowledge management
   - Pain points: Information overload, note organization

### MVP Scope

**In Scope**:
- WhatsApp message reception and sending
- Intent detection and text responses (OpenAI)
- Data persistence (Supabase + RLS)
- Reminders (Vercel Cron)
- Audio transcription (Whisper)
- Basic PDF RAG (Embeddings + Storage)

**Out of Scope (Post-MVP)**:
- Web admin UI
- Complex integrations (CRM/ERP)
- Real-time voice/video calls
- Multi-tenant management
- Payment processing

---

## 3. Users and Use Cases

### Individual Use Cases
- **Appointment Reminders**: "Remind me about dentist appointment tomorrow at 3pm"
- **Voice Notes**: Send audio message → receive transcription + summary
- **Document Analysis**: Upload PDF → ask questions about content
- **Task Management**: Schedule tasks and receive timely reminders

### SMB Use Cases
- **Client Appointments**: Schedule appointments with automatic Google Calendar integration
- **Follow-up Messages**: Automated follow-ups for appointments and confirmations
- **Template Messages**: Predefined responses for common inquiries

---

## 4. Functional Requirements + APIs

### High-Level Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| RF1 | WhatsApp webhook validates signatures and normalizes messages | P0 |
| RF2 | Send messages (text + basic media) and templates | P0 |
| RF3 | Store conversations/messages/users/contacts with RLS | P0 |
| RF4 | Detect intent and respond with OpenAI (with timeouts and limits) | P0 |
| RF5 | Schedule reminders and send timely notifications | P1 |
| RF6 | Transcribe WhatsApp audio with Whisper | P1 |
| RF7 | Ingest PDFs, generate embeddings, and perform contextual retrieval (basic RAG) | P1 |

### API Endpoints (Edge Runtime)

**WhatsApp**:
- `POST /api/whatsapp/webhook` - Receive messages
- `POST /api/whatsapp/send` - Send messages

**AI Services**:
- `POST /api/ai/intent` - Intent classification
- `POST /api/ai/answer` - Generate responses
- `POST /api/ai/transcribe` - Audio transcription

**Documents**:
- `POST /api/documents/upload` - Upload documents
- `POST /api/documents/ingest` - Process and embed documents

**Reminders**:
- `POST /api/reminders/schedule` - Schedule reminder
- `GET /api/reminders` - List reminders

**Conversations**:
- `GET /api/conversations/:id/messages` - Message history

---

## 5. Architecture and Constraints

### Architecture Overview

```
WhatsApp Business API
        ↓
Vercel Edge Functions
        ↓
    ┌───┴───┐
    ↓       ↓
Supabase   OpenAI
```

### Technical Constraints

**Platform Limits**:
- **Edge Runtime**: 10-60s timeout → short functions required
- **WhatsApp**: 24-hour customer service window (CSW) for free messages
- **Supabase**: Connection pooling for Edge compatibility

**Security Requirements**:
- No secrets in code
- RLS (Row Level Security) enabled on all tables
- HMAC signature validation for webhooks
- Input sanitization and validation

**Cost Targets**:
- **Monthly Budget**: $75-95/month
  - Vercel Pro: ~$20
  - Supabase Pro: ~$25
  - OpenAI: ~$30-50 (estimated)
- **Per User**: <$2/month

**Dependencies**:
- Meta WhatsApp Business API
- OpenAI API (GPT-4o, Whisper, Embeddings)
- Vercel Edge Network
- Supabase (PostgreSQL + Storage)

---

## 6. Epics and Initial Stories

### Epic 1: Platform Base and Webhook

**Stories**:
1. **1.1 Webhook**: Token/signature validation, message parsing, minimal logging
2. **1.2 Send**: Endpoint with retries and rate-limit handling
3. **1.3 DB Schema**: `users`, `conversations`, `messages` with indexes/RLS
4. **1.4 Intent**: OpenAI service with limits, prompts, and fallbacks
5. **1.5 Orchestration**: Persist → generate → respond → traceability

### Epic 2: Audio and Transcription

**Stories**:
1. **2.1 Download**: Store in Supabase Storage (`audio-files` bucket)
2. **2.2 Transcription**: Whisper API (Spanish, fallback English)
3. **2.3 Summary**: Generate summary/action items from transcription

### Epic 3: Reminders

**Stories**:
1. **3.1 Schema**: `reminders` table with states
2. **3.2 Cron**: Vercel Cron `/api/cron/check-reminders` (daily)
3. **3.3 Delivery**: Send and update state with retries

### Epic 4: RAG PDFs

**Stories**:
1. **4.1 Storage**: `documents` bucket with metadata
2. **4.2 Embeddings**: OpenAI embeddings + `embeddings` table (vector + metadata)
3. **4.3 Retrieval**: Semantic search and citation in responses

---

## 7. Non-Functional Requirements (NFRs) and KPIs

### NFRs

| NFR | Target | Status |
|-----|--------|--------|
| **Latency** | <1.5s average for text responses | ✅ Achieved |
| **Availability** | >99.9% (Edge + Supabase managed) | ✅ On track |
| **Security** | RLS active, HMAC webhooks, input sanitization, no PII in logs | ✅ Implemented |
| **Observability** | Structured logs, request_id, key metrics | ✅ Implemented |
| **Scalability** | >1000 req/min (Edge + pooling + selective cache) | ✅ Ready |

### KPIs

**Performance Metrics**:
- Response time (p50/p95): <1s / <2s
- Message delivery success rate: >99%

**Feature Adoption**:
- Audio transcription usage
- RAG query frequency
- Reminder creation rate

**User Satisfaction**:
- 30-day retention rate
- User satisfaction: >4.5/5 (qualitative)

**Cost Efficiency**:
- Cost per user: <$2/month
- OpenAI token optimization

---

## 8. Costs, Privacy, and Compliance

### Cost Strategy (WhatsApp)

**Optimization Tactics**:
- Maximize 24-hour CSW (customer service window) with high utility
- Use templates for messages outside CSW
- Monitor costs and usage patterns
- Batch messages when possible

**Cost Breakdown**:
- **WhatsApp**: Free within CSW, $0.005-0.01/message outside
- **OpenAI**:
  - GPT-4o: ~$5/1M input tokens, ~$15/1M output tokens
  - Whisper: ~$0.006/minute
  - Embeddings: ~$0.13/1M tokens
- **Supabase**: Pro plan $25/month + storage
- **Vercel**: Pro plan $20/month + Edge function execution

### Privacy and Compliance

**Data Protection**:
- Minimal PII collection
- Retention and cleanup policies for media and messages
- End-to-end encryption in transit
- RLS for data access control
- No secrets/PII in logs (use request_id for tracing)

**Compliance**:
- GDPR-ready data handling
- User consent for data processing
- Right to deletion support
- Transparent privacy policy

---

## 9. Risks and MVP Acceptance

### Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Rate limits/timeout** | High | Exponential backoff, lightweight queues |
| **AI costs** | Medium | Token limits, prompt caching |
| **Storage growth** | Medium | Retention policies, automated cleanup |
| **Integration failures** | High | Circuit breakers, fallback responses |
| **WhatsApp policy changes** | High | Monitor Meta updates, diversification plan |

### MVP Acceptance Criteria

**Completion Requirements**:
- ✅ Epic 1 stories complete and stable
- 🔄 At least 1 happy path E2E test per Epic 2-4
- ✅ NFR latency targets met at p50/p95
- ✅ Basic logs and metrics enabled

**Feature-Specific Criteria**:

1. **Text Messaging**: webhook→persistence→AI→response in <2s p95
2. **Reminders**: Delivery within ±1 minute, state updates
3. **Audio**: Successful transcription for audio ≤2 min, summarized response
4. **RAG**: Response with 1-2 relevant citations, costs within budget

---

## 10. Current Status (Fase 2)

### Completed (Fase 1) ✅
- WhatsApp messaging infrastructure
- OpenAI integration (GPT-4o)
- Supabase database with RLS
- Vercel Edge deployment
- Intent detection
- Basic conversation flow

### In Progress (Fase 2) 🔄
- Audio transcription (60%)
- Streaming responses (40%)
- RAG implementation (50%)
- Calendar integration (30%)

### Planned (Fase 3) 📋
- Smart followups
- Multi-language support
- Advanced analytics
- Payment integration

---

## 11. Success Metrics

**Week 1 (MVP Launch)**:
- 10+ active users
- <2s response time (p95)
- >95% message delivery rate

**Month 1**:
- 50+ active users
- >70% feature adoption (audio/RAG)
- <$10/day operational costs
- >4.0/5 user satisfaction

**Month 3**:
- 200+ active users
- >90% 30-day retention
- Self-sustaining cost model
- Product-market fit indicators

---

## Related Documentation

- [Roadmap](../../.claude/ROADMAP.md) - Complete project timeline
- [Architecture](../02-architecture/README.md) - Technical design
- [Features](../04-features/README.md) - Feature implementation guides
- [Deployment](../05-deployment/README.md) - Deployment strategy

---

**Document Owner**: Product Team
**Technical Lead**: Engineering Team
**Last Review**: 2025-10-03
**Next Review**: 2025-10-10 (Post-Fase 2)
