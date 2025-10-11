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

## Type-Safe Message Builders (2025-10-06)

### Nuevas clases para construcción de mensajes interactivos

Para mejorar la seguridad de tipos y prevenir errores de formato, ahora usamos **message builders** que validan en tiempo de construcción:

#### ButtonMessage (≤3 opciones)
```typescript
import { ButtonMessage } from '@/lib/message-builders';

const message = new ButtonMessage(
  'Confirma tu cita para mañana a las 10:00 AM',
  [
    { id: 'confirmar', title: 'Confirmar ✅' },
    { id: 'reprogramar', title: 'Reprogramar 📅' },
    { id: 'cancelar', title: 'Cancelar ❌' }
  ],
  {
    header: 'Recordatorio de Cita',
    footer: 'Powered by migue.ai'
  }
);

await sendWhatsAppRequest(message.toPayload(phoneNumber));
```

**Validaciones automáticas:**
- ✅ Max 3 botones (throws error si > 3)
- ✅ Títulos ≤20 caracteres
- ✅ IDs ≤256 caracteres
- ✅ Body ≤1024 caracteres
- ✅ Header/footer ≤60 caracteres

#### ListMessage (4-10 opciones)
```typescript
import { ListMessage } from '@/lib/message-builders';

const message = new ListMessage(
  'Selecciona el servicio que necesitas',
  'Ver Servicios',
  [
    { id: 'corte', title: 'Corte de Cabello', description: '30 min - $150' },
    { id: 'tinte', title: 'Tinte Completo', description: '90 min - $450' },
    { id: 'manicure', title: 'Manicure', description: '45 min - $200' },
    { id: 'pedicure', title: 'Pedicure', description: '60 min - $250' }
  ],
  {
    sectionTitle: 'Servicios Disponibles',
    header: 'Agenda tu Cita',
    footer: 'Responde en menos de 2 minutos'
  }
);

await sendWhatsAppRequest(message.toPayload(phoneNumber));
```

**Validaciones automáticas:**
- ✅ Max 10 rows por sección (throws error si > 10)
- ✅ Button text ≤20 caracteres
- ✅ Row title ≤24 caracteres
- ✅ Row description ≤72 caracteres
- ✅ Section title ≤24 caracteres

### Beneficios

1. **Validación en tiempo de construcción:** Errores detectados antes de enviar a WhatsApp API
2. **Type safety:** TypeScript verifica tipos automáticamente
3. **Mantenibilidad:** Código más limpio y fácil de refactorizar
4. **Prevención de errores:** Imposible enviar payloads inválidos

### Migración desde funciones legacy

**Antes:**
```typescript
await sendInteractiveButtons(phone, 'Choose', [
  { id: '1', title: 'Option 1' },
  { id: '2', title: 'Option 2' }
]);
```

**Ahora (internamente usa ButtonMessage):**
```typescript
await sendInteractiveButtons(phone, 'Choose', [
  { id: '1', title: 'Option 1' },
  { id: '2', title: 'Option 2' }
], {
  header: 'Quick Selection',
  footer: 'Powered by migue.ai'
});
```

Las funciones `sendInteractiveButtons` y `sendInteractiveList` ahora usan los builders internamente, manteniendo compatibilidad con código existente.

---

## Próximos pasos
1. Vincular acciones con lógica real (p.ej., "Cancelar cita" → eliminar en Google Calendar).
2. Añadir analytics dashboards (tasa de clics por botón/lista).
3. Internacionalización: permitir labels/confirmaciones por idioma del usuario.
4. ✅ **COMPLETADO:** Implementar WhatsApp Flows v3 para formularios complejos (Fase 2 opcional).
