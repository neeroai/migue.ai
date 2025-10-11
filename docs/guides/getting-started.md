## migue.ai - Setup

Requisitos
- Node 20+, npm 10+
- Cuentas: Vercel, Supabase, OpenAI

Instalación
1. npm install
2. Configura variables en Vercel (no subir `.env` al repo):
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_SECRET`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
   - `TIMEZONE` (ej. America/Mexico_City)
3. `npm run typecheck`

Desarrollo
- `npm run dev` (vercel dev)
- Webhook: `GET /webhook` (verify), `POST /webhook` (eventos)

Supabase
- Ejecuta `supabase/schema.sql` (ajusta RLS antes de producción).

OpenAPI
- Ver `docs/openapi.yaml`.


