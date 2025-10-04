# WhatsApp Typing Indicator

## Cuándo usarlo
- Actívalo cuando la respuesta tomará más de ~1.5 segundos (transcripción, RAG, streaming largo).
- Evita enviarlo para respuestas inmediatas; múltiples indicadores sin mensaje final generan desconfianza.

## Cómo enviarlo
```json
POST /{phone-number-id}/messages
{
  "messaging_product": "whatsapp",
  "to": "+521234567890",
  "type": "typing",
  "typing": { "status": "typing" }
}
```
- Deténlo con `typing.status = "paused"` justo antes de mandar el mensaje final.
- El estado expira alrededor de 10 segundos; refresca solo si realmente sigues procesando (no más de cada 7 s).

## Implementación en el proyecto
- Helper: `api/whatsapp/send.ts` (`sendTypingIndicator`).
- Webhook: `processMessageWithAI` envía `typing` cuando inicia la orquestación y garantiza `paused` en `finally`.
- Cron de recordatorios reutiliza `sendWhatsAppText` sin typing (acciones casi instantáneas).

## Buenas prácticas
1. Usa `typing` solo durante la generación del mensaje; en errores, intenta pausar en bloque `finally`.
2. El helper interno refresca el indicador cada ~7 s; evita envíos manuales adicionales para no duplicar eventos.
3. Si planeas enviar mensajes parciales, pausa antes de cada envío para que el usuario no vea texto mientras el indicador sigue activo.
4. Loggea intentos y errores (`typing_request_id` / número) para auditoría.

## Próximos pasos
- Explorar si WhatsApp Business permite “presence” diferente a typing.
- Automatizar refresco cada ~7 s cuando el stream supere ese tiempo.
- Añadir cobertura para escenarios donde la función falle después de activar typing.
