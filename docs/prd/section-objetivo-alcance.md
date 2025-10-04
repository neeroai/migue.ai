# Objetivo, Personas y Alcance (MVP)

## Objetivo
Crear un asistente personal en WhatsApp con latencia baja (1–2s), útil 24/7, que automatice citas, recuerde tareas, transcriba audios, resuma PDFs/videos y ofrezca RAG básico; escalable y coste-eficiente.

## Personas
- Profesional independiente (consultor/coach)
- PyME (servicios)
- Estudiante/creador

## Alcance (MVP)
- Recepción y envío de mensajes WhatsApp
- Intent detection y respuesta textual (OpenAI)
- Persistencia (Supabase + RLS)
- Recordatorios (Vercel Cron)
- Transcripción de audios (Whisper)
- RAG básico de PDFs (Embeddings + Storage)

### No-Objetivos (MVP)
- UI web de administración (pos-MVP)
- Integraciones complejas (CRM/ERP)
- Llamadas/Video o audio en tiempo real
