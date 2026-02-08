# 24 - llm-first-multimodel-runtime

## Estado
- Semáforo: `YELLOW`
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/ai/*`

## Objetivo funcional
Migración a runtime LLM-first multimodelo con catálogo versionado y contexto unificado.

## Alineación Architecture Master
- LLM-first cuando aplique la decisión de negocio.
- Backend como guardrail (policy, seguridad, idempotencia, persistencia).
- Observabilidad obligatoria por turno (request/conversation/pathway/outcome).

## Contratos clave
- Entrada normalizada.
- Contexto de agente (historial + memoria + perfil + restricciones).
- Respuesta final al usuario (sin mocks en runtime productivo).

## Evidencia mínima
- Typecheck en verde.
- Tests unit/integration relevantes de la feature.
- Logs estructurados en entorno real.

## Riesgos y gaps
- Completar e2e faltantes por feature.
- Consolidar dashboards/alertas externas donde aplique.

## Progreso implementado
- `model-router` capability-aware basado en catálogo versionado.
- `AgentContextBuilder` unificado:
  - centraliza `history + semantic memory + memory profile`.
  - emite métricas `memory.*` desde una sola capa.
- `AgentTurnOrchestrator`:
  - entrypoint único del turno (`context -> model/tools -> response normalization`).
  - integrado en `processMessageWithAI`.
- Heurísticas legacy detrás de flag:
  - `LEGACY_ROUTING_ENABLED` controla split regex de intents y respuestas triviales canned.
  - default `false` para priorizar camino LLM-first.
- Tool policy movida al orquestador:
  - `AgentTurnOrchestrator` decide `toolsEnabled` por turno (legacy flag + intent explícito).
  - `proactive-agent` ya no decide exposición de tools por regex local; ejecuta según policy del turno.
- Confirmación de `rich_input` gobernada por policy:
  - `processDocumentMessage` delega al turno agente sin heurística de confirmación por intent detectado.
  - `tool-governance` decide `confirm/allow` en `rich_input` con base en `explicitConsent`.

## Siguiente incremento
Alinear implementación restante a la ruta principal LLM-first y cerrar `YELLOW -> GREEN`.
