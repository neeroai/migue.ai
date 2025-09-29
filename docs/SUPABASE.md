## Supabase: guía de configuración y compatibilidad

### Estado de compatibilidad del `schema.sql`
- Compatible con Supabase (PostgreSQL 15+).
- Idempotente: usa `IF NOT EXISTS` donde aplica y `DROP IF EXISTS + CREATE` para policies/constraints.
- Extensiones:
  - `pgcrypto`, `pg_trgm` se habilitan con `create extension if not exists`.
  - `vector` queda comentado; habilítalo si migras a pgvector.
- Tipos y dominios:
  - Enums: `msg_direction`, `conv_status`, `msg_type`, `reminder_status`.
  - `msg_type` se extiende con valores de WhatsApp dentro de `DO $$` (seguro si ya existen).
  - Dominio `e164` para `phone_number` (valida formato E.164).
- RLS:
  - Tablas habilitadas con RLS.
  - Policies de desarrollo “allow_all_*” (permisivas). Sustituir por policies basadas en `auth.uid()` antes de producción.
- Constraints clave:
  - Unicidad: `wa_message_id`, `wa_conversation_id` (no nulo), `(user_id, bucket, path)` en `documents`.
  - Mensajes: XOR `content`/`media_url` y requisitos por tipo.
  - `reminders`: transición de estado validada por trigger y `send_token` idempotente.

### Pasos de instalación
1) Crear proyecto en Supabase y obtener `SUPABASE_URL` y `service_role` (para server-side).
2) SQL Editor → ejecutar `supabase/schema.sql` completo.
3) Storage → crear buckets privados: `audio-files`, `documents`.
4) Variables en Vercel:
   - `SUPABASE_URL`, `SUPABASE_KEY` (service_role)
   - `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_ID`

### Operación (CLI)
- Instalar CLI: `npm i -g supabase`
- Login: `supabase login` (token desde Account → Tokens)
- Enlace proyecto: `supabase link --project-ref <ref>`
- Aplicar schema desde repo (alternativa al SQL Editor):
  - `supabase db push --db-url "$SUPABASE_URL"`
  - o generar migración: `supabase migration new init` y colocar SQL.

### Buenas prácticas RLS (producción)
- Reemplazar policies permisivas por policies por rol/usuario:
  - Lectura por dueño (`user_id`) y operaciones de sistema sólo con `service_role` desde Edge Functions.
- Propagar `request_id` y `auth.uid()` a la DB cuando sea relevante.

### pgvector (opcional)
- Habilitar extensión `vector` en “Database → Extensions”.
- Cambiar `public.embeddings.vector jsonb` por `embedding vector(1536)` e indexar con `ivfflat`.

### Verificación rápida
- `select version();` (PG 15+)
- `select * from pg_extension;` (ver `pgcrypto` y `pg_trgm`)
- `\d+ public.messages_v2` (estructura y constraints)
- Inserciones de prueba en `users`, `conversations`, `messages_v2` respetando checks.

### Troubleshooting
- Error “create policy if not exists”: Postgres no lo soporta. Usa `drop policy if exists` + `create policy`.
- Error de `ADD CONSTRAINT IF NOT EXISTS`: usa `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT`.
- Permisos al ejecutar desde app: usa la `service_role` en server-side; nunca exponerla en cliente.


