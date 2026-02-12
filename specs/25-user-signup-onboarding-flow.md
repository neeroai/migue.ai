# 25 - user-signup-onboarding-flow

## Estado
- Semáforo: `YELLOW`
- Fase: `in_progress`
- Next Step: Cerrar gaps e2e y mover a GREEN con evidencia verificable.
- Updated: 2026-02-12 03:30
- Fuente de verdad: `architecture.md`
- Owner técnico: `src/shared/infra/whatsapp/flows.ts` + `src/modules/webhook/*` + `src/modules/ai/*`

## Objetivo funcional
Cuando un usuario nuevo envía su primer mensaje por WhatsApp, disparar un flujo de onboarding para capturar `nombre` y `email`, persistir los datos y habilitar personalización temprana del asistente.

## Alcance MVP
- Trigger automático de onboarding en el primer inbound de usuario no registrado/onboarding incompleto.
- Captura de `name` + `email` vía WhatsApp Flow.
- Persistencia en `users`.
- Marcado de onboarding completado para no repetir el flujo.
- Fallback por chat si Flow falla/expira.

## Fuera de alcance (esta iteración)
- Horario preferido de contacto.
- Idioma preferido.
- País/locale.
- Perfiling avanzado o scoring de usuario.

## Alineación Architecture Master
- LLM-first en respuestas conversacionales; backend decide guardrails y estado.
- Backend como fuente de verdad de identidad mínima del usuario.
- Observabilidad obligatoria del funnel de onboarding.

## Contratos clave
- Detección usuario nuevo:
  - `users` sin registro o con onboarding incompleto.
- Datos mínimos obligatorios:
  - `name`: string validado y normalizado.
  - `email`: string validado y normalizado.
- Estado onboarding:
  - `NOT_STARTED | IN_PROGRESS | COMPLETED | EXPIRED | FAILED`.

## Cambios de interfaz y datos (propuestos)
- `users`:
  - `email text null`
  - `onboarding_completed_at timestamptz null`
  - `onboarding_version text not null default 'v1'`
- `flow_sessions.session_data`:
  - `onboarding_status`
  - `screen_progress`
  - `captured_fields`

## Reglas de negocio
- Si usuario es nuevo y no está onboarding completo:
  - enviar `user_signup_flow` antes de ejecutar features sensibles.
- Chat básico permitido mientras completa onboarding.
- Tools de acción (ej: gastos, recordatorios, agenda) se pueden limitar por policy hasta completar onboarding.
- Si Flow expira o falla:
  - fallback guiado por chat para capturar `name/email`.

## Flujo funcional (alto nivel)
1. Inbound de WhatsApp.
2. Resolver/crear usuario por teléfono.
3. Evaluar estado onboarding.
4. Si incompleto:
   - enviar Flow `user_signup_flow`.
   - persistir `flow_session`.
5. Recibir `data_exchange` en `/api/whatsapp/flows`.
6. Validar y persistir `name/email`.
7. Marcar onboarding `COMPLETED`.
8. Confirmar al usuario y continuar conversación normal.

## Validaciones
- `name`: 2-60 caracteres, trim, sin control chars.
- `email`: formato válido, lower-case, trim.
- Idempotencia:
  - no duplicar escritura final por reintento de callback.

## Observabilidad mínima
- `signup.flow_sent`
- `signup.flow_completed`
- `signup.flow_failed`
- `signup.flow_expired`
- `signup.time_to_complete_ms`
- `signup.dropoff_screen`

## Evidencia mínima para `GREEN`
- Typecheck en verde.
- Unit tests:
  - validación de datos.
  - machine state onboarding.
- Integration tests:
  - callback `data_exchange` happy path.
  - expiración de token.
  - idempotencia por reintento.
- Validación productiva en WhatsApp:
  - usuario nuevo completa onboarding y luego recibe respuesta personalizada.

## Riesgos y mitigaciones
- Riesgo: abandono del flow.
  - Mitigación: fallback por chat y reintento controlado.
- Riesgo: datos parciales.
  - Mitigación: estado explícito y policy de gating por onboarding.
- Riesgo: fricción inicial.
  - Mitigación: mensaje corto y valor claro del registro.

## Roadmap de extensión (v2)
- `contact_window` (horario preferido).
- `language`.
- `country`.
- Ajuste dinámico de tono y cadencia según perfil.

## Siguiente incremento
Implementar migración de esquema + wiring del trigger de onboarding en el orquestador de ingreso.

## Artefactos WhatsApp Flow (Meta UI)
- Plan operativo: `docs/whatsapp-signup-flow-plan.md`
- JSON recomendado (data exchange endpoint): `docs/whatsapp-flows/user_signup_flow.endpoint.v1.json`
- JSON fallback (estático): `docs/whatsapp-flows/user_signup_flow.static.v1.json`
