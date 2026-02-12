---
title: "Task List"
date: "2026-02-06 23:30"
updated: "2026-02-12 12:08"
---

# Task List

## In Progress

- [ ] Keep applying `tracking:compact` after heavy documentation sessions
- [ ] Cerrar gap E2E de `specs/04-ai-processing-orchestration.md` para mover semáforo a GREEN

## Pending

- [ ] Keep new tracking updates within compact format on future tasks
- [ ] Validate SLA thresholds in production (`TEXT_SIMPLE` p95, typing start, rich timeout rate)
- [ ] Add integration test for `toolIntentDetected` from image/document flow
- [ ] Define PII redaction policy for `ID_FORM` visual class

## Completed (Recent)

- [x] Update `AGENTS.md` with source-of-truth and session checklist policy (2026-02-12 08:00)
- [x] Recover `npm run typecheck` by clearing stale `tsconfig.tsbuildinfo` cache (2026-02-12 08:04)
- [x] Add `.github/pull_request_template.md` tracking checklist (2026-02-12 08:05)
- [x] Rebase and push tracking governance commit to `origin/main` (2026-02-12 03:12)
- [x] Add PR CI guardrail for tracking updates on critical paths (2026-02-12 03:13)
- [x] Implement session continuity system with `just` runner and guardrails (2026-02-12 03:59)
- [x] Install `just` locally and validate recipes (`resume`, `sync-master`, `check-tracking`) (2026-02-12 04:12)
- [x] Replace local OCR with multimodal vision pipeline (`vision-pipeline`) (2026-02-07 16:41)
- [x] Add SDD spec `specs/17-general-image-processing.md` (2026-02-07 16:36)
- [x] Remove `tesseract.js` dependency (2026-02-07 16:40)
- [x] Close v24 runtime migration task as not planned (keep runtime in v23) (2026-02-07 15:49)
- [x] Add `scripts/compact-tracking-files.mjs` and `npm run tracking:compact` (2026-02-07 15:43)
- [x] Implement stricter `check:tracking` limits and anti-accumulation rules (2026-02-07 15:37)
- [x] Compact `.claude/session.md` with resumable format (2026-02-07 15:38)
- [x] Compact `.claude/status.md` with current-state focus (2026-02-07 15:38)
- [x] Compact `.claude/decisions.md` preserving key ADRs + summary (2026-02-07 15:38)
- [x] Compact `.claude/CHANGELOG.md` to recent changes + historical summary (2026-02-07 15:38)
- [x] Implementar `web_search` con `WEB_SEARCH_ENABLED` + preferencia `gemini-2.5-flash-lite` + validación `typecheck`/`test:unit` (2026-02-12 11:10)
- [x] Corregir fallback repetitivo de `web_search` cuando el tool result llega como objeto (2026-02-12 11:53)
- [x] Endurecer prompt y fallback parser para evitar respuestas vacías/genéricas tras `web_search` (2026-02-12 12:08)

## Blocked

(none)
