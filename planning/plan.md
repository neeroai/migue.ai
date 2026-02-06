# Plan de mejoras (migue.ai)

## Contexto
- Stack: Next.js 16 (Edge), Supabase, Vercel AI SDK, WhatsApp Cloud API.
- Objetivo: robustez en Edge, evitar dobles respuestas, control de costos y privacidad.

## Fase 0: Preparacion (P0)
- Confirmar decision de OCR: mover a runtime nodejs o servicio externo.
- Definir comportamiento de captions en media (una sola respuesta).

## Fase 1: Correcciones criticas (P0)
- OCR/Documentos:
  - Mover procesamiento OCR a ruta/worker Node.js.
  - Edge solo valida, persiste y encola tarea.
  - Agregar timeouts y manejo de errores consistente.
- Doble respuesta en media:
  - Si type es image/document, no ejecutar AI de texto en caption.
  - Combinar caption + OCR en una unica respuesta cuando aplique.

## Fase 2: Confiabilidad y costos (P1)
- Rate limiting distribuido:
  - Migrar a Redis/Upstash o tabla Supabase con TTL.
  - Mantener limites por usuario con backoff.
- Budget tracking distribuido:
  - Persistir y leer contadores diarios/mensuales compartidos.
  - Evitar drift por instancias Edge.

## Fase 3: Seguridad y observabilidad (P1)
- Enmascarar numeros de telefono en logs de errores.
- Agregar metricas para OCR/Media (exitos, fallas, latencia).

## Fase 4: Calidad y pruebas (P2)
- Desbloquear tests skip de WhatsApp (aislar env con resetEnv).
- Tests para media con caption (solo una respuesta).

## Entregables
- Cambios en rutas/servicios OCR.
- Ajustes de flujo de mensajes para media.
- Rate limiting y budget compartidos.
- Nuevos tests y ajustes de logging.
