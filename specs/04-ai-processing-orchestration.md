# 04 - ai-processing-orchestration

## Estado
- Semáforo: `YELLOW`
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/ai/*`

## Objetivo funcional
Orquestación del turno del asistente con contexto real y uso de tools gobernadas.

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

## Siguiente incremento
Alinear implementación restante a la ruta principal LLM-first y cerrar `YELLOW -> GREEN`.
