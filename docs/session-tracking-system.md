# Session Tracking System (Deprecated)

Este documento quedó deprecado. La operación vigente está en:

- `docs/session-continuity-runbook.md`

El flujo oficial usa `just` (`resume`, `checkpoint`, `sync-master`, `check-tracking`, `close-session`).

## Comandos

### Guardar checkpoint

```bash
npm run session:checkpoint -- \
  --objective "Implementar X en webhook" \
  --last "CI guardrail desplegado" \
  --next "Agregar test de integración|Validar en staging" \
  --blockers "Esperando token de proveedor" \
  --files "app/api/whatsapp/webhook/route.ts,src/modules/ai/application/processing.ts" \
  --commands "npm run typecheck|npm run test:unit"
```

### Reanudar

```bash
npm run session:resume
```

## Archivo de estado

- `.claude/handoff.md`: contiene el estado actual de reanudación.

## Recomendación de uso

1. Al terminar sesión, correr `session:checkpoint`.
2. Al iniciar sesión, correr `session:resume`.
3. Mantener `.claude/session.md`, `.claude/todo.md` y `CHANGELOG.md` al día para trazabilidad histórica.
