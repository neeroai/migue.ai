# BMAD - Siguientes Pasos y Subagentes (Arquitectura Vercel + Supabase + OpenAI)

## Objetivo
Reiniciar el flujo con BMAD para implementar la arquitectura: WhatsApp Business API -> Vercel Edge Functions -> Supabase -> OpenAI API.

## Workflow recomendado (sin UI inicial)
- Orquestador: bmad-orchestrator
- Workflow: greenfield-service

## Secuencia de subagentes y entregables
1) PM (`@pm`)
- Crear PRD v4 con `templates/prd-tmpl.yaml`.
- Entrega: `docs/prd.md`.

2) Architect (`@architect`)
- Arquitectura técnica alineada a WhatsApp -> Vercel Edge Functions -> Supabase -> OpenAI.
- Crear desde `templates/fullstack-architecture-tmpl.yaml` (o `architecture-tmpl.yaml`).
- Entrega: `docs/architecture.md`.

3) PO (`@po`)
- Coherencia y completitud entre PRD y Arquitectura.
- Ejecutar checklist `po-master-checklist.md`.
- Entrega: ajustes en PRD/Arquitectura.

4) BMad Master (`@bmad-master`)
- Preparar desarrollo shardando documentos:
  - `*shard-doc docs/prd.md prd`
  - `*shard-doc docs/architecture.md architecture`
- Entrega: `docs/prd/` y `docs/architecture/` poblados.

5) SM (`@sm`)
- Generar la primera historia a partir de los shards.
- Acción: `*draft` (create-next-story).
- Entrega: `docs/stories/1.1.story.md` (Draft -> Approved).

6) Dev (`@dev`)
- Implementación segura y testeada por historia.
- Acción: `*develop-story {story}`; implementar, tests, lint.
- Entrega: código + tests, historia en "Review".

7) QA (`@qa`)
- Calidad, riesgos y gate por historia.
- Acciones según riesgo:
  - Antes/durante: `*risk`, `*design`, `*trace`, `*nfr`.
  - Final: `*review` y `*gate`.
- Entregas: `docs/qa/assessments/*`, `docs/qa/gates/*`, resultados en la historia.

8) Orchestrator (`@bmad-orchestrator`)
- Mantener el ciclo SM -> Dev -> QA por historias y épicas.

9) Analyst (opcional, `@analyst`)
- Refinar alcance/mercado o documentar brownfield externo.

10) UX Expert (opcional, `@ux-expert`)
- Solo si añadimos UI (dashboard/portal).

## Épicas y primeras historias sugeridas (service-only)
- Epic 1: Base plataforma y webhook
  - 1.1 Vercel Edge Function `webhook` (verificación/firmas)
  - 1.2 Cliente WhatsApp Send API (texto, errores/rate-limit)
  - 1.3 Supabase: `users`, `conversations`, `messages` con RLS
  - 1.4 Intent detection OpenAI (prompt + límites/timeout)
  - 1.5 Orquestación: persistir -> generar -> responder -> logging

- Epic 2: Audio y transcripción
  - 2.1 Descarga y storage (`audio-files`)
  - 2.2 Transcripción Whisper
  - 2.3 Resumen/respuesta basada en transcripción

- Epic 3: Recordatorios (Cron)
  - 3.1 Esquema `reminders` + estados
  - 3.2 Vercel Cron -> `check-reminders`
  - 3.3 Notificación + reintentos

- Epic 4: RAG básico para PDFs
  - 4.1 Storage `documents` + metadatos
  - 4.2 Embeddings OpenAI + tabla de vectores
  - 4.3 Recuperación y respuesta citada

## Activación rápida (desde Cursor)
- Orquestador: `@bmad-orchestrator` -> `*help` -> `*workflow greenfield-service`
- PM: `@pm` -> `*create-doc prd`
- Architect: `@architect` -> `*create-doc fullstack-architecture`
- Master: `@bmad-master` -> `*shard-doc docs/prd.md prd` y `*shard-doc docs/architecture.md architecture`
- SM: `@sm` -> `*draft`
- Dev: `@dev` -> `*develop-story 1.1`
- QA: `@qa` -> `*review 1.1` (y `*risk/*design/*trace/*nfr` según riesgo)
- PO: `@po` -> `*execute-checklist-po`

## Notas
- Comenzar con workflow `greenfield-service`. Si más adelante hay UI, sumar `greenfield-fullstack` y `@ux-expert`.
- Mantener estrictamente el ciclo SM->Dev->QA con gates y trazabilidad.
