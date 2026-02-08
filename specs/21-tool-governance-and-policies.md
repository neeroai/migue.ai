# 21 - Tool Governance And Policies

## Estado
- Semaforo: `RED`
- Fecha: `2026-02-08`
- Owner tecnico: `src/modules/ai/application/*`

## Objetivo funcional
Definir un gobierno de herramientas seguro y auditable para un agente semiautonomo.

## Catalogo V1 de tools
1. `web_search`
2. `send_whatsapp_message`
3. `memory_query`
4. `memory_upsert`

## Contrato de tool
Campos minimos:
- `tool_name`
- `schema_version`
- `input_schema` (zod/json schema)
- `output_schema`
- `risk_level` (`low|medium|high`)
- `timeout_ms`
- `retry_policy`
- `idempotency_strategy`

## Policy engine
Decision por tool call:
- `allow`
- `confirm`
- `deny`

Inputs de decision:
- riesgo de tool
- contexto del usuario
- horario/ventana
- limites de costo/rate
- consentimiento previo

## Defaults de riesgo V1
- `web_search`: `low` -> `allow`
- `memory_query`: `low` -> `allow`
- `memory_upsert`: `medium` -> `allow` con reglas de privacidad
- `send_whatsapp_message`: `medium/high` -> `confirm` por defecto

## Timeouts y retries
- `web_search`: `timeout 6s`, `retry 1`
- `send_whatsapp_message`: `timeout 5s`, `retry 2` idempotente
- `memory_*`: `timeout 2s`, `retry 1`

## Auditoria
Persistir por call:
- decision de politica
- razon
- input/output resumido
- latencia
- resultado final

Tabla objetivo: `agent_tool_calls`.

## Guardrails adicionales
- allowlist de destinos para mensajeria saliente en V1.
- denegar payloads fuera de schema.
- bloquear loops tool->tool sin avance.

## Pruebas clave
1. Tool de riesgo medio solicita confirmacion.
2. Tool denegada no ejecuta side effect.
3. Timeout dispara fallback de respuesta al usuario.
4. Reintentos no duplican envio WhatsApp.

## Criterio de salida a YELLOW
1. Catalogo versionado operativo.
2. Policy engine integrado antes de ejecutar tools.
3. Logs/auditoria completos por tool call.
