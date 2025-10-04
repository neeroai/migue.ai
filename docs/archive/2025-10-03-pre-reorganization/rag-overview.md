# Retrieval-Augmented Generation (RAG)

## Ingestión
1. Subir documento a Supabase Storage (bucket `documents`).
2. Extraer texto (actualmente se espera texto plano; soporte PDF vendrá en fase siguiente).
3. `lib/rag/ingestDocument` normaliza, trocea y genera embeddings con `text-embedding-3-large`.
4. Los chunks se guardan en `public.embeddings` con metadata (`user_id`, contenido) vía `storeEmbedding`.

## Búsqueda y Respuesta
- `lib/rag/use-rag.retrieveContext` genera embedding de la consulta y calcula similitud coseno con los chunks del usuario.
- `lib/response.generateResponse` usa los fragmentos mejor rankeados al manejar intent `analyze_document`, inyectando contexto antes de llamar a GPT-4o.
- Si no hay embeddings disponibles, continúa con la respuesta estándar.

## Configuración
- Tablas `documents` y `embeddings` en Supabase (ver `supabase/schema.sql`).
- Variables de entorno: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
- Límites actuales: documentos < 10 MB, chunk de 1.5k caracteres con 200 de overlap.

## Testing
Ejecuta las pruebas unitarias relevantes:

```bash
npx jest tests/unit/rag-chunk.test.ts tests/unit/rag-ingest.test.ts tests/unit/rag-search.test.ts --watchman=false
```

## Próximos Pasos
- Añadir parser PDF → texto en Edge (o Supabase Functions).
- Persistir métricas (tamaño documento, fecha de ingestión) para caducidad.
- Soportar paginación y filtros por documento desde `retrieveContext`.
