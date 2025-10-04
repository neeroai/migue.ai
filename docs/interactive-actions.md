# Interactive Actions

## Overview
Interactive replies accelerate workflows by offering structured options directly in WhatsApp. migue.ai now supports:
- **Cita rápida**: botones “Confirmar / Reprogramar / Cancelar” después de agendar.
- **Recordatorios**: lista con acciones (“Ver / Editar / Cancelar”).
- **Registro**: cada selección se guarda en `conversation_actions` para analytics.

## Implementation
- Helpers en `api/whatsapp/send.ts` (`sendInteractiveButtons`, `sendInteractiveList`) envían payloads `interactive.button` y `interactive.list`.
- `lib/actions.ts` define IDs, copy y respuestas prediseñadas.
- El webhook registra acciones y, cuando aplica, responde sin pasar por GPT (p. ej. confirmación inmediata) o transforma la interacción en texto (“Necesito reprogramar la cita”) para que el pipeline existente la procese.
- Seguimiento mediante `conversation_actions` y follow-ups programados (`follow_up_jobs`).

## Preguntas Frecuentes
- **¿Clientes sin soporte interactivo?** Reciben primero el mensaje de texto estándar para que puedan responder manualmente.
- **¿Puedo añadir nuevas acciones?** Agrega una entrada en `lib/actions.ts`, actualiza las funciones de follow-up y, si es necesario, crea tareas específicas.
- **¿Cómo extiendo la lógica?** Usa `recordConversationAction` para disparar downstream jobs (workflow integrations, analytics).

## Próximos pasos
1. Vincular acciones con lógica real (p.ej., “Cancelar cita” → eliminar en Google Calendar).
2. Añadir analytics dashboards (tasa de clics por botón/lista).
3. Internacionalización: permitir labels/confirmaciones por idioma del usuario.
