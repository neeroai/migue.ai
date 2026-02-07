# migue.ai

**Agente IA conversacional por WhatsApp** - Responde mensajes, procesa audio/imágenes, recordatorios, gastos

---

<must_follow>

**SIEMPRE mantener actualizados tracking files** (.claude/session.md, CHANGELOG.md, status.md, decisions.md, todo.md)

</must_follow>

---

## Stack

- Next.js 16 + Vercel Edge Functions
- WhatsApp Business API
- Supabase PostgreSQL + pgvector
- OpenAI GPT-4o-mini + Claude Sonnet fallback
- Budget: $90/month

---

## Key Files

| File | Purpose |
|------|---------|
| `app/api/whatsapp/webhook/route.ts` | Webhook entrada mensajes WhatsApp |
| `lib/ai/proactive-agent.ts` | Orquestación AI (herramientas: reminders, expenses, calendar) |
| `lib/ai-processing-v2.ts` | Pipeline procesamiento (text/audio/image → AI → response) |
| `.claude/CHANGELOG.md` | Qué cambió en código |

---

## Specs (specs/)

12 comprehensive .md files documenting implementation:

- **P0**: ai-processing, reminders, whatsapp-integration
- **P1**: calendar-integration, memory-system, message-processing
- **P3**: cost-tracking, audio-transcription, rate-limiting, error-recovery, messaging-windows, webhook-validation

Each spec: what it does, why, files, exports, dependencies, tests, ADRs, logs, next steps

---

## WhatsApp API Constraints

- NO streaming response (buffer completo antes de enviar)
- NO typing indicator control (solo reactions)
- 24h window mensajes gratis (fuera = template pagado)
- Rate limit: 250 msg/sec

---

## Edge Runtime Constraints

- Timeout: 5s máximo
- No Node.js APIs (solo Web APIs: fetch, crypto)
- Cold start: 300-800ms
- All routes: `export const runtime = 'edge'`

---

## Tracking Files (.claude/)

6 archivos MANDATORY - actualizar después de cambios:

- `session.md` - Qué pasó en sesión
- `CHANGELOG.md` - Qué cambió en código (BLOCKING)
- `todo.md` - Tareas pending/in_progress/completed
- `decisions.md` - Por qué se decidió X
- `status.md` - Estado actual proyecto
- `plan.md` - Plan aprobado actual

---

**Last Updated**: 2026-02-07 03:10
