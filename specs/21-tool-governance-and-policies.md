# 21 - Tool Governance And Policies

## Estado
- Semaforo: `YELLOW`
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

## Progreso implementado (2026-02-08)
- Catalogo V1 operativo en `src/modules/ai/application/tool-governance.ts`:
  - contratos por tool con `schemaVersion`, `riskLevel`, `timeoutMs`, `retries`, `idempotencyStrategy`.
- Policy engine integrado antes de side effects:
  - `evaluateToolPolicy(...)` produce `allow|confirm|deny`.
  - `executeGovernedTool(...)` envuelve ejecucion con timeout/retry y bloquea side effects cuando aplica.
- Integracion en runtime del agente:
  - `create_reminder`, `schedule_meeting`, `track_expense` ahora pasan por policy engine antes de ejecutar.
- Auditoria en logs estructurados:
  - `[ToolPolicy] Tool denied`
  - `[ToolPolicy] Tool requires confirmation`
  - `[ToolPolicy] Tool executed`
  - `[ToolPolicy] Tool execution failed`
- Cobertura unitaria:
  - `tests/unit/tool-governance.test.ts`

## Gaps abiertos para GREEN
- Persistencia de auditoria de cada tool call en `agent_tool_calls` (actualmente logs, no ledger por `run_id` aun no conectado en toda la ruta).
- Falta habilitar herramientas V1 pendientes en runtime (`web_search`, `send_whatsapp_message`, `memory_query`, `memory_upsert`).
- Falta politica de loop detection tool->tool con checkpoint de progreso.
