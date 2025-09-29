# migue.ai - Plan de Implementación BMAD (WhatsApp → Vercel Edge → Supabase → OpenAI)

## Objetivo General
Desarrollar migue.ai como asistente de IA en WhatsApp con latencia baja (1–2s), funcionalidades de citas/recordatorios, transcripción de audio y RAG básico de documentos, sobre la arquitectura: WhatsApp Business API → Vercel Edge Functions → Supabase → OpenAI.

## Documentos base
- `docs/prd.md` (PRD v4)
- `AGENTS.md` (normativas y arquitectura objetivo)
- `docs/BMAD-NEXT-STEPS.md` (siguientes pasos)
- `docs/KAPSO-COMPATIBILITY-REPORT.md` (mapeo de capacidades)

## Estado actual (brief)
- PRD v4 creado y refinado (`docs/prd.md`).
- PRD shardeado (`docs/prd/…`).
- Arquitectura fullstack creada (`docs/architecture.md`).
- PO checklist: READY con acciones menores (OpenAPI, límites audio/retención, errores estándar, métricas/alertas) en `docs/qa/po-checklist-2025-09-29.md`.

## Acciones inmediatas (siguiente sprint corto)
1) Shard de Arquitectura
- `@bmad-master` → `*shard-doc docs/architecture.md architecture` (índice creado; completar secciones según necesidad).

2) Story 1.1 (Webhook)
- `@sm` → `*draft` → generar `docs/stories/1.1.story.md` (validación firma/token, parsing, logs mínimos).
- `@dev` → `*develop-story 1.1` (Edge route, tests, logs; p95<2s).
- `@qa` → `*review 1.1` y `*gate`.

3) Documentación de contratos (PO checklist)
- `api-documenter` → OpenAPI 3.1 inicial (webhook/send/ai/transcribe/reminders) + ejemplos curl.
- `api-designer` → errores estandarizados e idempotencia en `send`.
- `ai-engineer`/`backend-developer` → límites: tamaño/duración audio y retención/cleanup.
- `code-reviewer` → métricas mínimas y alertas.

## Equipo de Subagentes (BMAD) y Prompts de activación
- Orquestación: `@bmad-orchestrator`
  - Prompt: "*help" y luego "*workflow greenfield-service".
- Product Manager: `@pm`
  - Prompt: "*create-doc prd" (usar PRD v4; revisar/actualizar `docs/prd.md`).
- Architect: `@architect`
  - Prompt: "*create-doc fullstack-architecture" (alinear a WhatsApp → Vercel Edge → Supabase → OpenAI).
- Product Owner: `@po`
  - Prompt: "*execute-checklist-po" (coherencia PRD/arquitectura; NFRs y restricciones).
- Scrum Master: `@sm`
  - Prompt: "*draft" (create-next-story a partir de shards del PRD/arquitectura).
- Developer: `@dev`
  - Prompt: "*develop-story {id}" (ejecutar historia, tests, validaciones).
- QA (Test Architect): `@qa`
  - Prompts clave por historia: `*risk`, `*design`, `*trace`, `*nfr`, `*review`, `*gate`.
- Analyst (opcional): `@analyst`
  - Prompt: "*document-project" (si se requiere documentación brownfield externa) o "*create-project-brief".
- UX Expert (opcional): `@ux-expert`
  - Prompt: "*create-front-end-spec" (si luego añadimos dashboard UI).
- BMad Master (utilitario): `@bmad-master`
  - Prompts: `*shard-doc docs/prd.md prd` y `*shard-doc docs/architecture.md architecture`.

## Equipo extendido de agentes (no-BMAD) y responsabilidades
- `ai-engineer` (LLM/RAG/agents prod):
  - Responsabilidad: límites/timeout OpenAI, prompt ops, evaluación de calidad, guardrails; diseño de RAG (chunking, topK, costos).
  - Prompt: "Diseña límites de tokens, timeouts y políticas de reintento para GPT-4o/Whisper/Embeddings; propone guardrails y eval set minimal."
- `prompt-engineer`:
  - Responsabilidad: prompts de intención/respuesta, few-shots, style-guide, reducción de tokens.
  - Prompt: "Optimiza prompts de intención y respuesta max 400 tokens, define criterios de parada y temperatura."
- `backend-developer` / `python-pro` / `typescript-pro`:
  - Responsabilidad: Edge routes (send/webhook/ai/cron), SDKs, manejo de errores; tipado estricto.
  - Prompt: "Implementa `/api/whatsapp/send` con reintentos/retro-off, validación inputs, tipado fuerte."
- `api-designer`:
  - Responsabilidad: especificar endpoints, contratos, códigos de error, idempotencia; versionado.
  - Prompt: "Define contratos REST para webhook/send/ai/transcribe/reminders con esquemas y errores."
- `api-documenter` / `docs-architect`:
  - Responsabilidad: docs OpenAPI 3.1 + guías de uso, ejemplos curl, seguridad.
  - Prompt: "Genera OpenAPI 3.1 y README de endpoints con ejemplos, auth y rate-limits."
- `business-analyst` / `market-researcher` / `competitive-analyst`:
  - Responsabilidad: validación de casos de uso, pricing WhatsApp, benchmark; priorización de epics.
  - Prompt: "Refina casos de uso y mide impacto; propone KPIs y riesgos de negocio."
- `code-reviewer`:
  - Responsabilidad: seguridad, performance, fiabilidad; revisión de PRs y deuda técnica.
  - Prompt: "Revisa diffs buscando manejo de errores, RLS, leaks, latencia."
- `data-engineer`:
  - Responsabilidad: modelos, índices, particionado suave, planes de retención; vector store.
  - Prompt: "Propón esquema/índices para `messages`, `embeddings` y retención de datos."
- `ui-ux-designer` / `frontend-developer` / `ui-visual-validator` (si UI futura):
  - Responsabilidad: diseño de dashboard, accesibilidad, QA visual.
  - Prompt: "Diseña vista básica de monitoreo (mensajes/min, latencia, errores)."
- `content-marketer` / `customer-support` (go-to-market):
  - Responsabilidad: plantillas útiles, onboarding, FAQ y soporte de incidencias.
  - Prompt: "Redacta plantillas de utilidad para CSW (confirmación, recordatorios)."

## MCP Context7 para documentación autoritativa
- Uso recomendado por agentes técnicos (`backend-developer`, `ai-engineer`, `api-designer`):
  - "Resolver librerías" → `resolve-library-id` para: `vercel/next.js` (Edge Functions), `supabase/supabase`, `openai/openai-node`.
  - "Obtener docs" → `get-library-docs` por tema: routing (Edge), storage/RLS (Supabase), chat/embeddings/audio (OpenAI).
  - Integrar fragmentos citados en PRs y en `docs/architecture/`.

## Integración de agentes por Fases (con expertos y prompts)

### Fase 0: Preparación
- Expertos: `api-designer`, `docs-architect`, `data-engineer`, `ai-engineer`, `prompt-engineer`.
- Prompts:
  - `api-designer`: "Define contratos REST (webhook/send/ai/transcribe/reminders), errores e idempotencia."
  - `data-engineer`: "Esquema con RLS e índices para users/conversations/messages/reminders/documents/embeddings."
  - `ai-engineer`: "Límites, timeouts, backoff y guardrails para GPT-4o/Whisper/Embeddings."
  - `docs-architect`: "OpenAPI 3.1 y guías con ejemplos curl."
  - MCP Context7: obtener docs de Vercel/Supabase/OpenAI para respaldar decisiones.

### Fase 1: Núcleo WhatsApp + Persistencia
- Expertos: `backend-developer` (`typescript-pro`), `ai-engineer`, `code-reviewer`, `qa`.
- Prompts:
  - `backend-developer`: "Implementa `/api/whatsapp/webhook` (validación HMAC/verify token) y `/api/whatsapp/send` con reintentos/backoff."
  - `ai-engineer`: "Servicio de intención + respuesta (máx 400 tokens, temperatura 0.7, timeout 3s)."
  - `code-reviewer`: "Evalúa seguridad (RLS/inputs), latencia y manejo de errores."
  - `qa`: `*risk`, `*design`, `*review`, `*gate`.
  - MCP Context7: docs de Edge routing/limits, Supabase RLS.

### Fase 2: Recordatorios (Cron)
- Expertos: `backend-developer`, `api-documenter`, `qa`.
- Prompts:
  - `backend-developer`: "Función cron `/api/cron/check-reminders` (cada minuto), estados y reintentos."
  - `api-documenter`: "Documenta endpoints de schedule/list, SLAs y límites."
  - `qa`: `*nfr` (fiabilidad), `*review`.
  - MCP Context7: Vercel Cron docs.

### Fase 3: Audio + Transcripción (Whisper)
- Expertos: `backend-developer` (`python-pro` si aplica), `ai-engineer`, `qa`.
- Prompts:
  - `backend-developer`: "Descarga y storage de audio (bucket `audio-files`), endpoint `/api/ai/transcribe`."
  - `ai-engineer`: "Parámetros Whisper (idioma es, fallback en), política de tamaño/timeout."
  - `qa`: `*risk` (tamaño/tiempos), `*review`.
  - MCP Context7: OpenAI audio API docs, Supabase Storage.

### Fase 4: RAG PDFs
- Expertos: `data-engineer`, `ai-engineer`, `backend-developer`, `qa`.
- Prompts:
  - `data-engineer`: "Modelo `documents` + `embeddings` (vector + metadata), índice adecuado."
  - `ai-engineer`: "Chunking, topK (≤5), coste/latencia por consulta, citas."
  - `backend-developer`: "Endpoints de upload/ingest y answer con retrieval."
  - `qa`: `*trace` + `*nfr` (costo/latencia), `*review`.
  - MCP Context7: OpenAI embeddings best practices; Supabase patterns.

### Fase 5: Multi-tenant Básico (opcional)
- Expertos: `backend-developer`, `api-designer`, `code-reviewer`.
- Prompts:
  - `backend-developer`: "`customers`, `whatsapp_configs`, health-check y setup-link firmado."
  - `api-designer`: "Contratos de onboarding multi-tenant."
  - `code-reviewer`: "Seguridad/secrets/RLS multi-tenant."
  - MCP Context7: Supabase RLS multi-tenant patterns.

## Roadmap por Fases y Entregables

### Fase 0: Preparación
- Shard de documentos (BMAD Master). Entornos Vercel/Supabase/OpenAI.

### Fase 1: Núcleo WhatsApp + Persistencia
- 1.1–1.5 completado, p50 < 1s/p95 < 2s.

### Fase 2: Recordatorios (Cron)
- Envío puntual ±1min, estados consistentes.

### Fase 3: Audio + Transcripción (Whisper)
- Flujo E2E de audio operativo.

### Fase 4: RAG PDFs
- Recuperación con citas y control de costos.

### Fase 5: Multi-tenant Básico (opcional)
- Onboarding customers/configs + health-checks.

## Flujo Operativo por Historia (SM → Dev → QA)
1. `@sm` → `*draft` genera historia (`docs/stories/`, Draft).
2. Aprobación → Approved.
3. `@dev` → `*develop-story {id}` implementa + tests → Review.
4. `@qa` → `*review` y `*gate` → Done/ajustes.

## Principios de Calidad y Seguridad
- RLS y sanitización; no loggear secretos/PII; request_id.
- Timeouts/reintentos/backoff; circuit breakers.
- Tests determinísticos y gates QA.

## Métricas y SLAs
- Latencia p50 < 1s, p95 < 2s (texto); disponibilidad > 99.9%.
- Costo/usuario < $2/mes; éxito entrega; uso por feature.

## Lista de Endpoints (Edge)
- `POST /api/whatsapp/webhook`
- `POST /api/whatsapp/send`
- `POST /api/ai/intent` | `POST /api/ai/answer`
- `POST /api/ai/transcribe`
- `POST /api/documents/upload` | `POST /api/documents/ingest`
- `POST /api/templates` | `POST /api/templates/send`
- `POST /api/reminders/schedule` | `GET /api/reminders`
- `GET /api/conversations/:id/messages`
- `GET /api/health`

## Plan de Entorno y Configuración
- Vercel: Edge Functions, Cron, Env.
- Supabase: PostgreSQL/Auth/Storage (RLS, índices, pooling).
- OpenAI: claves y políticas de uso.

## Riesgos y Mitigaciones
- Rate-limit WhatsApp → backoff y colas livianas.
- Costos IA → caching, topK pequeño, límites tokens.
- Storage → retención/limpieza y monitorización.

## Cierre y Aceptación por Fase
- Historias PASS con gates QA y KPIs/NFRs mínimos cumplidos.
