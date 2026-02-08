# Architecture Master v1.0.0

Estado: `ACTIVE`
Fecha: `2026-02-08`
Tipo: `Immutable Source of Truth`

## 1. Principios inmutables
1. `LLM-first`: la decisión de negocio del turno la toma el modelo, no reglas heurísticas del backend.
2. `Backend-as-guardrail`: el backend valida, persiste, gobierna tools y aplica seguridad/idempotencia.
3. `Multimodel by design`: ningún proveedor único es dependencia arquitectónica.
4. `Memory-centric personalization`: toda interacción alimenta memoria útil y perfil persistente.
5. `Durable runtime`: cada evento agéntico debe ser trazable y recuperable.

## 2. Contratos arquitectónicos
- `AgentContext`: historial + memoria semántica + perfil + estado operativo.
- `AgentTurn`: input normalizado + tools permitidas + respuesta final + metadatos de decisión.
- `ToolPolicy`: `allow|confirm|deny` + timeout + retry + idempotencia.
- `RunLedger`: `agent_events`, `agent_runs`, `agent_steps`, `agent_tool_calls`, `agent_checkpoints`.

## 3. Invariantes
1. Nunca responder con mocks en runtime productivo.
2. Todo side effect debe pasar por policy engine.
3. Duplicados por `wa_message_id` no pueden generar side effects duplicados.
4. Cada turno debe emitir trazas observables (`request_id`, `conversation_id`, `pathway`, `outcome`).
5. Toda selección de modelo debe salir de catálogo versionado.

## 4. Modelo de evolución
- Cambios de arquitectura requieren:
  1. Nueva ADR/spec.
  2. Bump de versión de este documento.
  3. Actualización de catálogo de capacidades si aplica.

## 5. Versionado
- `MAJOR`: rompe contratos o invariantes.
- `MINOR`: añade capacidades sin romper contratos.
- `PATCH`: aclaraciones/ajustes no estructurales.

## 6. Referencias obligatorias
- `docs/model-capability-catalog.v1.json`
- `specs/24-llm-first-multimodel-runtime.md`
