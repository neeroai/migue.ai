# 16 - Low Latency Intent Routing

## Status

`done`

## Objetivo

Reducir latencia percibida y separar claramente el procesamiento por tipo de input:

- texto simple con camino de menor carga logica
- texto con intencion de tools/features
- rich input delegado con politicas de timeout y feedback al usuario

## Alcance

- Clasificacion de input en router central.
- Orquestacion por clase de input.
- Timeout por tipo de rich input y mensajes de estado.
- Standby explicito para stickers.

## Arquitectura

### 1) Input Router

Archivo: `src/modules/webhook/application/input-router.ts`

Clases:

- `TEXT_SIMPLE`
- `TEXT_TOOL_INTENT`
- `RICH_INPUT`
- `RICH_INPUT_TOOL_INTENT`
- `STICKER_STANDBY`
- `UNSUPPORTED`

### 2) Input Orchestrator

Archivo: `src/modules/webhook/application/input-orchestrator.ts`

Responsabilidades:

- Ejecutar ruta rapida para texto.
- Ejecutar ruta de tool-intent para texto accionable.
- Delegar rich input a pipelines de audio/documento.
- Aplicar timeouts por tipo:
  - audio: 45s
  - image/document: 30s
- Enviar feedback al usuario en procesos largos.
- Responder claramente para tipos no soportados.

### 3) Integracion con pipeline existente

Archivo: `src/modules/webhook/application/background-processor.ts`

- El branching por tipo se centraliza via `processInputByClass`.

### 4) Deteccion de intencion reusable

Archivo: `src/modules/ai/domain/intent.ts`

- `hasToolIntent(...)`
- `detectToolIntents(...)`

## Comportamiento esperado

1. El texto simple sigue el camino mas corto.
2. Los mensajes con intencion de feature/tools se enrutan por camino de tool-intent.
3. Rich input informa progreso y no se procesa indefinidamente.
4. Sticker queda en standby (mensaje explicito al usuario).
5. Tipos no soportados devuelven mensaje claro sin bloquear pipeline.

## Evidencia actual

- `tests/unit/input-router.test.ts` valida clasificacion base.
- Unit test suite completa pasando tras integrar router/orquestador.
- `TextFastPathService` extraido en `src/modules/ai/application/text-fast-path.ts`.
- `ToolIntentOrchestrator` extraido en `src/modules/ai/application/tool-intent-orchestrator.ts`.
- Metricas SLA iniciales agregadas:
  - `sla.route_decision_ms`
  - `sla.end_to_end_ms`
  - `sla.rich_input_timeout_count`
  - `sla.typing_start_ms`
- Guia de dashboard/alertas: `docs/observability-sla-dashboard.md`.

## Riesgos abiertos

- Aun falta implementar dashboard/alertas sobre las metricas SLA en entorno real (solo logging estructurado por ahora).
- Falta prueba de integracion dedicada para timeout de rich input con asserts de mensajes de progreso.

## Siguientes incrementos

1. Implementar dashboard y alertas en el entorno productivo usando `docs/observability-sla-dashboard.md`.
2. Agregar pruebas de integracion para timeout de rich input y mensajes de progreso.
3. Implementar planner explicito para `TEXT_TOOL_INTENT` cuando haya mas tools/features.

## Pendiente (solicitado)

- Dejar como pendiente para siguiente iteracion la implementacion operativa de observabilidad:
  - crear dashboard SLA
  - crear alertas SLA
  - validar umbrales en produccion

## Cierre

- Codigo y pruebas de la arquitectura low-latency/intention-routing completados.
- Salida a produccion aprobada sin bloquear por dashboard/alertas (deferred).
