# migue.ai - PRD v4 (WhatsApp → Vercel Edge → Supabase → OpenAI)

## 1. Contexto y Problema
Profesionales y pequeñas empresas en LatAm necesitan un asistente en WhatsApp para tareas de productividad (citas, recordatorios, análisis de contenido). Las soluciones actuales son fragmentadas o de alto costo/latencia.

## 2. Objetivo del Producto
Crear un asistente personal en WhatsApp con latencia baja (1–2s), útil 24/7, que automatice citas, recuerde tareas, transcriba audios, resuma PDFs/videos y ofrezca RAG básico; escalable y coste-eficiente.

### 2.1 Personas
- Profesional independiente (consultor/coach): agenda dinámica, requiere recordatorios y toma de notas por audio.
- PyME (servicios): agendamiento y confirmaciones con clientes, plantillas útiles, seguimiento de cancelaciones.
- Estudiante/creador: resúmenes de PDFs y transcripciones rápidas de notas de voz.

## 3. Alcance (MVP)
- Recepción y envío de mensajes WhatsApp.
- Intent detection (OpenAI) y respuesta textual.
- Persistencia de conversaciones/mensajes/contactos (Supabase + RLS).
- Recordatorios con Vercel Cron.
- Transcripción de audios (Whisper) y respuestas resumidas.
- RAG básico sobre PDFs (embeddings OpenAI + Supabase Storage).

Fuera de alcance MVP: dashboard UI, multicanal, billing, analítica avanzada.

### 3.1 No-Objetivos (MVP)
- UI web de administración (pos-MVP).
- Integraciones complejas (CRM/ERP) más allá de Google Calendar básico.
- Llamadas de voz/Video o procesamiento de audio en tiempo real.

## 4. Usuarios y Casos de Uso
- Individual: recordar citas, tomar notas por audio, resumen de PDFs.
- PyME: agendar citas con confirmación, mensajes de seguimiento, plantillas útiles.

## 5. Requisitos Funcionales (alto nivel)
- RF1: Webhook de WhatsApp valida firmas y normaliza mensajes.
- RF2: Envío de mensajes (texto + basic media) y plantillas.
- RF3: Conversaciones/mensajes/usuarios/contactos almacenados con RLS.
- RF4: Detección de intención y respuesta con OpenAI (timeouts y límites).
- RF5: Recordatorios programables y notificaciones puntuales.
- RF6: Transcripción de audios de WhatsApp con Whisper.
- RF7: Ingesta de PDFs, embeddings y recuperación contextual (RAG básico).

### 5.1 Visión general de APIs (Edge)
- `POST /api/whatsapp/webhook` (recepción, validación firma/token)
- `POST /api/whatsapp/send` (envío, reintentos, rate-limit)
- `POST /api/ai/intent` | `POST /api/ai/answer`
- `POST /api/ai/transcribe`
- `POST /api/documents/upload` | `POST /api/documents/ingest`
- `POST /api/reminders/schedule` | `GET /api/reminders`
- `GET /api/conversations/:id/messages`

## 6. Restricciones y Arquitectura
- Arquitectura: WhatsApp → Vercel Edge Functions → Supabase → OpenAI.
- Timeouts: Edge (10–60s) → diseñar funciones cortas, streaming opcional.
- Seguridad: sin secretos en código; RLS + validación entradas; HMAC webhooks.
- Costos: objetivo $75–95/mes (Vercel Pro + Supabase Pro + OpenAI estimado).

### 6.1 Dependencias externas
- Meta WhatsApp Business API (webhook/send).
- OpenAI (GPT-4o/Whisper/Embeddings).
- Vercel (Edge Functions, Cron, Env).
- Supabase (PostgreSQL/Auth/Storage).

## 7. Épicas y Historias Iniciales
### Epic 1: Base plataforma y webhook
- 1.1 Webhook: validación token/firma, parsing de mensajes, logs mínimos.
- 1.2 Envío: endpoint `send` con reintentos y manejo de rate-limits.
- 1.3 Esquema DB: `users`, `conversations`, `messages` con índices/RLS.
- 1.4 Intent: servicio OpenAI con límites, prompts y fallbacks.
- 1.5 Orquestación: persistir → generar → responder → trazabilidad.

### Epic 2: Audio y transcripción
- 2.1 Descarga a Supabase Storage (bucket `audio-files`).
- 2.2 Transcripción Whisper (idioma es, fallback en).
- 2.3 Resumen/acción basada en transcripción.

### Epic 3: Recordatorios
- 3.1 Tabla `reminders` + estados.
- 3.2 Vercel Cron `/api/cron/check-reminders` (cada minuto).
- 3.3 Envío y actualización de estado con reintentos.

### Epic 4: RAG PDFs
- 4.1 Storage `documents` + metadatos.
- 4.2 Embeddings OpenAI + tabla `embeddings` (vector + metadata).
- 4.3 Recuperación y citas en respuestas.

## 8. NFRs (No-Funcionales)
- Latencia promedio: < 1.5s en respuestas de texto.
- Disponibilidad: > 99.9% (Edge + Supabase managed).
- Seguridad: RLS activo; HMAC en webhooks; sanitización de entradas; no loggear PII sensible.
- Observabilidad: logs estructurados, request_id, métricas clave.
- Escalabilidad: >1000 req/min (Edge global + DB pooling, caché selectiva).

## 9. KPIs
- Tiempo de respuesta (p50/p95).
- Éxito de entrega de mensajes.
- Uso de funcionalidades (audio, RAG, recordatorios).
- Retención 30 días y satisfacción (>4.5/5 cualitativo).
- Costo por usuario < $2/mes.

## 10. WhatsApp Cost Strategy y Compliance
- Maximizar ventana CSW de 24h con alta utilidad.
- Plantillas: uso estratégico fuera de CSW.
- Cumplir políticas Meta; respetar límites de rate.

### 10.1 Privacidad y Cumplimiento
- PII mínima: almacenar solo lo necesario (teléfono, contenido imprescindible).
- Eliminación/retención: políticas para cleanup de audios/documentos y mensajes antiguos.
- Cifrado en tránsito (HTTPS) y control de acceso por RLS; no exponer secretos en logs.

## 11. Riesgos y Mitigaciones
- Rate limits/timeout: reintentos exponenciales, colas livianas.
- Costos IA: límites de tokens y caching de prompts.
- Storage crecimiento: políticas de retención/limpieza.
- Falla de integraciones: circuit breakers y fallback de respuestas.

## 12. Aceptación MVP
- Historias de Epic 1 completas y estables.
- Al menos 1 camino feliz E2E por epic 2–4.
- NFR de latencia cumplido en p50/p95.
- Logs y métricas básicas habilitadas.

### 12.1 Criterios de aceptación (resumen)
- Mensajería texto: webhook→persistencia→IA→respuesta en <2s p95.
- Recordatorios: entrega ±1 minuto y actualización de estado.
- Audio: transcripción exitosa para audios ≤ 2 min, respuesta resumida.
- RAG: respuesta con 1–2 citas relevantes y costo/tokens bajo umbral definido.
