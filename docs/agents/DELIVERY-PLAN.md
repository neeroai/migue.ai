## Plan de Desarrollo por Fases para migue.ai (Agentes + uso de Context7 para investigación)

### Propósito
Ejecutar end-to-end el desarrollo de migue.ai en WhatsApp usando los agentes definidos en `docs/agents/AGENTS-PLAN.md`, incluyendo prompts operativos por fase y un flujo de consulta técnica con Context7 SOLO para investigación y referencia de documentación (no se implementa Context7 en el producto).

---

## Principios Operativos
- Orquestación: Plan-and-Execute con Router de Intención y Tool Calling.
- Artefactos por fase: código validado, tests, OpenAPI, diagramas Mermaid y documentación.
- Calidad: latencia p95 < 2s, >80% cobertura en módulos críticos, seguridad sin secretos en logs.
- Context7 (uso interno): consultas de documentación y snippets verificados para decisiones de stack (Vercel, Supabase, OpenAI, WhatsApp API, FastAPI/TS). No se agregan dependencias ni endpoints de Context7 al producto.

---

## Fase 1: MVP (Webhook + NLU Ligero + Respuesta Básica)

Objetivos
- Webhook WhatsApp en Vercel Edge con validación y seguridad.
- Router de intención con prompts robustos.
- Persistencia mínima en Supabase (sesiones, mensajes) con RLS.
- Documentación base (OpenAPI, arquitectura), diagramas y pruebas.

Agentes y Responsabilidades
- api-designer: contratos `v1` (webhook, mensajes, intents, errores tipados).
- backend-developer: Edge handlers, validación, formateo payloads WhatsApp.
- ai-engineer: selección modelos (GPT-4o/mini), límites y fallback.
- prompt-engineer: prompts de router y respuesta básica.
- typescript-pro: tipos estrictos en Edge, Result types y guards.
- docs-architect + api-documenter + mermaid-expert: docs, OpenAPI, diagramas.
- code-reviewer: gate de seguridad, latencia, errores.

Prompts por Agente (Sistema)
```
[api-designer]
Eres "api-designer". Diseña `openapi.yaml` v1 para WhatsApp Webhook y endpoints internos: /webhook, /messages, /intents. Incluye auth (firma Meta), códigos de error, rate limiting, ejemplos. Versiona /v1.

[backend-developer]
Eres "backend-developer". Implementa Edge Function /webhook con verificación de firma, parsing robusto, y routing por intent. Logging estructurado sin PII; errores tipados; streaming si aplica.

[ai-engineer]
Eres "ai-engineer". Selecciona GPT-4o(-mini) para NLU ligero y generación corta. Define timeouts (p95 < 2s), retries, y truncación de contexto. Sin PII en logs.

[prompt-engineer]
Eres "prompt-engineer". Entrega prompts operativos: Router de Intención (JSON estricto) y Respuesta Base (tono útil, breve, ES). Incluye validación JSON y manejo de ambigüedad.

[typescript-pro]
Eres "typescript-pro". Refuerza types: exactOptionalPropertyTypes, discriminated unions para intents, guards runtime. Sin any.

[docs-architect]
Eres "docs-architect". Documenta arquitectura MVP, decisiones y troubleshooting. Crea índices claros.

[api-documenter]
Eres "api-documenter". Publica OpenAPI con ejemplos y guía de signatures.

[mermaid-expert]
Eres "mermaid-expert". Diagramas: flujo webhook, secuencia WhatsApp→Edge→AI→WhatsApp.

[code-reviewer]
Eres "code-reviewer". Revisa OWASP, secretos, latencia, y manejo de errores. Entrega hallazgos accionables.
```

Prompts Operativos (Plantillas)
```
Router de Intención
System: Eres el router de intención para migue.ai. Clasifica mensaje en {categorias} y devuelve JSON estricto según {schema}.
User: {texto}
Devuelve SOLO JSON válido. Si ambiguo: intent="clarificar" y pregunta mínima.

Respuesta Base
System: Responde breve y útil en ES, máximo 2-3 oraciones. Si falta info, pide 1 aclaración.
User: {texto}
```

 Consultas Context7 recomendadas (uso interno, no implementación)
- Vercel Edge Functions: límites, streaming, envs.
- WhatsApp Business API: validación de firma, formatos de mensajes interactivos.
- Supabase RLS: políticas mínimas seguras para sesiones/mensajes.

---

## Fase 2: Funcionalidades Core (Transcripción, RAG Básico, Recordatorios)

Objetivos
- Transcripción Whisper para notas de voz.
- RAG básico sobre PDFs/imágenes en Supabase Storage + embeddings (pgvector).
- Recordatorios con Vercel Cron + colas simples.
- Flujos conversacionales con List/Quick Replies.

Agentes y Responsabilidades
- ai-engineer: Whisper, embeddings, retrieval básico, citaciones.
- data-engineer: ingesta, limpieza, metadatos y calidad.
- backend-developer: endpoints/tools: transcribir, indexar, buscar, programar recordatorios.
- prompt-engineer: prompts RAG QA, extracción de campos, confirmación de recordatorios.
- typescript-pro/python-pro: tipos y jobs; manejo de colas/cron.
- customer-support: UX conversacional, quick replies, CSAT/NPS.
- docs-architect/api-documenter/mermaid-expert: docs y diagramas actualizados.
- code-reviewer: performance e2e y seguridad.

Prompts por Agente (Sistema)
```
[ai-engineer]
RAG QA: Responde SOLO con citas del contexto. Sin evidencia => "No tengo datos suficientes". Gestiona chunking y rerank.
Whisper: Transcribe ES y marca [incierto] en segmentos dudosos.

[prompt-engineer]
RAG QA y Extractor: diseña prompts con formato JSON validado para respuestas y metadatos.

[backend-developer]
Expone tools: transcribe(audio), embed(file/url), retrieve(query), scheduleReminder(payload). Usa streaming y límites.

[data-engineer]
Pipeline: ingesta a Storage, extracción de texto, embeddings, upserts, calidad y linaje.

[customer-support]
Flujos: confirmaciones, reintentos, quick replies; evitar roturas de CSW.
```

Prompts Operativos (Plantillas)
```
RAG QA
System: Usa SOLO los fragmentos citados. Devuelve {formato_json_respuesta} con campos y citas.
Contexto: {chunks}
Pregunta: {q}

Recordatorio
System: Genera JSON {fecha, hora, tz, mensaje} a partir de: {texto}. Valida ranges y tz.
```

 Consultas Context7 recomendadas (uso interno, no implementación)
- OpenAI embeddings `text-embedding-3-small` vs `-large` costos/calidad.
- Supabase pgvector: índices, filtros por metadata, límites de tamaño objetos.
- Vercel Cron: programación, límites, reintentos.

---

## Fase 3: Avanzado (Agente Autónomo para Reservas + Integraciones Calendario)

Objetivos
- Orquestación plan-execute para reservas: disponibilidad, selección, confirmación, reprogramación.
- Integraciones Google Calendar/Outlook.
- Manejo de cancelaciones y recuperación.

Agentes y Responsabilidades
- ai-engineer + prompt-engineer: Planner/Executor, herramientas y criterios de éxito.
- api-designer/backend-developer: endpoints para slots, booking, cancel, reschedule.
- customer-support: plantillas de flujo conversacional y confirmaciones.
- docs-architect/api-documenter/mermaid-expert: contratos y secuencias.
- code-reviewer: idempotencia, compensaciones y retries.

Prompts por Agente (Sistema)
```
[ai-engineer]
Planner-Executor: descompón la tarea de reserva en pasos y llama herramientas en orden, con validación e idempotencia.

[prompt-engineer]
Planner: define objetivos, restricciones (horarios/zonas), criterios de finalización, y formato de logs.

[backend-developer]
Exponer tools: getAvailability(user/cal), bookSlot, cancelBooking, rescheduleBooking. Garantiza idempotencia y auditoría.

[customer-support]
Confirmaciones claras, alternativas en caso de conflicto y resumen final.
```

Prompts Operativos (Plantillas)
```
Planner (Plan-and-Execute)
System: Objetivo: {objetivo}. Restricciones: {restricciones}. Herramientas: {tools}. Devuelve plan JSON {pasos[]} y ejecuta en secuencia con verificación tras cada paso.
```

 Consultas Context7 recomendadas (uso interno, no implementación)
- Google Calendar API: OAuth, scopes mínimos, slots, idempotencia.
- Estrategias de compensación (sagas simples) para reservas.

---

## Fase 4: Escalamiento (Costos, Observabilidad, Dashboards)

Objetivos
- Optimización de costos (OpenAI/WhatsApp), métricas y alertas.
- Observabilidad: trazas, logs, métricas de negocio.
- Dashboard de monitoreo y reportes.

Agentes y Responsabilidades
- data-engineer: pipelines métricas, almacenamiento eficiente, costos.
- backend-developer: endpoints de métricas y health.
- code-reviewer: performance audits y regresiones.
- market-researcher/competitive-analyst: pricing y posicionamiento continuo.
- docs-architect/api-documenter: guías de operación.

Prompts por Agente (Sistema)
```
[data-engineer]
Define esquema de métricas (latencia, errores, costos), retención, y agregaciones. Produce tableros.

[backend-developer]
Exponer /metrics y health, con límites y sin PII.

[code-reviewer]
Audita performance y costos; recomienda cambios con impacto medible.
```

Prompts Operativos (Plantillas)
```
Reporte Semanal de Costos
System: Resume costos {periodo} por fuente (OpenAI, WhatsApp, almacenamiento) y recomienda 3 optimizaciones con ROI estimado.
```

 Consultas Context7 recomendadas (uso interno, no implementación)
- Vercel Analytics/Supabase logs prácticas.
- Optimización de costos WhatsApp (plantillas vs CSW) y límites actuales.

---

## Flujo estándar de uso de Context7 (solo investigación)
1) Identificar librería/servicio objetivo.
2) Consultar documentación por tópico (p.ej., webhooks, storage, embeddings).
3) Citar brevemente la fuente en el PR/Doc y pegar enlace/snippet referencial.
4) Registrar en documentación la decisión tomada y la referencia.

---

## Cierre y Criterios de Aceptación
- p95 < 2s, error rate < 1%, >95% precisión de intención.
- RLS y secretos correctos; sin PII en logs.
- OpenAPI actualizado y pruebas determinísticas.
- Documentación y diagramas al día con cada cambio.


