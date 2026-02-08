# 24 - LLM-First Multimodel Runtime

## Estado
- Semaforo: `YELLOW`
- Fecha: `2026-02-08`
- Owner tecnico: `src/modules/ai/*` + `src/modules/webhook/*`

## Objetivo funcional
Convertir el runtime a enfoque LLM-first multimodelo, donde el backend no decide intención de negocio y el modelo responde con contexto real y herramientas gobernadas.

## Principios
1. El LLM decide respuesta/tool strategy por turno.
2. El backend solo ensambla contexto, aplica guardrails y persiste.
3. La selección de modelo usa catálogo versionado, no hardcode aislado.

## Contratos
- `AgentContext`: history + memory + profile + runtime constraints.
- `ModelCapabilityCatalog`: capacidad/fortaleza/costo por modelo.
- `ToolPolicyEngine`: `allow|confirm|deny` + timeout/retry/idempotencia.

## Implementado en este incremento
- `Architecture Master v1.0.0` en `docs/architecture-master-v1.md`.
- Catálogo versionado en `docs/model-capability-catalog.v1.json`.
- `model-router` alineado a perfiles multimodelo (`default_chat`, `tool_execution`, `long_context`, `rich_vision`).
- Selección primaria y fallback por perfil/capabilidad/costo.
- `AgentContextBuilder` unificado en `src/modules/ai/application/agent-context-builder.ts`:
  - centraliza `history + semantic memory + memory profile` antes del turno LLM.
  - integra métricas `memory.*` desde una sola capa.

## Gaps abiertos
- Migración completa para retirar heurísticas de intención legacy en `input-router`/`processing`.
- Integración del loop agéntico durable (runs/steps/checkpoints) como ruta principal.
- Benchmarks offline/online para quality-latency-cost por perfil.

## Pruebas clave
1. Perfil `tool_execution` prioriza modelos con tool calling robusto.
2. Perfil `long_context` prioriza ventana de contexto amplia.
3. Fallback siempre cambia de proveedor cuando está disponible.
4. Presupuesto crítico selecciona modelo de menor costo compatible.

## Criterio de salida a GREEN
1. Runtime LLM-first como ruta principal de producción.
2. 10+ escenarios e2e estables multimodales.
3. Tabla de scorecards por perfil (coste, latencia, calidad) operativa.
