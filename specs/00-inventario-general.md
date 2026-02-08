# SDD - Inventario General de Features

## Estado global (2026-02-08)
- `npm run typecheck`: OK
- `npm run test:unit -- --runInBand`: OK (`21 suites`, `254 passed`, `26 skipped`)
- Deploy: OK en Vercel (preview y merge a `main` completado)
- Arquitectura base: migrada a `src/modules/*` + `src/shared/*`

## Objetivo SDD de este repo
Documentar cada feature como contrato vivo para planificar, implementar y operar sin perder trazabilidad entre:
- feature -> archivos de arquitectura
- feature -> tests
- feature -> estado operativo y riesgos

## Semaforo por feature
- `GREEN`: implementado y con cobertura suficiente para operar.
- `YELLOW`: implementado, pero con gaps de cobertura/integracion/observabilidad.
- `RED`: no implementado o inestable.

| ID | Feature | Estado | Owner tecnico | Nota |
|---|---|---|---|---|
| 01 | WhatsApp Integration | GREEN | `src/shared/infra/whatsapp/*` | Base estable + v23 |
| 02 | Webhook Validation | GREEN | `src/modules/webhook/interface/*` | Seguridad critica |
| 03 | Message Processing Pipeline | GREEN | `src/modules/webhook/*` | Fire-and-forget estable |
| 04 | AI Processing Orchestration | YELLOW | `src/modules/ai/*` | Falta e2e del agente |
| 05 | Audio Transcription | YELLOW | `src/shared/infra/openai/audio-transcription.ts` | Sin e2e real |
| 06 | Cost Tracking Budget | GREEN | `src/modules/ai/domain/cost-tracker.ts` | Unit coverage OK |
| 07 | Reminders Cron | GREEN | `src/modules/reminders/*` + `app/api/cron/check-reminders/route.ts` | Flujo activo |
| 08 | Calendar Integration | YELLOW | `src/shared/infra/google/calendar.ts` | Sin e2e real |
| 09 | Memory System | YELLOW | `src/modules/ai/domain/memory.ts` | Falta suite dedicada |
| 10 | Rate Limiting | GREEN | `src/modules/webhook/domain/rate-limiter.ts` | Regresion cubierta |
| 11 | Error Recovery | GREEN | `src/shared/resilience/error-recovery.ts` | Retry + dedupe |
| 12 | Messaging Windows | YELLOW | `src/modules/messaging-window/application/service.ts` | Integraciones skip |
| 13 | WhatsApp Flows | YELLOW | `src/shared/infra/whatsapp/flows.ts` | Coverage parcial |
| 14 | Followups Actions | YELLOW | `src/modules/followups/application/service.ts` | Falta e2e |
| 15 | Health Observability | GREEN | `app/api/health/route.ts` + `src/shared/observability/logger.ts` | Operativo |
| 16 | Low Latency Intent Routing | GREEN | `src/modules/webhook/application/input-router.ts` | Routing por clase activo |
| 17 | General Image Processing | GREEN | `src/modules/ai/application/vision-pipeline.ts` | Confirmacion previa para tool inferido |
| 18 | Agentic Core Runtime (sin LangGraph) | YELLOW | `src/modules/webhook/*` + `src/modules/ai/*` | Enqueue + consumer cron inicial, falta worker completo |
| 19 | Agent Events And Run Ledger | YELLOW | `src/shared/infra/db/*` | Base durable creada (migracion+enqueue), falta consumer/runtime |
| 20 | Personalization And Memory Contract | RED | `src/modules/ai/domain/memory.ts` | Contrato en diseno, falta implementacion |
| 21 | Tool Governance And Policies | RED | `src/modules/ai/application/*` | Policy engine pendiente |
| 22 | Latency And Fast-Path Architecture | YELLOW | `src/modules/webhook/application/*` + `src/modules/ai/application/*` | SLO aplicados + violaciones medidas, falta dashboard p95 |
| 23 | Observability And E2E Readiness | RED | `src/shared/observability/*` + `tests/integration/*` | Matriz e2e/operacion pendiente |

## Bloque agéntico 2026-Q1 (18-23)
Orden recomendado de ejecucion:
1. `19-agent-events-and-ledger.md`
2. `18-agentic-core-runtime.md`
3. `22-latency-and-fastpath-architecture.md`
4. `20-personalization-memory-contract.md`
5. `21-tool-governance-and-policies.md`
6. `23-observability-and-e2e-readiness.md`

Objetivo del bloque:
- mantener experiencia de chat inmediata en texto simple
- habilitar comportamiento agéntico durable y auditable
- evitar side effects duplicados con idempotencia fuerte

## Estandar de spec por feature
Cada spec (`01..15`) debe mantener estas secciones:
1. Estado
2. Objetivo funcional
3. Arquitectura (archivos reales en `src/*` y `app/*`)
4. Contratos y flujo
5. Dependencias
6. Evidencia (tests/endpoint)
7. Riesgos y gaps
8. Siguiente incremento

## Reglas de mantenimiento
- Cada PR que cambie una feature debe actualizar su spec.
- No usar rutas legacy (`lib/*`) en specs nuevas.
- Estado semaforo se actualiza junto con evidencia de tests.
