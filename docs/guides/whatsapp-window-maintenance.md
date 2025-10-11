# WhatsApp Messaging Window Maintenance System

**Sistema inteligente de mantenimiento de ventanas de mensajería gratuita de WhatsApp**

## Visión General

WhatsApp Business API ofrece una ventana de 24 horas gratuita cuando el usuario envía un mensaje. Dentro de esta ventana, el negocio puede enviar mensajes ilimitados sin costo. Fuera de la ventana, solo se pueden enviar template messages (pagados).

Este sistema mantiene las ventanas activas de forma inteligente, respetando horarios laborales y preferencias del usuario, para maximizar las conversaciones gratuitas y reducir costos en un 90%.

## Reglas de WhatsApp Business API

### Ventana de 24 Horas

- **Se abre cuando**: Usuario envía mensaje o hace llamada
- **Duración**: 24 horas desde el último mensaje del usuario
- **Dentro de ventana**: Todos los mensajes son GRATIS (ilimitados)
- **Fuera de ventana**: Solo template messages (pagados $0.0667 c/u en LATAM)

### Free Entry Point (72h)

- **Duración**: 72 horas desde primer contacto
- **Beneficio**: Mensajes gratis incluso fuera de ventana de 24h
- **Solo nuevos usuarios**: Se activa en la primera interacción

### Template Messages

- **Categorías**: UTILITY (recordatorios), MARKETING (promociones), AUTHENTICATION (OTP)
- **Requieren**: Aprobación previa en Meta Business Manager
- **Costo**: $0.0667 por template en LATAM (vs $0 dentro de ventana)
- **Limitaciones**: No pueden ser personalizados como mensajes libres

**Referencia**: [WhatsApp Business API - Send Messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│ webhook/route.ts                                            │
│ Recibe mensaje → updateMessagingWindow()                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ messaging_windows (tabla BD)                                │
│ - user_id, phone_number                                     │
│ - window_opened_at, window_expires_at                       │
│ - proactive_messages_sent_today                             │
│ - free_entry_point_expires_at                               │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Cron Job: maintain-windows                                  │
│ Ejecuta: 7am, 10am, 1pm, 4pm Bogotá (UTC 12pm,15pm,18pm,21pm)│
│ 1. Busca ventanas < 4h de expirar                           │
│ 2. Valida horario laboral (7am-8pm)                         │
│ 3. Verifica límites (4 msg/día, 4h entre msgs)              │
│ 4. Genera mensaje personalizado (ProactiveAgent)            │
│ 5. Envía y actualiza contador                               │
└─────────────────────────────────────────────────────────────┘
```

### Archivos del Sistema

| Archivo | Propósito |
|---------|-----------|
| `lib/messaging-windows.ts` | Lógica core de gestión de ventanas |
| `app/api/cron/maintain-windows/route.ts` | Cron job de mantenimiento automático |
| `lib/template-messages.ts` | Fallback con templates cuando ventana cerrada |
| `lib/metrics.ts` | Monitoreo, métricas y cálculo de ahorro |
| `lib/followups.ts` | Programación inteligente respetando horarios |
| `supabase/migrations/003_messaging_windows.sql` | Tablas, índices y funciones SQL |

## Reglas de Negocio

### Horario Laboral

```typescript
const BUSINESS_HOURS = {
  start: 7,  // 7am Bogotá
  end: 20,   // 8pm Bogotá
};
const COLOMBIA_TZ = 'America/Bogota'; // UTC-5
```

**NO SE ENVÍAN** mensajes proactivos:
- Antes de 7am Bogotá
- Después de 8pm Bogotá
- Fuera de días laborales (opcional - actualmente 7 días)

### Límites Diarios

- **Máximo 4 mensajes proactivos** por usuario por día
- **Mínimo 4 horas** entre mensajes proactivos
- **NO interrumpir** usuarios activos (< 30 min desde última respuesta)

### Priorización

1. **Ventana abierta** (< 24h desde mensaje usuario)
2. **Free entry point activo** (< 72h desde primer contacto)
3. **Horario laboral** (7am-8pm Bogotá)
4. **Límite diario** (< 4 mensajes enviados hoy)
5. **Rate limiting** (> 4h desde último mensaje proactivo)
6. **Usuario inactivo** (> 30 min desde última respuesta)

## Flujo de Uso

### 1. Usuario Envía Mensaje

```typescript
// app/api/whatsapp/webhook/route.ts
waitUntil(
  updateMessagingWindow(
    message.from,
    message.id,
    true // isUserMessage = true
  )
);
```

**Acción**:
- Crea o actualiza registro en `messaging_windows`
- `window_opened_at` = ahora
- `window_expires_at` = ahora + 24h
- `free_entry_point_expires_at` = ahora + 72h (solo primera vez)

### 2. Cron Job Detecta Ventana Próxima a Expirar

```typescript
// app/api/cron/maintain-windows/route.ts
const windows = await findWindowsNearExpiration(4); // < 4h
```

**Criterio SQL**:
```sql
SELECT * FROM messaging_windows
WHERE window_expires_at > NOW()
  AND window_expires_at <= NOW() + INTERVAL '4 hours'
ORDER BY window_expires_at ASC;
```

### 3. Validación de Condiciones

```typescript
const decision = await shouldSendProactiveMessage(
  userId,
  phoneNumber,
  conversationId
);

if (!decision.allowed) {
  // Skipped: decision.reason
  // Next available: decision.nextAvailableTime
}
```

**Validaciones**:
- ✅ Horario laboral (7am-8pm Bogotá)
- ✅ Ventana abierta o free entry activo
- ✅ Límite diario no excedido (< 4 mensajes)
- ✅ Rate limiting respetado (> 4h desde último)
- ✅ Usuario no activo recientemente (> 30 min)

### 4. Generación de Mensaje Personalizado

```typescript
const agent = createProactiveAgent();
const history = await getConversationHistory(conversationId, 5);

const message = await agent.respond(
  `Genera mensaje breve para mantener conversación activa...
  Contexto: ${history.slice(-3).map(...)}`,
  userId,
  claudeHistory
);
```

**Ejemplos generados**:
- "¿Cómo va todo con tu cita de mañana? Estoy aquí si necesitas cambiar algo 😊"
- "¿Te sirvió la información sobre el documento? Cualquier duda, escríbeme"
- "Hola! ¿Alguna novedad con tu recordatorio? Cuéntame si puedo ayudarte"

### 5. Envío y Registro

```typescript
await sendWhatsAppText(phoneNumber, message);
await incrementProactiveCounter(phoneNumber);
```

**Acción**:
- Envía mensaje por WhatsApp API
- Incrementa `proactive_messages_sent_today`
- Actualiza `last_proactive_sent_at`
- Log del evento para métricas

### 6. Usuario Responde → Ventana Reseteada

El ciclo se reinicia desde el paso 1.

## Integración en Código

### Verificar Estado de Ventana

```typescript
import { getMessagingWindow } from '@/lib/messaging-windows';

const window = await getMessagingWindow('+5215512345678');

console.log({
  isOpen: window.isOpen,                    // true si < 24h
  isFreeEntry: window.isFreeEntry,          // true si < 72h
  expiresAt: window.expiresAt,              // Date object
  hoursRemaining: window.hoursRemaining,     // número decimal
  canSendProactive: window.canSendProactive, // bool
  messagesRemainingToday: window.messagesRemainingToday // 0-4
});
```

### Decidir Envío Proactivo

```typescript
import { shouldSendProactiveMessage } from '@/lib/messaging-windows';

const decision = await shouldSendProactiveMessage(
  userId,
  phoneNumber,
  conversationId // optional
);

if (decision.allowed) {
  // Safe to send proactive message
  await sendWhatsAppText(phoneNumber, message);
  await incrementProactiveCounter(phoneNumber);
} else {
  console.log(`Cannot send: ${decision.reason}`);
  if (decision.nextAvailableTime) {
    console.log(`Try again at: ${decision.nextAvailableTime}`);
  }
}
```

### Enviar Template Fallback

```typescript
import { shouldUseTemplate, sendWindowMaintenanceTemplate } from '@/lib/template-messages';

if (await shouldUseTemplate(phoneNumber)) {
  // Ventana cerrada y free entry expirado → usar template
  await sendWindowMaintenanceTemplate(phoneNumber, userName);
} else {
  // Ventana abierta → mensaje libre
  await sendWhatsAppText(phoneNumber, message);
}
```

## Configuración

### Variables de Entorno

No requiere variables adicionales. Usa las mismas de WhatsApp Business API:
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_ID`

### Cron Schedules (vercel.json)

```json
{
  "crons": [
    {
      "path": "/api/cron/maintain-windows",
      "schedule": "0 12,15,18,21 * * *",
      "comment": "7am, 10am, 1pm, 4pm Bogotá (UTC-5)"
    }
  ]
}
```

**Importante**: Vercel cron jobs siempre usan UTC, ajusta horarios manualmente.

### Templates en Meta Business Manager

Para fallback cuando ventana cerrada, crear templates:

1. Ir a https://business.facebook.com/
2. Seleccionar WhatsApp Business Account
3. Click "Message Templates" → "Create Template"
4. Configurar:

**Template: window_maintenance_reminder**
- Category: UTILITY
- Language: Spanish (es)
- Content: `Hola {{1}}, ¿cómo va todo? Estoy aquí si necesitas ayuda 😊`
- Parameter 1: userName (ejemplo: "María")

**Template: appointment_reminder**
- Category: UTILITY
- Language: Spanish (es)
- Content: `Hola {{1}}, te recuerdo tu cita: {{2}} para el {{3}} a las {{4}}`
- Parameters: userName, appointmentTitle, date, time

5. Submit para aprobación (usualmente aprobado en minutos)

## Monitoreo y Métricas

### Dashboard de Métricas

```typescript
import { trackWindowMetrics, calculateCostSavings } from '@/lib/metrics';

const metrics = await trackWindowMetrics();
// {
//   totalActiveWindows: 45,
//   windowsNearExpiration: 8,
//   freeEntryPointActive: 12,
//   proactiveMessagesSentToday: 67,
//   avgProactivePerActiveUser: 2.3,
//   estimatedCostSavings: 4.47, // USD hoy
//   totalUsers: 50,
//   activeConversations: 48
// }

const savings = await calculateCostSavings(30);
// {
//   conversationsWithinWindow: 234,
//   estimatedTemplatesSaved: 117,
//   monthlySavings: 7.80, // USD
//   dailySavings: 0.26    // USD
// }
```

### Health Checks

```typescript
import { validateMetricsHealth } from '@/lib/metrics';

const health = await validateMetricsHealth();
// {
//   healthy: true/false,
//   issues: [
//     "Low window utilization: 35% (target: >50%)",
//     "High proactive message rate: 5.2 per user (max: 4)"
//   ]
// }
```

### Logs Importantes

```bash
# Éxito en mantenimiento
[maintain-windows] Maintenance message sent
  userId: abc-123
  phoneNumber: +521551***
  hoursRemaining: 3.5
  messagesRemaining: 3

# Mensaje omitido
[maintain-windows] Skipped proactive message
  reason: "User is currently active (< 30 min since last message)"

# Error
[maintain-windows] Error processing window
  userId: abc-123
  error: "No active conversation"
```

## Cálculo de Costos

### Sin Sistema de Ventanas

```
100 usuarios × 3 mensajes proactivos/día × $0.0667/template = $20.01/día
$20.01 × 30 días = $600.30/mes
```

### Con Sistema de Ventanas

```
100 usuarios × 3 mensajes/día × 90% dentro ventana (gratis) = $0/día (gratis)
100 usuarios × 3 mensajes/día × 10% templates necesarios = $2.00/día
$2.00 × 30 días = $60/mes

AHORRO: $540/mes (90% reducción)
```

### ROI

- **Costo implementación**: ~8 horas desarrollo
- **Ahorro mensual**: $540
- **Break-even**: < 1 mes
- **Ahorro anual**: $6,480

## Solución de Problemas

### Ventanas No Se Crean

**Síntoma**: `getMessagingWindow()` retorna `isOpen: false` para usuarios activos

**Causa**: Webhook no llama `updateMessagingWindow()`

**Solución**:
```typescript
// Verificar en webhook/route.ts después de persistir mensaje
waitUntil(
  updateMessagingWindow(normalized.from, normalized.waMessageId, true)
);
```

### Mensajes Proactivos No Se Envían

**Síntoma**: Cron ejecuta pero `sent: 0`

**Diagnóstico**:
```typescript
// Verificar decisión
const decision = await shouldSendProactiveMessage(userId, phone);
console.log(decision); // → { allowed: false, reason: "..." }
```

**Causas comunes**:
- Fuera de horario laboral (< 7am o > 8pm Bogotá)
- Límite diario alcanzado (4 mensajes)
- Usuario activo recientemente (< 30 min)
- Ventana cerrada y free entry expirado

### Cron No Ejecuta

**Síntoma**: No logs de `[maintain-windows]` en Vercel

**Verificar**:
1. `vercel.json` tiene configuración correcta
2. Ruta existe: `app/api/cron/maintain-windows/route.ts`
3. Exporta `export const runtime = 'edge'` y `export async function GET()`
4. Deploy exitoso en Vercel

**Testing local**:
```bash
curl http://localhost:3000/api/cron/maintain-windows \
  -H "User-Agent: vercel-cron/1.0"
```

### Templates Fallback Fallan

**Síntoma**: Error 400 al enviar template

**Causas**:
- Template no creado en Meta Business Manager
- Template no aprobado (status: pending/rejected)
- Nombre de template incorrecto
- Parámetros incorrectos (cantidad o tipo)

**Verificar**:
1. Ir a https://business.facebook.com/ → Message Templates
2. Confirmar template aprobado (status: APPROVED)
3. Verificar nombre exacto: `window_maintenance_reminder`
4. Confirmar parámetros: 1 parámetro tipo text

## Mejores Prácticas

### 1. Personalización de Mensajes

✅ **Bueno**: "¿Cómo va todo con tu cita de mañana?"
❌ **Malo**: "¿Sigues ahí?" (genérico, sin contexto)

**Usar ProactiveAgent con historial para mensajes naturales**

### 2. Respeto al Usuario

✅ **Bueno**: Máx 4 mensajes/día, espaciados 4h
❌ **Malo**: Bombardear con mensajes cada hora

**El sistema ya implementa límites, respetarlos**

### 3. Timing Óptimo

✅ **Bueno**: 7am (inicio día), 1pm (post-almuerzo), 4pm (tarde)
❌ **Malo**: 6am (muy temprano), 10pm (muy tarde)

**Cron actual**: 7am, 10am, 1pm, 4pm Bogotá (óptimo)

### 4. Monitoreo Proactivo

✅ **Bueno**: Revisar métricas semanalmente
❌ **Malo**: Solo reaccionar cuando usuarios se quejan

**Implementar**:
```typescript
// Endpoint de métricas
GET /api/metrics/windows → getMetricsSummary()
```

### 5. Template Fallback

✅ **Bueno**: Template genérico simple, usar solo cuando necesario
❌ **Malo**: Depender de templates como estrategia principal

**Objetivo**: > 90% mensajes dentro de ventana (gratis)

## Próximas Mejoras

### Corto Plazo (1-2 semanas)

- [ ] Dashboard visual de métricas (Next.js page)
- [ ] Alertas automáticas si < 70% ventanas activas
- [ ] Preferencias de usuario (horarios personalizados)
- [ ] A/B testing de mensajes proactivos

### Mediano Plazo (1 mes)

- [ ] Machine learning para timing óptimo por usuario
- [ ] Integración con calendario para evitar interrupciones
- [ ] Sistema de priorización de mensajes proactivos
- [ ] API endpoint para programar mantenimiento manual

### Largo Plazo (3 meses)

- [ ] Multi-tenant support (múltiples negocios)
- [ ] Analytics avanzados con Segment/Mixpanel
- [ ] Predicción de churn basado en ventanas cerradas
- [ ] Integración con CRM externo

---

**Última actualización**: 2025-10-07
**Autor**: claude-master
**Versión**: 1.0.0
