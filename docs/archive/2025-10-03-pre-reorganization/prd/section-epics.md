# Épicas e Historias Iniciales

## Epic 1: Base plataforma y webhook
- 1.1 Webhook: validación token/firma, parsing de mensajes, logs mínimos.
- 1.2 Envío: endpoint `send` con reintentos y manejo de rate-limits.
- 1.3 Esquema DB: `users`, `conversations`, `messages` con índices/RLS.
- 1.4 Intent: servicio OpenAI con límites, prompts y fallbacks.
- 1.5 Orquestación: persistir → generar → responder → trazabilidad.

## Epic 2: Audio y transcripción
- 2.1 Descarga a Supabase Storage (bucket `audio-files`).
- 2.2 Transcripción Whisper (idioma es, fallback en).
- 2.3 Resumen/acción basada en transcripción.

## Epic 3: Recordatorios
- 3.1 Tabla `reminders` + estados.
- 3.2 Vercel Cron `/api/cron/check-reminders` (cada minuto).
- 3.3 Envío y actualización de estado con reintentos.

## Epic 4: RAG PDFs
- 4.1 Storage `documents` + metadatos.
- 4.2 Embeddings OpenAI + tabla `embeddings` (vector + metadata).
- 4.3 Recuperación y citas en respuestas.
