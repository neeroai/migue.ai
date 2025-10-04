# Google Calendar Integration

## Flujo
1. El intent classifier detecta `schedule_meeting`.
2. `lib/scheduling.ts` usa GPT-4o-mini para extraer fecha, hora y participantes.
3. Si faltan datos, responde con una aclaración rápida.
4. Con datos completos, `lib/google-calendar.ts` asegura el access token (refresh automático) y crea el evento en el calendario primario.
5. El evento queda auditado en `calendar_events` y el usuario recibe la confirmación por WhatsApp.

## Requisitos de entorno
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (OAuth client tipo Web).
- Tokens de usuario almacenados en `calendar_credentials` (`refresh_token`, scope `https://www.googleapis.com/auth/calendar.events`).
- Supabase con las nuevas tablas migradas (`supabase/schema.sql`).

## Operación
- Para analizar mensajes ambiguos el sistema envía un prompt estructurado y puede pedir campos faltantes.
- El módulo crea enlaces de Google Meet automáticamente (`conferenceDataVersion=1`).
- Errores por credenciales faltantes devuelven un mensaje solicitando vincular el calendario.

## Testing
Ejecuta los tests unitarios con Watchman deshabilitado:

```bash
npx jest tests/unit --watchman=false -- runInBand
```

Los tests relevantes son:
- `tests/unit/scheduling.test.ts`
- `tests/unit/google-calendar.test.ts`

## Próximos pasos
- Añadir soporte para sugerencias de franjas disponibles (`freebusy.query`).
- Persistir zona horaria preferida del usuario en `users.preferences` y compartirla con la extracción.
- Implementar cancelaciones via comando de WhatsApp.
