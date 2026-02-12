---
title: "Internal Tracking Changelog"
date: "2026-02-03 06:00"
updated: "2026-02-12 03:15"
version: "1.1"
scope: "Tracking and process notes"
---

# .claude CHANGELOG

## [Unreleased]

### Changed - 2026-02-12 03:13

- Rebased and pushed tracking governance commit to `origin/main`.
- Added PR-only CI guardrail in `.github/workflows/ci.yml` to require tracking/changelog updates on critical path changes.

### Changed - 2026-02-12 08:05

- Added `docs/tracking-best-practices.md` as single operational source for cross-session tracking.
- Updated `CLAUDE.md` and `AGENTS.md` with tracking contract, cadence, and evidence standards.
- Added `.github/pull_request_template.md` with mandatory tracking checklist for behavior-changing work.
- Revalidated tracking guardrails via `npm run check:tracking`.
- Recovered `npm run typecheck` by clearing stale `tsconfig.tsbuildinfo` cache.

### Changed - 2026-02-07 16:41

- Replaced local `tesseract.js` OCR path with multimodal `vision-pipeline`.
- Added `specs/17-general-image-processing.md` with status and rollout criteria.
- Added unit tests for visual input classification.
- Removed `tesseract.js` dependency from project.

### Changed - 2026-02-07 15:43

- Added `scripts/compact-tracking-files.mjs` for automatic tracking compaction.
- Added `npm run tracking:compact` in `package.json`.
- Verified compaction + `npm run check:tracking` in sequence.

### Changed - 2026-02-07 15:38

- Tightened tracking size limits in `scripts/check-tracking-files.mjs`.
- Added anti-accumulation checks for session, todo, decisions, and internal changelog files.
- Updated `AGENTS.md` with explicit compact tracking policy.
- Compacted `.claude/session.md`, `.claude/status.md`, `.claude/todo.md`, `.claude/decisions.md`, and `.claude/CHANGELOG.md`.

### Changed - 2026-02-07 15:25

- Updated `whatsapp-api-expert` skill guidance baseline from v23.0 to v24.0.

### Changed - 2026-02-07 12:15

- Completed AI Gateway migration notes and related tracking updates.

## Historical Summary (before 2026-02-07 12:00)

- Initial tracking system was created and expanded quickly.
- Multiple broad documentation sessions were logged in detail.
- Internal changelog became too verbose for operational use.
- Current policy shifts this file to concise operational deltas only.
