# 18 - Agentic Core Runtime (Sin LangGraph)

## Estado
- Semaforo: `RED`
- Fecha: `2026-02-08`
- Owner tecnico: `src/modules/webhook/*` + `src/modules/ai/*`

## Objetivo funcional
Evolucionar el asistente de un flujo reactivo por webhook a un runtime agéntico persistente que pueda:
- percibir entrada
- planear accion
- ejecutar tools
- validar resultado
- responder al usuario
- aprender memoria util

Todo sin romper la latencia del camino rapido para texto simple.

## Alcance
- Runtime agéntico sin LangGraph.
- Separacion control plane/data plane.
- Loop por `conversation_id` con estado durable en Supabase.
- Checkpoints y reintentos idempotentes.

## No alcance
- Multi-canal (email, webchat, etc).
- Dashboard UI nuevo.
- Agente totalmente autonomo sin confirmaciones.

## Arquitectura objetivo
### Control plane (Vercel)
- Entrada webhook (`app/api/whatsapp/webhook/route.ts`).
- Validacion y dedupe inicial.
- ACK rapido (<150ms p95).
- Encolado de evento a Supabase (`agent_events`).

### Data plane (Worker agéntico)
- Consume eventos pendientes por conversacion.
- Ejecuta run state machine.
- Orquesta tools y validaciones.
- Persiste pasos/resultado.
- Envia respuesta por adaptador WhatsApp.

## State machine del run
Estados permitidos:
- `queued`
- `running`
- `waiting_confirmation`
- `completed`
- `failed`
- `dead_letter`

Transiciones:
1. `queued -> running`
2. `running -> waiting_confirmation` (accion medium/high-risk)
3. `waiting_confirmation -> running` (usuario confirma)
4. `running -> completed`
5. `running -> failed`
6. `failed -> queued` (retry con politica)
7. `failed -> dead_letter` (max retries)

## Loop agéntico por turno
1. `ingest`: normalizar input.
2. `classify`: `TEXT_SIMPLE | TEXT_TOOL_INTENT | RICH_INPUT | STICKER_STANDBY | UNSUPPORTED`.
3. `load_context`: historial corto + memoria relevante + profile.
4. `plan`: responder directo o usar tool.
5. `act`: ejecutar tool(s) con timeout y retry.
6. `verify`: validar resultado de negocio.
7. `respond`: construir respuesta final WhatsApp.
8. `learn`: guardar memoria/facts y cerrar run.

## Contratos publicos internos
- `POST /internal/agent/events`
- `GET /internal/agent/runs/:runId`
- `POST /internal/agent/runs/:runId/retry`
- `POST /internal/agent/runs/:runId/confirm`

## Dependencias
- Supabase (colas/ledger/memoria)
- WhatsApp Cloud API
- AI provider actual (gateway)

## SLO/SLA
- Webhook ACK: `<150ms p95`.
- Typing start: `<300ms p95`.
- `TEXT_SIMPLE` end-to-end: `<2000ms p95`.
- `TEXT_TOOL_INTENT`: `<4000ms p95`.

## Riesgos
- Competencia entre workers en misma conversacion.
- Duplicidad de side effects en retries.
- Degradacion de latencia por contexto excesivo.

## Criterio de salida a YELLOW
1. State machine implementada con persistencia.
2. Retry idempotente funcional.
3. Integracion con webhook via event enqueue.
4. Metricas base operativas por estado de run.
