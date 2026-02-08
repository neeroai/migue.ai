# 22 - Latency And Fast-Path Architecture

## Estado
- Semaforo: `RED`
- Fecha: `2026-02-08`
- Owner tecnico: `src/modules/webhook/application/*` + `src/modules/ai/application/*`

## Objetivo funcional
Maximizar percepcion de respuesta inmediata en WhatsApp, priorizando texto simple con minima carga logica.

## Principio rector
`TEXT_SIMPLE` no debe pasar por planner pesado ni pipeline de tools salvo intencion explicita.

## Rutas oficiales
1. `TEXT_SIMPLE`
- ACK webhook.
- typing inmediato.
- contexto minimo.
- inferencia LLM corta.
- respuesta.

2. `TEXT_TOOL_INTENT`
- ACK + typing.
- planner/ejecucion tool.
- validacion de outcome.
- respuesta con resultado.

3. `RICH_INPUT`
- ACK + mensaje de progreso.
- pipeline delegado por tipo.
- timeout independiente.
- fallback claro al usuario.

4. `STICKER_STANDBY`
- respuesta corta de no soporte temporal.

## Presupuesto de latencia (p95)
- `route_decision_ms <= 20ms`
- `typing_start_ms <= 300ms`
- `TEXT_SIMPLE end_to_end <= 2000ms`
- `TEXT_TOOL_INTENT end_to_end <= 4000ms`
- `RICH_INPUT end_to_end <= 9000ms` (con progreso)

## Cargas logicas permitidas por ruta
- `TEXT_SIMPLE`: no memory retrieval vectorial por defecto.
- `TEXT_TOOL_INTENT`: retrieval selectivo + tools.
- `RICH_INPUT`: procesamiento multimodal delegado, nunca inline bloqueante de webhook.

## Estrategias de degradacion
- Si provider lento: respuesta corta + continuar procesamiento solo cuando aplique.
- Si tool timeout: mensaje explicito + opcion de reintentar.
- Si presupuesto agotado: fallback de menor costo.

## Metricas obligatorias
- `sla.route_decision_ms`
- `sla.typing_start_ms`
- `sla.end_to_end_ms`
- `sla.rich_input_timeout_count`
- `pathway` (`text_fast_path|tool_intent|rich_input`)

## Pruebas clave
1. Text simple no invoca tools innecesarias.
2. Text tool intent enruta correctamente.
3. Rich input informa progreso antes del resultado final.
4. Timeout rich input no deja al usuario sin respuesta.

## Criterio de salida a YELLOW
1. SLO aplicados y medidos por ruta.
2. Alertas por degradacion p95.
3. Suite de regresion para fast-path.
