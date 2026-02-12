# Tracking Between Sessions - Best Practices

This guide defines how to keep project context stable across coding sessions without turning tracking files into noisy logs.

## 1) Operating Principles

- Keep a single source of truth per tracking file.
- Prefer short, current, actionable entries over long historical narratives.
- Update tracking in the same PR/session where behavior changes.
- Every important claim should be traceable to evidence (file path, test, migration, commit, or PR).
- Compact regularly: preserve recent detail, summarize old activity.

## 2) Source-of-Truth Map

Use each file for one purpose only:

- `.claude/session.md`: session handoff (what happened, what is next, blockers, commands used).
- `.claude/status.md`: current project state (KPIs, active risks, current focus).
- `.claude/todo.md`: operational backlog (in progress, pending, recently completed).
- `.claude/decisions.md`: architecture/product decisions (ADR-style records + consequences).
- `.claude/CHANGELOG.md`: detailed internal engineering change history.
- `CHANGELOG.md`: user-facing/project-facing noteworthy changes.

Do not duplicate the same full entry across multiple tracking files.

## 3) Session Lifecycle

At session start:

1. Read `.claude/status.md`, `.claude/todo.md`, and the last section of `.claude/session.md`.
2. Confirm current objective and open risks.
3. Create/refresh the active session section in `.claude/session.md`.

During execution:

1. Log only meaningful milestones (decision, implementation, validation, blocker).
2. Add evidence links (exact file path and command or test run).
3. Move tasks between `Pending`, `In Progress`, and `Completed` in `.claude/todo.md`.

At session close:

1. Update `.claude/status.md` with the new current state.
2. Record decisions/tradeoffs in `.claude/decisions.md` if behavior/architecture changed.
3. Add relevant entries to `CHANGELOG.md` and `.claude/CHANGELOG.md`.
4. Run `npm run check:tracking`; if needed, run `npm run tracking:compact`.

## 4) Entry Quality Standard

Each entry should include:

- Date/time (`YYYY-MM-DD HH:MM`, local or UTC, consistent within file).
- Action verb (`Implement`, `Validate`, `Decide`, `Fix`, `Document`).
- Scope (feature/module).
- Evidence (file path and/or command/test).
- Outcome (`Complete`, `Partial`, `Blocked`) when applicable.

Avoid:

- Long raw logs.
- Repeated context copied across files.
- Vague statements without evidence ("fixed performance" without measurement).

## 5) Cadence and Guardrails

- After every meaningful coding session: update tracking files.
- Weekly (or after heavy doc sessions): run `npm run tracking:compact`.
- Before merge/release: run `npm run check:tracking`.

Hard limits and anti-accumulation checks are enforced by `scripts/check-tracking-files.mjs`.

## 6) Minimal Closing Checklist

- [ ] Updated `.claude/session.md` with latest operations and resume notes.
- [ ] Updated `.claude/todo.md` task state.
- [ ] Updated `.claude/status.md` if project state changed.
- [ ] Updated `.claude/decisions.md` for significant decisions.
- [ ] Updated changelog(s) for relevant behavior/code changes.
- [ ] Ran `npm run check:tracking`.

## 7) Suggested PR Discipline

If a PR changes behavior, include tracking updates in the same PR:

- code + tests + tracking + changelog

This keeps historical context aligned with implementation reality.
