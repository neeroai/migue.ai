---
title: "Architecture Decisions"
summary: "ADR log for architecture decisions with rationale and consequences"
description: "Compact decision records for migue.ai"
version: "1.1"
date: "2026-02-06 23:30"
updated: "2026-02-12 03:15"
---

# Architecture Decisions

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

## ADR-011: Automated Tracking Compaction Command

**Date**: 2026-02-07 15:43  
**Status**: Approved  
**Deciders**: User request ("procedamos")

### Decision

- Add `scripts/compact-tracking-files.mjs` to compact `.claude` tracking files automatically.
- Add `npm run tracking:compact` to standardize compaction execution.
- Keep compaction idempotent and compatible with `npm run check:tracking`.

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

## ADR-009: WhatsApp Skill Baseline Upgrade to v24.0

**Date**: 2026-02-07 15:25  
**Status**: Approved

### Decision

- Update `whatsapp-api-expert` skill baseline from v23.0 to v24.0.
- Keep compatibility guidance for repositories still pinned to older versions.

## Historical ADR Summary (ADR-001 to ADR-008)

- ADR-001: Introduced mandatory tracking files in `.claude`.
- ADR-002/003: Proposed latency optimizations via caching and parallel API calls.
- ADR-004: Documented WhatsApp API constraints for implementation safety.
- ADR-005/006/007: Iterated CLAUDE.md strategy to reduce redundancy.
- ADR-008: Standardized AI Gateway routing with Gemini fallback.

## Maintenance Rule

When ADR count approaches the guardrail, collapse older full ADRs into this historical summary block.
