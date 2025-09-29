# Restricciones y Arquitectura

- Arquitectura: WhatsApp → Vercel Edge Functions → Supabase → OpenAI.
- Timeouts: Edge (10–60s) → funciones cortas; streaming opcional.
- Seguridad: sin secretos en código; RLS + validación; HMAC webhooks.
- Costos: $75–95/mes objetivo (Vercel Pro + Supabase Pro + OpenAI estimado).
- Dependencias: Meta WhatsApp, OpenAI, Vercel, Supabase.
