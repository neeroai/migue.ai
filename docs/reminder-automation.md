# Reminder Automation

## Flujo
1. El intent classifier detecta `set_reminder`.
2. `lib/reminders.ts` usa GPT-4o-mini para extraer título, fecha/hora y notas.
3. Si faltan datos críticos, responde con una pregunta de aclaración.
4. Con todos los campos, el recordatorio se inserta en `supabase.reminders` con estado `pending`.
5. El cron `api/cron/check-reminders.ts` (programado vía Vercel) ejecuta cada minuto, busca recordatorios vencidos, envía WhatsApp y marca el estatus `sent` con un token de envío.

## Dependencias
- Tablas `reminders`, `users` en Supabase con RLS habilitado.
- Variables de entorno: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `OPENAI_API_KEY`.
- Cron job configurado en Vercel (`vercel.json` o panel) apuntando a `/api/cron/check-reminders`.

## Casos de Falla
- Si el usuario no tiene número registrado el recordatorio pasa a `failed` y se registra en la respuesta JSON del cron.
- Errores HTTP de WhatsApp detienen sólo ese recordatorio y se continúan los siguientes.
- Retries: reintentar se logra al mantener el estado `pending` o reiniciar manualmente el estatus.

## Testing
Ejecuta la suite unitaria con Watchman deshabilitado:

```bash
npx jest tests/unit --watchman=false
```

Pruebas relevantes:
- `tests/unit/reminders.test.ts`
- `tests/unit/cron-reminders.test.ts`

## Próximos Pasos
- Añadir recordatorios recurrentes y ventanas flexibles.
- Guardar `failures` en tabla dedicada para auditoría.
- Confirmar la zona horaria del usuario antes de convertir `datetime_iso`.
