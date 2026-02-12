---
title: "Architecture Decisions"
summary: "ADR log for architecture decisions with rationale and consequences"
description: "Compact decision records for migue.ai"
version: "1.1"
date: "2026-02-06 23:30"
updated: "2026-02-12 14:51"
---

# Architecture Decisions

## ADR-020: Intensify Proactive Messaging Cadence for Window Maintenance

**Date**: 2026-02-12 14:51  
**Status**: Approved  
**Deciders**: User request ("aumentar la proactividad del agente")

### Decision

- Increase proactive frequency guardrails in src/modules/messaging-window/application/service.ts:
  - MIN_INTERVAL_HOURS: 4 -> 2
  - MAX_PROACTIVE_PER_DAY: 4 -> 6
- Increase proactive targeting horizon in app/api/cron/maintain-windows/route.ts:
  - findWindowsNearExpiration(20) via PROACTIVE_SCAN_HOURS = 20
- Increase cron execution frequency in vercel.json:
  - /api/cron/maintain-windows: 0 0,12-23 * * * (hourly during Bogota business window)
- Update health endpoint schedule metadata in app/api/cron/health/route.ts to reflect hourly cadence.

### Consequences

**Positive**:
- More frequent and earlier proactive touchpoints.
- Better chance to keep conversations active before the 24h window closes.

**Tradeoff**:
- Higher outbound volume and token cost.
- Higher user-fatigue risk mitigated by existing checks (business hours, user activity, daily cap, min interval).

## ADR-019: Real Meta Validation Gate for Flow JSON

**Date**: 2026-02-12 12:10  
**Status**: Approved  
**Deciders**: User request (validar `.json` con validador real de Meta, no solo estructura local)

### Decision

- Keep `npm run flows:validate` as local structural lint only.
- Add `scripts/wa-flows-validate.mjs` and npm commands:
  - `flows:validate:meta`
  - `flows:publish:meta`
- Enforce release flow where Flow JSON must pass Graph-side validation (`validation_errors`) before publish.

### Consequences

**Positive**:
- Validation now depends on real Meta parser/runtime rules.
- Lower risk of false confidence from local-only checks.
- Reproducible CLI workflow for QA and release.

**Tradeoff**:
- Requires valid Graph token/permissions and network access.
- Validation errors now depend on external platform availability.

## ADR-018: Keyword-Gated Flow QA Mode with Mock Payloads

**Date**: 2026-02-12 11:20  
**Status**: Approved  
**Deciders**: User request (probar todos los flows por palabra clave)

### Decision

- Add `src/modules/flow-testing/application/service.ts` to parse commands like `flow test transfer` and send corresponding WhatsApp Flow with `initialData` mock payloads.
- Integrate command handler into `src/modules/webhook/application/background-processor.ts` before onboarding gate and normal AI orchestration.
- Keep behavior environment-gated via `FLOW_TEST_MODE_ENABLED` (default enabled outside production, disabled in production unless explicit override).

### Consequences

**Positive**:
- Fast QA path to validate screen routing and placeholders for all flow variants.
- No impact on normal conversations unless explicit command is sent.
- No additional environment variables are required for private QA usage.

**Tradeoff**:
- Flow IDs are hardcoded in code and must be updated by deploy if they change.
- Requires Meta-published `flow_id` alignment for each test flow.

## ADR-017: LLM-First User-Facing Messaging for Signup Lifecycle and Reminder Delivery

**Date**: 2026-02-12 06:23  
**Status**: Approved  
**Deciders**: User request (evitar respuestas robóticas y silencios en onboarding/reminders)

### Decision

- Introduce `src/shared/infra/ai/agentic-messaging.ts` as a centralized LLM-first copy generator with strict fallback.
- Use this generator in:
  - onboarding gate responses (`flow_sent`, `already_in_progress`, `flow_send_failed`)
  - post-signup welcome message
  - cron reminder delivery text
- Keep deterministic fallback text for resiliency (timeouts/key missing/provider failure).

### Consequences

**Positive**:
- More natural user-facing tone aligned with agentic architecture.
- Reduced rigid/template-like messages in critical lifecycle touchpoints.
- No operational regression when LLM generation is unavailable.

**Tradeoff**:
- Slight extra latency and token spend on onboarding/reminder messages.

## ADR-016: Resume Execution From Master Tracker Priority Queue

**Date**: 2026-02-12 04:14  
**Status**: Approved  
**Deciders**: User request ("actualicemos todos los archivos de tracking y retomemos por donde ibamos")

### Decision

- Use `just resume` output (`RED > YELLOW > GREEN`) as the canonical startup queue.
- Start execution from top `YELLOW` specs, beginning with `specs/04-ai-processing-orchestration.md`.
- Keep handoff/checkpoint updated at each session close via `just close-session`.

### Consequences

**Positive**:
- Deterministic session startup with no full repo re-read.
- Work sequencing aligned to the master tracker contract.

**Tradeoff**:
- Requires discipline in keeping `Next Step` actionable in each `YELLOW/RED` spec.

## ADR-015: Session Continuity System With `just` + Autogenerated Master Tracker

**Date**: 2026-02-12 03:59  
**Status**: Approved  
**Deciders**: User request ("PLEASE IMPLEMENT THIS PLAN")

### Decision

- Adopt `just` as operational runner for session continuity commands.
- Introduce `.claude/handoff.md` as mandatory short-form session checkpoint.
- Autogenerate `docs/master-tracker.md` from `specs/*.md` with required fields:
  - `Semáforo`, `Fase`, `Next Step`, `Updated`
- Enforce continuity via `pre-commit` and `scripts/check-tracking-files.mjs`.

### Consequences

**Positive**:
- Faster session startup without re-reading the full codebase.
- Enforceable continuity contract at commit time.
- Single operational dashboard derived from specs.

**Tradeoff**:
- Requires `just` installation in contributor environments.

## ADR-014: CI Guardrail for Tracking Updates on Critical PR Changes

**Date**: 2026-02-12 03:13  
**Status**: Approved  
**Deciders**: User request ("procedamos")

### Decision

- Add `tracking-guardrail` job in `.github/workflows/ci.yml`.
- On pull requests, if files under `app/api/`, `src/modules/`, or `supabase/migrations/` change, require updates in at least one tracking/changelog file:
  - `.claude/session.md`
  - `.claude/status.md`
  - `.claude/todo.md`
  - `.claude/decisions.md`
  - `CHANGELOG.md`

### Consequences

**Positive**:
- Reduces drift between implementation and tracking artifacts.
- Makes tracking updates enforceable at review time.

**Tradeoff**:
- PRs with critical changes now have stricter documentation expectations.

## ADR-013: Tracking Governance Contract + PR Checklist

**Date**: 2026-02-12 08:05  
**Status**: Approved  
**Deciders**: User request ("procedamos e implementemos")

### Decision

- Add central tracking operations guide: `docs/tracking-best-practices.md`.
- Align `CLAUDE.md` and `AGENTS.md` with:
  - single-source responsibility by tracking file
  - session lifecycle (start/during/close)
  - minimum evidence standard per entry
- Add PR template checklist in `.github/pull_request_template.md` to enforce tracking updates in behavior-changing PRs.

### Consequences

**Positive**:
- Better continuity between sessions.
- Lower drift across tracking files.
- Clearer review gate for operational documentation quality.

**Tradeoff**:
- Slightly higher PR overhead due to mandatory checklist updates.

## ADR-012: Replace Local OCR With Multimodal Vision Pipeline

**Date**: 2026-02-07 16:41  
**Status**: Approved  
**Deciders**: User request ("procedamos con la migracion completa")

### Decision

- Remove `tesseract.js` OCR path for `image/document`.
- Add `vision-pipeline` with:
  - lightweight class detection
  - multimodal extraction/response in one call
  - optional delegation to tool-intent text pathway
- Keep existing rich-input timeout and progress messaging in orchestrator.

### Consequences

**Positive**:
- Better quality for non-document images.
- Better deploy/runtime compatibility by avoiding local OCR runtime variance.
- Cleaner architecture for future multimodal extensions.

**Tradeoff**:
- Cost depends on multimodal token usage.

## ADR-010: Tracking Files Compact-First Policy

**Date**: 2026-02-07 15:38  
**Status**: Approved  
**Deciders**: User request + implementation validation

### Context

Tracking files in `.claude` were within hard limits but too accumulative for fast session resume.

### Decision

- Adopt compact-first policy: keep recent details, summarize older content.
- Tighten size limits in `scripts/check-tracking-files.mjs`.
- Add anti-accumulation checks:
  - max detailed sessions in `session.md`
  - max completed items in `todo.md`
  - max full ADR entries in `decisions.md`
  - max dated detailed entries in `.claude/CHANGELOG.md`
- Update `AGENTS.md` with explicit compaction rules.

### Consequences

**Positive**:
- Faster restart context for future sessions.
- Less duplication across tracking files.
- Automated guardrails prevent growth drift.

**Tradeoff**:
- Deep historical detail moves out of tracking files when needed.

## Historical ADR Summary (ADR-001 to ADR-008)

- ADR-001: Introduced mandatory tracking files in `.claude`.
- ADR-002/003: Proposed latency optimizations via caching and parallel API calls.
- ADR-004: Documented WhatsApp API constraints for implementation safety.
- ADR-005/006/007: Iterated CLAUDE.md strategy to reduce redundancy.
- ADR-008: Standardized AI Gateway routing with Gemini fallback.
- ADR-009: Updated `whatsapp-api-expert` skill baseline from v23.0 to v24.0.

## Maintenance Rule

When ADR count approaches the guardrail, collapse older full ADRs into this historical summary block.

