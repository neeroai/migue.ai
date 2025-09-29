# Requisitos Funcionales + APIs

## Requisitos Funcionales (alto nivel)
- RF1: Webhook de WhatsApp valida firmas y normaliza mensajes.
- RF2: Envío de mensajes (texto + basic media) y plantillas.
- RF3: Conversaciones/mensajes/usuarios/contactos almacenados con RLS.
- RF4: Detección de intención y respuesta con OpenAI (timeouts y límites).
- RF5: Recordatorios programables y notificaciones puntuales.
- RF6: Transcripción de audios de WhatsApp con Whisper.
- RF7: Ingesta de PDFs, embeddings y recuperación contextual (RAG básico).

## Visión general de APIs (Edge)
- `POST /api/whatsapp/webhook`
- `POST /api/whatsapp/send`
- `POST /api/ai/intent` | `POST /api/ai/answer`
- `POST /api/ai/transcribe`
- `POST /api/documents/upload` | `POST /api/documents/ingest`
- `POST /api/reminders/schedule` | `GET /api/reminders`
- `GET /api/conversations/:id/messages`
