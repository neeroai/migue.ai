# 27 - web-search-tool-runtime

## Estado
- Semáforo: `GREEN`
- Fase: `done`
- Next Step: Monitorear uso/costo/latencia y ajustar heurística de ruteo web si hace falta.
- Updated: 2026-02-12 12:08
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/modules/ai/application/proactive-agent.ts` + `src/modules/ai/application/tool-governance.ts`

## Objetivo funcional
Permitir que Migue consulte internet en tiempo real cuando el LLM detecte necesidad factual/actualidad, manteniendo guardrails de policy, compatibilidad Edge y rollout controlado.

## Alcance MVP
- Exponer una tool de búsqueda web en el turno LLM-first.
- Activación automática por decisión del modelo (sin regex de intent para esta feature).
- Integración vía AI Gateway built-in tools (compatible con modelos `provider/model` ya usados en runtime).
- Rollout con flag `WEB_SEARCH_ENABLED`.
- Respuesta al usuario en formato corto (WhatsApp), priorizando resumen.

## Fuera de alcance (iteración actual)
- Navegación multi-step por páginas.
- Scraping profundo/custom extractors por dominio.
- Ranking propio de resultados fuera del proveedor.
- Obligar cita/enlace en cada respuesta.

## Alineación Architecture Master
- `LLM-first`: el modelo decide cuándo ejecutar `web_search`.
- `Backend-as-guardrail`: policy + timeouts/retries + flag de activación.
- `Durabilidad/observabilidad`: registrar outcome y latencia en logs estructurados de turno.

## Decisiones clave y tradeoffs
- Proveedor elegido: `AI Gateway` (menor fricción con stack actual).
- Activación elegida: automática por LLM (mejor UX conversacional).
- Formato de salida elegido: resumen (sin forzar enlaces visibles).
- Rollout elegido: feature flag `WEB_SEARCH_ENABLED`.

Tradeoff principal:
- Menos complejidad y mayor compatibilidad inmediata vs. menor control fino que una integración dedicada de motor de búsqueda externo.

## Contratos e interfaces (propuestos)
- Env:
  - `WEB_SEARCH_ENABLED?: string` (`true|1|yes|on` habilita, resto deshabilita).
- Runtime flags:
  - `isWebSearchEnabled(): boolean` en `src/modules/ai/application/runtime-flags.ts`.
- Tool catalog/policy:
  - Reusar `web_search` existente en `TOOL_CATALOG` (`riskLevel: low`, `timeoutMs: 6000`).
- Tool runtime:
  - Exponer `web_search` en `proactive-agent` solo si flag habilitada.
  - Evaluar policy de `web_search` antes de exponer la tool al modelo.
  - Resolver consultas con preferencia de modelo `google/gemini-2.5-flash-lite` cuando el mensaje parece requerir búsqueda web.

## Flujo funcional (alto nivel)
1. Llega mensaje de usuario al turno LLM-first.
2. `AgentTurnOrchestrator` arma contexto.
3. `proactive-agent` define tools disponibles según flags/policy.
4. Si el modelo decide `web_search`, se ejecuta tool con gobernanza.
5. El resultado vuelve al modelo para redactar respuesta final.
6. Se responde por WhatsApp con resumen corto.

## Criterios de validación
- `npm run typecheck` en verde.
- Unit tests:
  - `runtime-flags`: parse y lectura de `WEB_SEARCH_ENABLED`.
  - `tool-governance`: policy `allow` para `web_search` en pathway estándar.
  - `proactive-agent`/tool wiring: tool se expone solo con flag activa.
- Sin regresión en tools existentes (`create_reminder`, `schedule_meeting`, `track_expense`).

## Riesgos y mitigaciones
- Riesgo: aumento de latencia por llamadas web.
  - Mitigación: timeout/retry ya definidos en `TOOL_CATALOG`.
- Riesgo: aumento de costo por consultas frecuentes.
  - Mitigación: rollout gradual con flag y monitoreo de uso.
- Riesgo: respuestas imprecisas/fuera de contexto.
  - Mitigación: prompt con regla de usar búsqueda solo cuando haga falta verificar actualidad.

## Rollback simple
- Apagar `WEB_SEARCH_ENABLED` para desactivar la tool sin redeploy de arquitectura.

## Evidencia de diseño (investigación)
- Stack del repo confirmado: `ai@6` + modelos gateway en `proactive-agent`.
- Compatibilidad validada en documentación oficial:
  - AI SDK tools/tool-calling
  - AI Gateway tool-calling
  - Edge Runtime de Next.js

## Evidencia de implementación y validación
- Implement:
  - `src/modules/ai/application/proactive-agent.ts`
  - `src/modules/ai/application/runtime-flags.ts`
  - `src/shared/config/env.ts`
  - `types/env.d.ts`
  - `.env.example`
- Validate:
  - `npm run typecheck`
  - `npm run test:unit`
  - `npx jest tests/unit/proactive-agent-web-search.test.ts --runInBand`

## Hotfix aplicado post-validación
- Se corrigió fallback de respuesta para resultados de tool no-string (payload objeto en `web_search`).
- Se configuró `maxSteps: 3` cuando hay tools para permitir que el modelo produzca respuesta final después del tool call.
- Se reforzó prompt para `web_search` (evitar respuesta solo "Listo") y parser profundo para payloads anidados.
