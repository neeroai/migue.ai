# SDD - Inventario General (Alineado a Architecture Master v1.0.0)

## Estado
- Semáforo: `YELLOW`
- Fase: `in_progress`
- Next Step: Consolidar el maestro autogenerado y mantener sincronía continua con `specs/*.md`.
- Updated: 2026-02-12 03:30

## Estado global
- Arquitectura fuente de verdad: `architecture.md`
- Principio rector: `LLM-first` + backend como guardrail
- Stack: `Vercel + Supabase`, multimodelo/multimodal

## Semáforo por feature
| ID | Feature | Estado | Owner técnico | Nota de alineación |
|---|---|---|---|---|
| 01 | WhatsApp Integration | GREEN | `src/shared/infra/whatsapp/*` | Ingress estable |
| 02 | Webhook Validation | GREEN | `src/modules/webhook/interface/*` | Seguridad y ACK rápido |
| 03 | Message Processing Pipeline | GREEN | `src/modules/webhook/*` | Persistencia + dedupe |
| 04 | AI Processing Orchestration | YELLOW | `src/modules/ai/*` | En transición a LLM-first puro |
| 05 | Audio Transcription | YELLOW | `src/shared/infra/openai/audio-transcription.ts` | Falta e2e extendido |
| 06 | Cost Tracking Budget | GREEN | `src/modules/ai/domain/cost-tracker.ts` | Control de presupuesto activo |
| 07 | Reminders Cron | GREEN | `src/modules/reminders/*` | Operativo |
| 08 | Calendar Integration | YELLOW | `src/shared/infra/google/calendar.ts` | Falta e2e real |
| 09 | Memory System | YELLOW | `src/modules/ai/domain/memory.ts` | Integrado, falta madurez e2e |
| 10 | Rate Limiting | GREEN | `src/modules/webhook/domain/rate-limiter.ts` | Cobertura sólida |
| 11 | Error Recovery | GREEN | `src/shared/resilience/error-recovery.ts` | Retry/dedupe activo |
| 12 | Messaging Windows | YELLOW | `src/modules/messaging-window/application/service.ts` | Integración parcial |
| 13 | WhatsApp Flows | YELLOW | `src/shared/infra/whatsapp/flows.ts` | Cobertura parcial |
| 14 | Followups Actions | YELLOW | `src/modules/followups/application/service.ts` | Falta e2e |
| 15 | Health Observability | GREEN | `app/api/health/route.ts` | Operativo |
| 16 | Low Latency Intent Routing | GREEN | `src/modules/webhook/application/input-router.ts` | Enrutamiento estable |
| 17 | General Image Processing | GREEN | `src/modules/ai/application/vision-pipeline.ts` | Flujo activo con confirmación |
| 18 | Agentic Core Runtime | YELLOW | `src/modules/agent/*` | Runtime durable parcial |
| 19 | Agent Events And Run Ledger | YELLOW | `src/modules/agent/infra/*` | Base durable activa |
| 20 | Personalization And Memory Contract | YELLOW | `src/modules/ai/domain/memory.ts` | Read/write policy por pathway |
| 21 | Tool Governance And Policies | GREEN | `src/modules/ai/application/tool-governance.ts` | Policy `confirm/allow/deny` validada en producción |
| 22 | Latency And Fast-Path Architecture | YELLOW | `src/modules/webhook/*` + `src/modules/ai/*` | SLO medidos, falta dashboard externo |
| 23 | Observability And E2E Readiness | YELLOW | `src/shared/observability/*` + `tests/integration/*` | E2E base + runbook |
| 24 | LLM-First Multimodel Runtime | GREEN | `src/modules/ai/*` | Runtime LLM-first y flujo rich input validados en producción |
| 25 | User Signup Onboarding Flow | YELLOW | `src/shared/infra/whatsapp/flows.ts` + `src/modules/webhook/*` | MVP definido para captura `name+email` |
| 27 | Web Search Tool Runtime | GREEN | `src/modules/ai/application/proactive-agent.ts` + `src/modules/ai/application/tool-governance.ts` | Tool web_search activa por flag con preferencia Gemini para consultas web |

## Referencias obligatorias
- `architecture.md`
- `docs/architecture-master-v1.md`
- `docs/model-capability-catalog.v1.json`

## Regla de mantenimiento
Toda PR que cambie arquitectura/flujo debe actualizar su spec y este inventario.
