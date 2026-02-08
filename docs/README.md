# Docs Index (Fuente de verdad)

Esta carpeta mantiene solo documentación vigente y versionada para evitar drift.

## Documentos activos
- `docs/architecture-master-v1.md`
  - Fuente de verdad inmutable de arquitectura.
- `docs/model-capability-catalog.v1.json`
  - Catálogo versionado multimodelo/multimodal.
- `docs/agentic-architecture-guide.md`
  - Guía explicativa con diagramas de flujo.
- `docs/observability-e2e-runbook.md`
  - Runbook operativo de observabilidad y e2e.
- `docs/whatsapp-webhook-testing-cli.md`
  - Procedimiento CLI para testing de webhook.

## Regla de mantenimiento
1. Todo cambio arquitectónico debe reflejarse primero en `architecture-master` y catálogo.
2. No guardar handoffs temporales ni planes de sesión aquí.
3. Si un doc queda obsoleto, se elimina en el mismo PR que introduce su reemplazo.
