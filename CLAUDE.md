# migue.ai

Asistente IA conversacional por WhatsApp con backend en Next.js (App Router), Edge Runtime y Supabase.

## Must Follow

- Mantener consistencia con la arquitectura modular actual (`app/api`, `src/modules`, `src/shared`).
- Si hay cambio de comportamiento, actualizar tracking + changelog en la misma sesion/PR.
- Usar como referencia operativa: `docs/tracking-best-practices.md`.

## Stack Actual

- Next.js 16 + React 19 + TypeScript 5
- WhatsApp Business API
- Supabase PostgreSQL + pgvector
- OpenAI SDK + AI Gateway/fallback configurado por entorno

## Key Files

| File | Purpose |
|------|---------|
| `app/api/whatsapp/webhook/route.ts` | Ingreso de eventos WhatsApp |
| `app/api/cron/check-reminders/route.ts` | Cron de recordatorios |
| `src/modules/ai/application/processing.ts` | Orquestacion principal de procesamiento AI |
| `src/modules/ai/application/vision-pipeline.ts` | Pipeline multimodal de imagen/documento |
| `src/shared/infra/db/supabase.ts` | Cliente DB y acceso a Supabase |

## Tracking Contract

Archivos de tracking y su responsabilidad:

- `.claude/handoff.md`: estado operativo para retomar la siguiente sesión.
- `.claude/session.md`: handoff entre sesiones.
- `.claude/status.md`: estado actual y riesgos.
- `.claude/todo.md`: backlog operativo.
- `.claude/decisions.md`: decisiones (ADR) y tradeoffs.
- `.claude/CHANGELOG.md`: historial tecnico interno.
- `CHANGELOG.md`: cambios relevantes del proyecto.
- `docs/master-tracker.md`: tablero maestro autogenerado desde `specs/*.md`.

Comandos de control:

- `just sync-master`
- `just check-tracking`
- `just checkpoint "..." "..." "step1|step2" "[blockers]" "[files]" "[commands]"`
- `just resume`
- `just close-session "..." "..." "step1|step2" "[blockers]" "[files]" "[commands]"`

## Runtime Constraints

- Rutas API criticas en Edge Runtime.
- Evitar APIs Node no soportadas en handlers Edge.
- Mantener logging estructurado y seguro (sin exponer PII completa).

**Last Updated**: 2026-02-12
