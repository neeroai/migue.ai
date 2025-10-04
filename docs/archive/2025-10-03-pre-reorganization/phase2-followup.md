# Phase 2 Follow-Up Tasks

## Google Calendar Sync
- Implement OAuth token storage (`calendar_credentials`) with Supabase RLS.
- Add `lib/google-calendar.ts` for availability lookup, event creation, cancellation.
- Extend intent router to map `schedule_meeting` into calendar workflow with confirmation prompts.
- Unit tests: fake Google client covering success + quota failures. Playwright scenario for booking happy path.

## Reminder Automation
- ✅ Cron `api/cron/check-reminders.ts` envía recordatorios pendientes y registra fallos.
- ✅ Estado `pending → sent|failed` con token de envío y logging en respuesta.
- 🔄 Agregar comando local (`npm run cron:reminders`) para dry-run.
- ✅ Tests unitarios (`tests/unit/reminders.test.ts`, `tests/unit/cron-reminders.test.ts`).

## Document RAG
- Create Supabase Storage bucket `documents` and ingestion flow (chunking, embeddings storage in `embeddings`).
- Add `lib/rag.ts` with search + prompt templating returning cited answers.
- Update `analyze_document` intent path to route through RAG when context exists.
- Tests: contract tests for chunking, retrieval scoring, and fallback when no matches.

## GPT-4o Streaming
- ✅ `lib/openai.ts` expone `streamChatCompletion` y `generateResponse` usa streaming con fallback.
- 🔄 Evaluar envío progresivo a WhatsApp (hoy se envía mensaje final agregado).
- 🔄 Añadir política de reintentos específica para rate limits en streaming.
- ✅ Tests unitarios (`tests/unit/response.test.ts`) validan fallback ante errores de streaming.

## Cross-Cutting
- Observability: structured logs with request IDs across new modules.
- Security review: confirm storage buckets enforce per-user access, secrets remain outside codebase.
- Documentation: update `AGENTS.md` roadmap and create runbooks per module.
- Typing indicator helper y guía (`api/whatsapp/send.ts`, `docs/typing-indicator.md`).
