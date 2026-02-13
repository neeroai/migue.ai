---
title: "Task List"
date: "2026-02-06 23:30"
updated: "2026-02-12 20:43"
---

# Task List

## In Progress

- [ ] Keep applying `tracking:compact` after heavy documentation sessions
- [ ] Cerrar gap E2E de `specs/04-ai-processing-orchestration.md` para mover semáforo a GREEN
- [ ] Reducir mocking en E2E de reminders para cubrir orquestación real (sin mock de `createProactiveAgent`)

## Pending

- [ ] Keep new tracking updates within compact format on future tasks
- [ ] Validate SLA thresholds in production (`TEXT_SIMPLE` p95, typing start, rich timeout rate)
- [ ] Add integration test for `toolIntentDetected` from image/document flow
- [ ] Define PII redaction policy for `ID_FORM` visual class

## Completed (Recent)

- [x] Intensificar proactividad del agente: cron horario, intervalo 2h, tope diario 6 y horizonte 20h (2026-02-12 14:51)
- [x] Aislar tests de WhatsApp Flows (`test:unit:flows`) y agregar fallback de respuesta cuando `sendFlow` falla/lanza excepción (2026-02-12 18:51)
- [x] Aislar modo de comandos Flow en runtime normal con feature flag opt-in (`FLOW_TEST_MODE_ENABLED`) (2026-02-12 18:56)
- [x] Implementar capa SOUL + personalización local por ciudad (Barranquilla/Bogotá/Medellín) con guardrails anti-robot (2026-02-12 20:10)
- [x] Endurecer fallback SOUL para aperturas sociales y respuestas vacías (`buildHumanFallbackResponse`) (2026-02-12 20:42)

- [x] Implement keyword-triggered Flow QA mode (`flow test <name>`) with mock payloads in webhook pipeline (2026-02-12 11:20)
- [x] Add real Meta Flow JSON validation/publish CLI (`scripts/wa-flows-validate.mjs`) plus docs/commands (2026-02-12 12:10)
- [x] Add tracking governance playbook in `docs/tracking-best-practices.md` (2026-02-12 07:55)
- [x] Migrar mensajes de onboarding/reminders a generación LLM-first con fallback seguro (2026-02-12 06:23)
- [x] Update `CLAUDE.md` to current architecture and tracking contract (2026-02-12 07:58)
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

## Blocked

(none)
