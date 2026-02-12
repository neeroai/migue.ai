---
title: "Task List"
date: "2026-02-06 23:30"
updated: "2026-02-12 08:05"
---

# Task List

## In Progress

- [ ] Keep applying `tracking:compact` after heavy documentation sessions

## Pending

- [ ] Keep new tracking updates within compact format on future tasks
- [ ] Validate SLA thresholds in production (`TEXT_SIMPLE` p95, typing start, rich timeout rate)
- [ ] Add integration test for `toolIntentDetected` from image/document flow
- [ ] Define PII redaction policy for `ID_FORM` visual class
- [ ] Add PR template checklist usage to team routine (enforce in reviews)

## Completed (Recent)

- [x] Add tracking governance playbook in `docs/tracking-best-practices.md` (2026-02-12 07:55)
- [x] Update `CLAUDE.md` to current architecture and tracking contract (2026-02-12 07:58)
- [x] Update `AGENTS.md` with source-of-truth and session checklist policy (2026-02-12 08:00)
- [x] Recover `npm run typecheck` by clearing stale `tsconfig.tsbuildinfo` cache (2026-02-12 08:04)
- [x] Add `.github/pull_request_template.md` tracking checklist (2026-02-12 08:05)
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
- [x] Update `whatsapp-api-expert` baseline from v23.0 to v24.0 (2026-02-07 15:25)

## Blocked

(none)
