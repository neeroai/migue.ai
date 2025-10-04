# Feature Expansion Roadmap

## Overview
Goal: ship high-impact capabilities leveraging WhatsApp interactive surfaces and OpenAI multimodality. Execution spans three waves (6–10 weeks) balancing user value, technical debt, and experimentation.

---
## Wave 1 (Weeks 1–3) – Conversational UX Foundations & Smart Follow-ups

### 1. Interactive List & Button Messages
- **Tasks**
  1. ✅ Design conversation router (intent → interactive payload) and legacy fallback text.
  2. ✅ Implement helper in `api/whatsapp/send.ts` for `interactive.list`/`interactive.button`.
  3. ✅ Extend scheduling/reminder flows to offer quick actions (“Confirmar cita”, “Editar recordatorio”).
  4. ✅ Track selections en Supabase (`conversation_actions`).
- **Risks**: unsupported clients, template approvals.
- **Mitigations**: detect capability via webhook metadata; include text fallback.

### 2. Smart Follow-ups (Utility Templates)
- **Tasks**
  1. Draft follow-up templates (confirm appointment, document status) y enviarlas a Meta (pendiente).
  2. ✅ Extend reminder cron to queue follow-up jobs using Supabase + Vercel cron.
  3. Add cost monitoring dashboard (template usage per user/day) (pendiente).
- **Dependencies**: template approval, Supabase metrics table.

### 3. Typing & Presence Enhancements
- **Tasks**
  1. ✅ Introduce `status_updates` (processing notifier + typing manager refresh) to emitir mensajes cuando >30s.
  2. ✅ Guardar por intent/duración (envío condicionado en `processMessageWithAI`).
  3. Update logging to correlate typing/paused events with responses (pendiente de métricas).

### Deliverables
- Updated webhook + send helpers.
- Telemetry for interactive actions & template usage.
- QA via integration tests (interactive payloads) and manual device testing.

---
## Wave 2 (Weeks 4–6) – Automation & External Integrations

### 4. Workflow Integrations (Google Tasks/Trello)
- **Tasks**
  1. Define OpenAI function-calling schema (`create_task`, `update_board_item`).
  2. Build integration layer with OAuth tokens stored per user.
  3. Add error handling + user confirmation before committing changes.
- **Testing**: contract tests against mocks; end-to-end via sandbox projects.

### 5. Agent Handoffs
- **Tasks**
  1. Add escalation button in interactive response.
  2. Implement webhook to notify human channel (Slack/email) with conversation context.
  3. Provide human override dash or CLI to continue conversation manually.

### 6. WhatsApp Flows (Onboarding / Document Upload)
- **Tasks**
  1. Prototype Flow for onboarding questionnaire and document upload.
  2. Persist flow session state (Supabase `flow_sessions`).
  3. Define callback handlers to ingest data into existing pipelines (RAG, reminders).
- **Risks**: flow complexity, CSW window; mitigate with scoped MVP.

### Deliverables
- Function-calling prompts + integration modules.
- Escalation hook documentation & monitoring.
- Flow prototypes validated with pilot users.

---
## Wave 3 (Weeks 7–10) – Multimodal Intelligence & Personalization

### 7. Vision Support (GPT-4o Vision)
- **Tasks**
  1. Extend media pipeline to support images (PII scrubbing, size limits).
  2. Add `analyze_image` intent + prompts with citations.
  3. Cache insights in Supabase for future queries.

### 8. Audio Summaries
- **Tasks**
  1. After transcription, run GPT summary (key points, next steps) and store metadata.
  2. Provide interactive button “Enviar resumen por correo” (optional).

### 9. Document Q&A Sandbox
- **Tasks**
  1. Implement inline embedding generation without persistence for ad-hoc docs.
  2. Toggle between sandbox vs. persisted RAG depending on user preference/size.

### 10. Function Calling for Pro Services
- **Tasks**
  1. Define critical functions (book_service, check_invoice) with deterministic schemas.
  2. Add guardrails (validation, confirmation step) before executing side effects.
  3. Monitor usage & errors.

### 11. Personalization & Sentiment
- **Tasks**
  1. Create `user_profiles` table storing language, time zone, notification window.
  2. Inject profile data into system prompts + scheduling logic.
  3. Add sentiment classifier (OpenAI) to adapt tone or trigger escalation.

### Deliverables
- Vision/audio/document features live for pilot group.
- Personalized prompts & sentiment-aware responses.
- Documentation/playbooks for new multimodal flows.

---
## Cross-Cutting Concerns
- **Compliance & Cost**: monitor template usage, OpenAI tokens, storage costs.
- **Testing**: expand integration/e2e suites (interactive payloads, flow callbacks, multimodal). Include device QA.
- **Observability**: dashboards for interactive responses, follow-ups, vision usage, sentiment triggers.
- **Rollout Strategy**: enable features behind flags, pilot with select users, gather feedback, iterate.

---
## Next Actions
1. Kick off Wave 1 by grooming tickets for interactive messages and smart follow-ups.
2. Secure WhatsApp template approvals & align product copy.
3. Schedule design/UX review for flows and presence messaging.
4. Create success metrics (conversion lift, task completion rate, NPS for multimodal).
