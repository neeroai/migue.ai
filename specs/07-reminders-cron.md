# 07 - reminders-cron

## Estado
- Semáforo: `GREEN`
- Fase: `done`
- Next Step: Mantener cobertura de regresión y monitoreo operativo.
- Updated: 2026-02-12 06:23
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/reminders/*`

## Objetivo funcional
Gestión de recordatorios y ejecución programada vía cron con entrega al usuario.

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

## Implementación reciente (2026-02-12)
- El cuerpo del mensaje de entrega de recordatorio en cron se genera ahora en modo LLM-first con fallback estático.
- Objetivo: evitar respuestas literales/robóticas al notificar recordatorios.
