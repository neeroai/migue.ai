# 21 - tool-governance-and-policies

## Estado
- Semáforo: `GREEN`
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/ai/application/tool-governance.ts`

## Objetivo funcional
Gobierno de herramientas con decisiones allow/confirm/deny y ejecución segura.

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
- Validación productiva WhatsApp (2026-02-08): `track_expense` en `rich_input` ejecuta `confirm/allow` vía `explicitConsent`, con persistencia real y respuesta final al usuario.

## Riesgos y gaps
- Completar e2e faltantes por feature.
- Consolidar dashboards/alertas externas donde aplique.

## Siguiente incremento
Expandir cobertura de policies para tools nuevas (`web_search`, `send_whatsapp_message`) con tests de riesgo y consentimiento.
