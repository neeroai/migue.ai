# Feature Expansion Roadmap

**Last Updated**: 2025-10-03
**Execution Timeline**: 6-10 weeks (3 waves)
**Status**: Wave 1 - In Progress

## Overview

Goal: Ship high-impact capabilities leveraging WhatsApp interactive surfaces and OpenAI multimodality. Execution spans three waves balancing user value, technical debt, and experimentation.

---

## Wave 1 (Weeks 1-3) - Conversational UX & Smart Follow-ups

### 1. Interactive List & Button Messages ✅ In Progress

**Objective**: Surface appointment slots, task menus, and follow-up actions using WhatsApp interactive messages.

**Tasks**:
1. ✅ Design conversation router (intent → interactive payload) with legacy fallback
2. ✅ Implement helpers in `lib/whatsapp.ts` for `interactive.list`/`interactive.button`
3. ✅ Extend scheduling/reminder flows to offer quick actions ("Confirmar cita", "Editar recordatorio")
4. ✅ Track selections in Supabase (`conversation_actions`)

**Benefits**:
- Increased completion rates
- Structured conversations
- Better user experience

**Risks & Mitigations**:
- Unsupported clients → Detect capability via webhook metadata, provide text fallback
- Template approvals → Submit early, maintain fallback options

**Effort**: Medium

### 2. Smart Follow-ups (Utility Templates)

**Objective**: Schedule proactive check-ins using WhatsApp utility templates.

**Tasks**:
1. Draft follow-up templates (confirm appointment, document status) → Submit to Meta
2. ✅ Extend reminder cron to queue follow-up jobs using Supabase + Vercel cron
3. Add cost monitoring dashboard (template usage per user/day)

**Use Cases**:
- "¿Confirmas la cita para mañana a las 3pm?"
- "Tu documento está listo. ¿Necesitas algo más?"
- Proactive task reminders

**Dependencies**:
- Meta template approval
- Supabase metrics table
- Cost monitoring system

**Effort**: Medium

### 3. Typing & Presence Orchestration

**Objective**: Enhance user feedback during long-running operations.

**Tasks**:
1. ✅ Introduce `status_updates` for processing notifications when operations take >30s
2. ✅ Manage typing indicators by intent/duration in `processMessageWithAI`
3. Update logging to correlate typing/paused events with responses

**Implementation**:
- Send read receipts with context ("Estoy procesando tu factura…")
- Use templated messages to avoid spam
- Track user engagement metrics

**Effort**: Low-Medium

### Wave 1 Deliverables
- Updated webhook + send helpers
- Telemetry for interactive actions & template usage
- QA via integration tests and manual device testing

---

## Wave 2 (Weeks 4-6) - Automation & External Integrations

### 4. Workflow Integrations (Google Tasks/Trello)

**Objective**: Connect to productivity tools via OpenAI function-calling.

**Tasks**:
1. Define OpenAI function-calling schema (`create_task`, `update_board_item`)
2. Build integration layer with OAuth tokens stored per user
3. Add error handling + user confirmation before committing changes

**Functions**:
```typescript
{
  name: 'create_task',
  description: 'Create a new task in Google Tasks',
  parameters: {
    title: string,
    due_date: string,
    notes?: string
  }
}
```

**Testing**: Contract tests against mocks, E2E via sandbox projects

**Effort**: Medium-High

### 5. Agent Handoffs

**Objective**: Enable escalation to human support when needed.

**Tasks**:
1. Add escalation button in interactive responses
2. Implement webhook to notify human channel (Slack/email) with conversation context
3. Provide human override dashboard or CLI to continue conversation manually

**User Flow**:
```
User → Complex issue → "Hablar con humano" button
     → Notification to support team
     → Human takes over conversation
```

**Effort**: Medium

### 6. WhatsApp Flows (Onboarding/Document Upload)

**Objective**: Design mini-forms for structured data collection within WhatsApp.

**Tasks**:
1. Prototype Flow for onboarding questionnaire and document upload
2. Persist flow session state (Supabase `flow_sessions`)
3. Define callback handlers to ingest data into existing pipelines (RAG, reminders)

**Use Cases**:
- User onboarding questionnaire
- Document upload with metadata
- Multi-step troubleshooting

**Risks & Mitigations**:
- Flow complexity → Start with scoped MVP
- CSW window limitations → Design short flows

**Effort**: High

### Wave 2 Deliverables
- Function-calling prompts + integration modules
- Escalation hook documentation & monitoring
- Flow prototypes validated with pilot users

---

## Wave 3 (Weeks 7-10) - Multimodal Intelligence & Personalization

### 7. Vision Support (GPT-4o Vision)

**Objective**: Enable image-based questions and analysis.

**Tasks**:
1. Extend media pipeline to support images (PII scrubbing, size limits)
2. Add `analyze_image` intent + prompts with citations
3. Cache insights in Supabase for future queries

**Use Cases**:
- Receipt analysis
- Whiteboard/document capture
- Product identification
- Visual troubleshooting

**Flow**: WhatsApp media → download → GPT-4o Vision → response

**Effort**: Medium

### 8. Audio Summaries

**Objective**: Auto-summarize voice notes with topic tags.

**Tasks**:
1. After transcription, run GPT summary (key points, next steps) and store metadata
2. Provide interactive button "Enviar resumen por correo" (optional)
3. Add topic/tag extraction for searchability

**Implementation**: Reuse Whisper output + GPT-4o summary

**Effort**: Low

### 9. Document Q&A Sandbox

**Objective**: Enable ad-hoc document questions without persistence.

**Tasks**:
1. Implement inline embedding generation without persistence for one-off docs
2. Toggle between sandbox vs. persisted RAG based on user preference/document size
3. Add cost monitoring for on-demand embeddings

**Use Cases**:
- Quick questions about shared documents
- One-time document analysis
- Temporary research queries

**Effort**: Medium

### 10. Function Calling for Pro Services

**Objective**: Enable autonomous task chaining with safety rails.

**Tasks**:
1. Define critical functions (`book_service`, `check_invoice`) with deterministic schemas
2. Add guardrails (validation, confirmation step) before executing side effects
3. Monitor usage & errors

**Example Functions**:
- Book service appointment
- Check invoice status
- Create support ticket
- Generate report

**Effort**: Medium-High

### 11. Personalization & Sentiment Analysis

**Objective**: Adapt responses based on user preferences and tone.

**Tasks**:
1. Create `user_profiles` table storing language, time zone, notification window
2. Inject profile data into system prompts + scheduling logic
3. Add sentiment classifier (OpenAI) to adapt tone or trigger escalation

**Schema**:
```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY,
  language VARCHAR(10) DEFAULT 'es',
  timezone VARCHAR(50) DEFAULT 'America/Mexico_City',
  notification_window JSONB,
  preferences JSONB
);
```

**Effort**: Medium

### Wave 3 Deliverables
- Vision/audio/document features live for pilot group
- Personalized prompts & sentiment-aware responses
- Documentation/playbooks for new multimodal flows

---

## Future Ideas (Post-Wave 3)

### Commerce & Monetization
- **Catalog & Cart Messages**: Leverage WhatsApp catalog/product APIs
- **Payments**: Integrate Meta Pay or Stripe Checkout
- **Service Packages**: Sell booking packages directly

### Advanced Analytics
- **Conversation Insights**: Intent distribution, latency, success outcomes
- **A/B Prompt Testing**: Rotate prompt variants, evaluate conversion
- **Feedback Loop**: Quick rating buttons after complex flows

### Reliability & Safety
- **Guardrail Functions**: Content filters using OpenAI moderation
- **Session Locking**: Prevent overlapping automation (double booking)
- **Audit Trails**: Log all external API actions with request IDs

---

## Cross-Cutting Concerns

### Compliance & Cost
- Monitor template usage against WhatsApp quotas
- Track OpenAI token consumption by feature
- Storage cost optimization for media/embeddings
- Cost per user <$2/month target

### Testing Strategy
- Expand integration/E2E test suites
- Test interactive payloads, flow callbacks, multimodal features
- Include device QA for WhatsApp versions
- Contract tests for external integrations

### Observability
- Dashboards for:
  - Interactive response usage
  - Follow-up delivery rates
  - Vision/multimodal usage
  - Sentiment triggers
  - External integration success rates

### Rollout Strategy
1. Enable features behind feature flags
2. Pilot with select users (10-20)
3. Gather feedback and metrics
4. Iterate based on data
5. Gradual rollout to all users

---

## Prioritization Framework

### Short Term (2-4 weeks) - Wave 1
1. Interactive messages ✅
2. Audio summary
3. User profiles
4. Feedback loop

### Mid Term (1-2 months) - Wave 2-3
1. WhatsApp Flows
2. Function calling with external integrations
3. Vision support
4. Catalog/commerce features

### Long Term (3+ months)
1. Payments integration
2. Advanced analytics suite
3. Proactive marketing (compliance-aware)
4. Multi-tenant features

---

## Success Metrics

### Wave 1
- Interactive message adoption: >60% of eligible conversations
- Smart follow-up delivery rate: >95%
- User satisfaction with interactive UX: >4.5/5

### Wave 2
- External integration usage: >30% of active users
- Escalation rate: <5% of conversations
- Flow completion rate: >70%

### Wave 3
- Vision feature adoption: >20% of users
- Personalization impact: +15% engagement
- Sentiment-aware escalation accuracy: >90%

---

## Implementation Notes

### Template Approvals
- Coordinate template approvals early for proactive messages
- Maintain fallback options during approval process
- Document template usage patterns for cost monitoring

### OpenAI Optimization
- Monitor usage caps when enabling vision/function calling
- Implement prompt caching where available
- Batch requests when possible

### Database Schema
- Ensure new tables inherit RLS policies
- Use `bmad-core` patterns for consistency
- Index for performance on high-traffic queries

---

## Next Actions

1. ✅ Kick off Wave 1: Interactive messages and smart follow-ups
2. Submit WhatsApp template approvals & align product copy
3. Schedule design/UX review for flows and presence messaging
4. Create success metrics dashboards
5. Define pilot user group (10-20 users)
6. Set up feature flags for gradual rollout

---

## Related Documentation

- [PRD](./prd.md) - Product requirements
- [Roadmap](../../.claude/ROADMAP.md) - Complete project timeline
- [Features](../04-features/README.md) - Current feature implementation
- [Architecture](../02-architecture/README.md) - Technical constraints

---

**Document Owner**: Product Team
**Last Review**: 2025-10-03
**Next Review**: Weekly during Wave 1
