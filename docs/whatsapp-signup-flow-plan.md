# WhatsApp Signup Flow Plan (MVP Name + Email)

## Objetivo
Disparar onboarding en el primer mensaje de usuarios nuevos, capturar `name` y `email`, persistir en `users`, y continuar la conversación con personalización activa.

## Arquitectura recomendada
1. Trigger en ingreso webhook:
- Si `users.name/email/onboarding_completed_at` no están completos, activar `user_signup_flow`.
- Bloquear temporalmente el turno AI para evitar acciones sin registro mínimo.

2. Data exchange endpoint:
- Meta invoca `POST /api/whatsapp/flows` (ya implementado en este repo).
- `BASIC_INFO` envía `{ name, email }` al endpoint.
- Backend valida, persiste y responde `SUCCESS`.

3. Persistencia y estado:
- Tabla `users`: `name`, `email`, `onboarding_completed_at`, `onboarding_version`.
- Tabla `flow_sessions`: estado `pending/in_progress/completed/expired`.

4. Fallback:
- Si falla envío de Flow, el bot pide datos por texto.
- Si expira sesión, reenviar flow una sola vez y luego fallback texto.

## Reglas de validación
- `name`: 2-60 chars, trim, sin control chars.
- `email`: formato válido, normalizado a lowercase.
- Idempotencia: reintentos no duplican efectos.

## Rollout operativo
1. Crear flow en Meta con JSON `user_signup_flow.endpoint.v1.json`.
2. Publicar flow y copiar `flow_id`.
3. Configurar env:
- `SIGNUP_FLOW_ENABLED=true`
- `SIGNUP_FLOW_ID=<flow_id_real_de_meta>`
- `WHATSAPP_APP_SECRET` correcto (firma de Flow endpoint).
4. Probar con un número nuevo.
5. Verificar:
- Mensaje inicial dispara flow.
- Completar form guarda `users.name/email`.
- Nuevo mensaje del mismo usuario ya no dispara flow.

## Métricas mínimas
- `signup.flow_sent`
- `signup.flow_completed`
- `signup.flow_failed`
- `signup.flow_expired`
- `signup.dropoff_screen`
- `signup.time_to_complete_ms`

## QA checklist
1. Usuario nuevo + primer mensaje -> se envía flow.
2. Email inválido -> se mantiene en pantalla de captura.
3. Envío válido -> pantalla éxito.
4. Usuario onboarded -> no vuelve a pedir signup.
5. Si flow no se puede enviar -> fallback por texto.

