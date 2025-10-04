# NFRs y KPIs

## NFRs
- Latencia promedio: < 1.5s en respuestas de texto.
- Disponibilidad: > 99.9% (Edge + Supabase managed).
- Seguridad: RLS activo; HMAC en webhooks; sanitización; no PII sensible en logs.
- Observabilidad: logs estructurados, request_id, métricas clave.
- Escalabilidad: >1000 req/min (Edge + pooling + cache selectiva).

## KPIs
- Tiempo de respuesta (p50/p95).
- Éxito de entrega de mensajes.
- Uso de funcionalidades (audio, RAG, recordatorios).
- Retención 30 días y satisfacción (>4.5/5 cualitativo).
- Costo por usuario < $2/mes.
