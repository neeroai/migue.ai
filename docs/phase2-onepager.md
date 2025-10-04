# Phase 2 Core Features – Problem One-Pager

## Context
migue.ai already handles text intents with GPT-4o via Vercel Edge Functions, stores session context in Supabase, and ships a 39-test Jest suite covering webhook schemas. Users increasingly share voice notes, expect calendar-aware scheduling, rely on reminders, and want quick answers from PDFs. Current implementation lacks production-grade support for audio transcription, calendar sync, reminder automation, retrieval-augmented answers, and GPT-4o streaming.

## Problem
Without these capabilities the assistant produces high-latency fallbacks, misses appointment automation, cannot surface document knowledge, and fails SLA targets for multimodal support. This limits user retention (<70% D30), increases manual operator intervention, and keeps WhatsApp session costs high due to re-engagement templates.

## Objective
Deliver Phase 2 features that extend the core assistant within four weeks:
- Whisper-driven transcription for WhatsApp audio.
- Google Calendar integration for scheduling.
- Automated reminder processing via cron.
- Lightweight RAG for uploaded documents.
- GPT-4o streaming responses on Edge.
Meet latency <=2s and coverage >=80% on touched modules.

## Non-Objectives
- Building a web dashboard or admin UI.
- Supporting non-Google calendar systems (handled in Phase 3).
- Implementing advanced agent autonomy beyond basic scheduling.
- Replacing existing intent classification pipeline.

## Constraints
- Must run inside Vercel Edge runtime (ES modules, fetch-only APIs, 50ms CPU budget per invocation).
- Supabase RLS and `.bmad-core/` constraints must remain intact.
- WhatsApp audio up to 16MB, with response SLA <2 seconds.
- Secrets managed via Vercel env; no persistent filesystem writes.
- Tests must be deterministic and run via `npm run test` + Playwright e2e.

## Options Considered

### Option A – Expand existing Edge function logic incrementally
Pros: Minimal architectural change, reuses `lib/openai.ts` and webhook plumbing, faster delivery.
Cons: Risk of bloated handlers (>300 LOC) and duplicated side-effect handling.
Risks: Harder to test; latency spikes if transcription blocks main handler.

### Option B – Introduce dedicated service modules per capability (audio, calendar, rag)
Pros: Keeps handlers thin, isolates side effects, improves testability.
Cons: More files to manage, upfront refactor cost.
Risks: Requires rigorous module boundaries to avoid dependency cycles.

**Chosen Approach:** Option B to preserve clean boundaries and meet code size limits while allowing parallel iteration on each capability.

## KPIs & Validation
- Audio transcription success rate ≥95% on sampled WA notes.
- Calendar sync latency <1.5s from intent to booking confirmation.
- Reminder cron delivers within scheduled minute, with <1% failure retries.
- RAG answers include citation metadata in >80% of responses.
- Streaming responses reduce average perceived latency by 40%.

## Open Questions
- Need confirmation on Google OAuth redirect host for prod vs staging.
- Clarify storage retention policy for raw audio files post-transcription.
- Determine acceptable fallbacks when streaming is interrupted by rate limits.
