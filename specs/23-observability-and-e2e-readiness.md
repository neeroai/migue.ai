# 23 - Observability And E2E Readiness

## Estado
- Semaforo: `YELLOW`
- Fecha: `2026-02-08`
- Owner tecnico: `src/shared/observability/*` + `tests/integration/*`

## Objetivo funcional
Tener evidencia operativa y de pruebas suficiente para liberar el core agéntico sin regressions silenciosas.

## Observabilidad minima
### Logs estructurados obligatorios
- `request_id`
- `user_id`
- `conversation_id`
- `event_id`
- `run_id`
- `input_class`
- `pathway`
- `tool_name` (si aplica)
- `latency_ms`
- `outcome`

### Metricas
- Latencia por ruta (`text_fast_path`, `tool_intent`, `rich_input`)
- Tasa de error por tool
- Retry rate
- Dead-letter count
- Memory hit ratio
- Coste por run/usuario

### SLO de release
- Error end-to-end < `1.5%`
- Duplicados de side effects = `0`
- p95 texto simple < `2s`

## Matriz E2E requerida
1. Texto simple conversacional.
2. Tool intent (recordatorio/gasto/cita).
3. Rich image con intencion inferida -> confirmacion previa.
4. Audio -> transcripcion -> respuesta.
5. Falla provider -> fallback controlado.
6. Doble webhook mismo `wa_message_id` -> no duplicar efectos.

## Entorno de pruebas
- `test:unit` (rapido, bloqueante)
- `test:integration` (contratos entre capas)
- `test:e2e` (flujo webhook->run->tool->respuesta)

## Criterio de paso a GREEN (features 18-23)
1. 10+ escenarios e2e estables.
2. 3 corridas consecutivas sin flakes.
3. Evidencia de metrica en preview/prod.
4. Runbook de incidentes y rollback validado.

## Rollback plan
1. Feature flag para desactivar worker agéntico.
2. Fallback al pipeline actual de `input-orchestrator`.
3. Reprocesar eventos pendientes desde `agent_events`.

## Siguiente incremento
- Generar tablero operacional minimo (queries + alertas) sin crear dashboard UI nuevo.

## Progreso implementado (2026-02-08)
- Suite E2E ampliada en `tests/integration/agent-e2e-text-tool-intent.test.ts`:
  - texto simple conversacional sin side effects
  - tool intent (recordatorio)
  - deduplicacion por `wa_message_id` (doble webhook)
- Runbook operativo con queries y checklist:
  - `docs/observability-e2e-runbook.md`
- Señales de observabilidad activas en runtime:
  - `sla.*` y `memory.*` en logs estructurados.

## Gaps abiertos para GREEN
- Faltan escenarios e2e de audio, rich image con confirmacion y fallback de provider.
- Falta persistir auditoria de tools en `agent_tool_calls` enlazada a `run_id` en toda la ruta.
- Falta automatizar alertas externas p95/p99 y error-rate (actualmente runbook + queries manuales).
