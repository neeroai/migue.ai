# Riesgos y Aceptación MVP

## Riesgos y Mitigaciones
- Rate limits/timeout: reintentos exponenciales, colas livianas.
- Costos IA: límites de tokens y caching de prompts.
- Storage crecimiento: políticas de retención/limpieza.
- Falla de integraciones: circuit breakers y fallback de respuestas.

## Aceptación MVP
- Historias de Epic 1 completas y estables.
- Al menos 1 camino feliz E2E por epic 2–4.
- NFR de latencia cumplido en p50/p95.
- Logs y métricas básicas habilitadas.

### Criterios de aceptación (resumen)
- Mensajería texto: webhook→persistencia→IA→respuesta en <2s p95.
- Recordatorios: entrega ±1 minuto y actualización de estado.
- Audio: transcripción exitosa para audios ≤ 2 min, respuesta resumida.
- RAG: respuesta con 1–2 citas relevantes y costo/tokens bajo umbral definido.
