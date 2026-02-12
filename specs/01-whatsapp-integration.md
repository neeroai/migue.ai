# 01 - whatsapp-integration

## Estado
- Semáforo: `GREEN`
- Fase: `done`
- Next Step: Mantener cobertura de regresión y monitoreo operativo.
- Updated: 2026-02-12 03:30
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/shared/infra/whatsapp/*`

## Objetivo funcional
Conectividad robusta con WhatsApp Cloud API para envío/recepción y tipos de mensaje soportados.

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
