# WhatsApp Business API Pricing Guide 2025

**Última actualización**: 2025-10-08
**API Version**: v23.0
**Fuente**: [Meta Developer Docs - Pricing Updates](https://developers.facebook.com/docs/whatsapp/pricing/)

---

## 📋 Tabla de Contenidos

- [Conceptos Fundamentales](#conceptos-fundamentales)
- [Ventana de Mensajería de 24 Horas](#ventana-de-mensajería-de-24-horas)
- [Categorías de Templates](#categorías-de-templates)
- [Pricing por Región](#pricing-por-región)
- [Estrategia de Optimización](#estrategia-de-optimización)
- [Implementación en migue.ai](#implementación-en-migueai)
- [Troubleshooting](#troubleshooting)

---

## Conceptos Fundamentales

### La Verdad Simple

WhatsApp tiene DOS tipos de mensajes:

1. **Mensajes Normales** (dentro de ventana 24h): **GRATIS** ✅
2. **Template Messages** (fuera de ventana 24h): **PAGADOS** 💰

### ⚠️ ACLARACIÓN CRÍTICA

**Dentro de la ventana de 24 horas (usuario escribió hace menos de 24h):**
- ✅ Envías mensajes NORMALES (no templates)
- ✅ TODOS los mensajes son GRATIS
- ✅ Puedes enviar: texto, imágenes, botones, listas, audio, etc.
- ✅ NO necesitas templates pre-aprobados
- ✅ Sin límites de cantidad

**Fuera de la ventana de 24 horas (usuario no ha escrito en más de 24h):**
- ❌ NO puedes enviar mensajes normales
- ⚠️ SOLO puedes enviar Template Messages (pre-aprobados en Meta Business Manager)
- 💰 Los templates tienen costo según su categoría
- 📝 Los templates deben estar pre-aprobados por Meta

---

## Ventana de Mensajería de 24 Horas

### ¿Qué es?

La **Customer Service Window** es una ventana de tiempo de 24 horas que se abre cuando un usuario envía un mensaje a tu negocio.

### Cómo Funciona

```
Usuario envía mensaje → Se abre ventana de 24h → Todos los mensajes GRATIS
```

**Timeline:**
```
T=0h   → Usuario: "Hola, necesito ayuda"
         Ventana se ABRE por 24h

T=1h   → Bot: "Claro, ¿en qué te ayudo?" [GRATIS - mensaje normal]
T=5h   → Bot: "¿Ya encontraste lo que buscabas?" [GRATIS - mensaje normal]
T=12h  → Bot: "Tengo recordatorio de tu cita" [GRATIS - mensaje normal]
T=23h  → Bot: "¿Todo bien?" [GRATIS - mensaje normal]

T=24h  → Ventana se CIERRA

T=25h  → Bot NO puede enviar mensajes normales
         Solo puede enviar Template Messages (PAGADOS)
```

### Estrategia: Mantener la Ventana Abierta

**Objetivo**: Mantener la ventana abierta el mayor tiempo posible para maximizar mensajes gratis.

**Táctica**:
1. Cada vez que usuario escribe → ventana se resetea a 24h nuevas
2. Enviar mensajes proactivos cada ~4 horas para incentivar respuesta
3. Si usuario responde → ventana se resetea
4. Resultado: Conversación perpetuamente gratis

**Implementación en migue.ai**:
```typescript
// lib/messaging-windows.ts
// Sistema automático que mantiene ventanas abiertas
// Envía mensajes cada 4 horas en horario laboral
// 90%+ de conversaciones nunca salen de ventana
```

### Free Entry Point (72 horas)

Desde Noviembre 2024, Meta introdujo **Free Entry Points**:

**¿Qué es?**
- Cuando usuario hace click en anuncio de Meta (Facebook/Instagram)
- Se abre ventana especial de **72 horas**
- TODOS los mensajes gratis (incluso templates)

**Uso**:
```
Usuario click en anuncio → Free Entry Point de 72h →
Puedes enviar templates Marketing/Utility/Authentication GRATIS
```

**Beneficio para migue.ai**: Si usuario viene desde anuncio, primera interacción es gratis por 72h.

---

## Categorías de Templates

Los templates solo se usan cuando la **ventana de 24h está CERRADA**.

### 1. SERVICE - GRATIS ILIMITADAS ⭐ (Nueva - Nov 2024)

**Descripción**: Conversaciones de servicio al cliente y soporte.

**Costo**: **$0.00** - SIEMPRE GRATIS

**Características**:
- Introducida en Noviembre 2024
- Sin límite de 1000 conversaciones/mes (ilimitadas)
- Para soporte, atención al cliente, preguntas
- La MÁS VALIOSA para migue.ai

**Cuándo usar**:
- Seguimiento de consultas previas
- Soporte técnico
- Resolución de problemas
- Asistencia general

**Ejemplo de template SERVICE**:
```
Seguimiento de tu consulta #{{ticket_id}}

Estado: {{status}}
Última actualización: {{timestamp}}

Responde si necesitas más ayuda con este caso.
```

**⚠️ OPORTUNIDAD**: Migrar mayoría de templates a esta categoría = $0 costo.

### 2. UTILITY - Transaccional ($0.0125 Colombia)

**Descripción**: Mensajes transaccionales relacionados con acciones del usuario.

**Costo Colombia**:
- Dentro de 24h: **$0.00** (pero no necesitas template, usa mensaje normal)
- Fuera de 24h: **$0.0125**

**Características**:
- DEBE ser específico a una acción del usuario
- NO puede ser genérico
- NO puede ser promocional
- DEBE tener contexto transaccional claro

**Cuándo usar**:
- Confirmaciones de citas
- Recordatorios de eventos agendados
- Notificaciones de estado de pedidos
- Alertas de cuenta

**Ejemplos APROBADOS**:
```
✅ Confirmación cita #{{appointment_id}}
   Fecha: {{date}} a las {{time}}
   Ubicación: {{location}}

   Responde:
   1 - Confirmar
   2 - Reagendar
```

```
✅ Tu pedido #{{order_id}} está en camino
   Llegada estimada: {{eta}}
   Rastrear: {{tracking_url}}
```

**Ejemplos RECHAZADOS** (Meta los marca como Marketing):
```
❌ "Hola {{name}}, ¿cómo va todo?"
   → Muy genérico, no transaccional

❌ "Estoy aquí si necesitas ayuda 😊"
   → Parece engagement, no acción específica

❌ "¿Cómo estás? Te extraño"
   → Relacional, no transaccional
```

**⚠️ PROBLEMA COMÚN**: Meta marca templates UTILITY como MARKETING si son muy genéricos. Ver [Template Troubleshooting](./template-troubleshooting.md).

### 3. MARKETING - Promocional ($0.0667 Colombia)

**Descripción**: Mensajes promocionales y de marketing.

**Costo Colombia**: **$0.0667** - SIEMPRE pagado (incluso dentro de 24h si usas template)

**Características**:
- Para promociones, ofertas, descuentos
- Para generación de marca
- Para retargeting
- SIEMPRE es pagado

**Cuándo usar**:
- Anuncios de nuevos productos
- Ofertas especiales
- Descuentos y promociones
- Campañas de marketing

**Ejemplos**:
```
🎉 ¡Oferta especial solo para ti!

20% de descuento en todos nuestros servicios
Válido hasta: {{expiry_date}}

Usa código: {{promo_code}}
```

**⚠️ EVITAR**: No uses templates Marketing si puedes evitarlo. Son 5x más caros que Utility.

### 4. AUTHENTICATION - Códigos OTP ($0.0100 Colombia)

**Descripción**: Exclusivamente para verificación de identidad.

**Costo Colombia**: **$0.0100**

**Restricciones**:
- SOLO para códigos de verificación
- NO puede tener URLs
- NO puede tener emojis
- NO puede tener contenido adicional

**Cuándo usar**:
- Códigos OTP (One-Time Password)
- Verificación de identidad
- Autenticación de dos factores

**Ejemplo**:
```
Tu código de verificación es: {{code}}

Válido por {{minutes}} minutos.
No compartas este código.
```

**Uso en migue.ai**: Baja prioridad, no requerimos OTP actualmente.

---

## Pricing por Región

### Cambio de Modelo (Julio 1, 2025)

**ANTES (hasta Jun 30, 2025)**:
- Pricing por conversación (24h = 1 conversación)
- Costo por conversación según categoría

**DESPUÉS (desde Jul 1, 2025)**:
- Pricing por mensaje template entregado
- Costo por cada template enviado (no por conversación)

### Tabla de Precios Colombia (2025)

| Categoría | Dentro 24h Window | Fuera 24h Window | Volume Tier 1 | Volume Tier 2 |
|-----------|-------------------|------------------|---------------|---------------|
| **Mensajes Normales** | **$0.00** ✅ | ❌ No permitido | - | - |
| **SERVICE** | $0.00 | **$0.00** ⭐ | $0.00 | $0.00 |
| **UTILITY** | $0.00* | $0.0125 | $0.0100 | $0.0075 |
| **MARKETING** | $0.0667 | $0.0667 | $0.0534 | $0.0400 |
| **AUTHENTICATION** | $0.0100 | $0.0100 | $0.0080 | $0.0060 |

\* Dentro de 24h no necesitas template, usas mensaje normal gratis.

### Comparación LATAM (2025)

| País | Marketing | Utility | Authentication | Service |
|------|-----------|---------|----------------|---------|
| **Colombia** | $0.0667 | $0.0125 | $0.0100 | $0.00 |
| Brasil | $0.0625 | $0.0120 | $0.0095 | $0.00 |
| México | $0.0320 | $0.0064 | $0.0050 | $0.00 |
| Argentina | $0.0450 | $0.0090 | $0.0070 | $0.00 |
| Chile | $0.0550 | $0.0110 | $0.0085 | $0.00 |

### Volume Tiers (Descuentos por Volumen)

**Desde Julio 1, 2025**, Meta introdujo volume tiers para Utility y Authentication:

**Cómo funciona**:
- Tier 0 (0-1K mensajes/mes): Precio normal
- Tier 1 (1K-10K mensajes/mes): 20% descuento
- Tier 2 (10K-100K mensajes/mes): 40% descuento
- Tier 3 (100K+ mensajes/mes): Negociación directa

**Acumulación**:
- Se acumula por business portfolio completo
- Se resetea mensualmente
- Aplica retroactivamente al alcanzar tier

**Ejemplo**:
```
Mes 1: 500 mensajes Utility × $0.0125 = $6.25
Mes 2: 2,000 mensajes Utility × $0.0100 (Tier 1) = $20.00
Mes 3: 15,000 mensajes Utility × $0.0075 (Tier 2) = $112.50
```

---

## Estrategia de Optimización

### Objetivo: Maximizar Mensajes Gratis

**Regla de oro**: **90%+ de mensajes deben ser dentro de ventana de 24h = GRATIS**

### Táctica 1: Mantener Ventanas Abiertas (Implementado ✅)

**Sistema actual** (`lib/messaging-windows.ts`):
1. Usuario escribe → Ventana 24h se abre
2. Bot envía mensajes proactivos cada 4 horas
3. Usuario responde → Ventana se resetea a 24h nuevas
4. Loop continúa → Conversación perpetuamente gratis

**Horario**:
- 7am-8pm Bogotá (horario laboral)
- 4 mensajes proactivos/día máximo
- Mínimo 4h entre mensajes

**Rate limits**:
- Máx 4 mensajes proactivos/usuario/día
- Solo si ventana está abierta
- Solo si usuario no está activo (< 30 min)

**Resultado**:
- 90%+ conversaciones nunca salen de ventana
- Costo actual: ~$0/mes en templates

### Táctica 2: Migrar a SERVICE Templates (Propuesta 🔄)

**Para el 10% que sale de ventana:**

Actualmente:
- Templates UTILITY: $0.0125/mensaje
- Si mal categorizados como Marketing: $0.0667/mensaje

Propuesta:
- Migrar a SERVICE: **$0.00/mensaje** ⭐
- 100% ahorro en ese 10%

**Implementación**:
```typescript
// lib/service-conversations.ts (NUEVO)
export async function sendServiceMessage(
  phoneNumber: string,
  message: string
) {
  // Usar template SERVICE (gratis)
  return sendTemplate(phoneNumber, {
    name: 'service_followup',
    category: 'SERVICE',
    // ...
  });
}
```

### Táctica 3: Free Entry Points desde Ads (Futuro 🔮)

**Oportunidad**:
- Ads en Facebook/Instagram con botón WhatsApp
- Usuario click → Free Entry Point 72h
- Todos los templates gratis por 72h

**ROI**:
```
Costo ad: $10
Conversión: 50 usuarios click
72h gratis por usuario
Ahorro: 50 × 10 mensajes × $0.0667 = $33.35
Beneficio neto: $23.35 por ad
```

### Táctica 4: Optimizar Categorización de Templates

**Problema**: Meta marca templates Utility como Marketing = 5x más caro

**Solución**: Ver [Template Troubleshooting Guide](./template-troubleshooting.md)

**Resumen**:
- Usar lenguaje transaccional específico
- Evitar palabras genéricas/promocionales
- Incluir IDs, números, referencias específicas
- Testing antes de aprobar

---

## Implementación en migue.ai

### Arquitectura Actual

```
┌─────────────────────────────────────────┐
│ Usuario envía mensaje                    │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ updateMessagingWindow()                  │
│ - Guarda timestamp                       │
│ - Marca ventana como abierta             │
│ - window_expires_at = now + 24h          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ Bot procesa y responde                   │
│ Mensaje NORMAL (no template)             │
│ Costo: $0.00 ✅                          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ Cron Job (cada 4h en horario laboral)   │
│ /api/cron/maintain-windows               │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ shouldSendProactiveMessage()             │
│ - Ventana abierta? ✅                    │
│ - Usuario activo reciente? ❌            │
│ - Horario laboral? ✅                    │
│ - Rate limit OK? ✅                      │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ ProactiveAgent genera mensaje            │
│ Con contexto de conversación             │
│ Mensaje NORMAL (no template)             │
│ Costo: $0.00 ✅                          │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│ Usuario responde?                        │
│ SÍ → Ventana resetea 24h nuevas          │
│ NO → Ventana expira después de 24h       │
└─────────────────────────────────────────┘
```

### Código Actual

**lib/messaging-windows.ts** (Sistema que mantiene ventanas abiertas):
```typescript
/**
 * Check if we should send proactive message to maintain window
 */
export async function shouldSendProactiveMessage(
  userId: string,
  phoneNumber: string
): Promise<ProactiveDecision> {
  // 1. Check if window is open
  const window = await getMessagingWindow(phoneNumber);
  if (!window.isOpen) {
    return {
      allowed: false,
      reason: 'window_closed', // Necesitaría template
    };
  }

  // 2. Check business hours (7am-8pm Bogotá)
  const currentHour = getCurrentHour(COLOMBIA_TZ);
  if (currentHour < 7 || currentHour >= 20) {
    return {
      allowed: false,
      reason: 'outside_business_hours',
    };
  }

  // 3. Check daily limit (max 4 proactive/day)
  if (window.proactiveMessagesSentToday >= 4) {
    return {
      allowed: false,
      reason: 'daily_limit_reached',
    };
  }

  // 4. Check rate limit (min 4h between messages)
  const hoursSinceLastProactive = calculateHoursSince(
    window.lastProactiveSentAt
  );
  if (hoursSinceLastProactive < 4) {
    return {
      allowed: false,
      reason: 'rate_limit',
    };
  }

  // 5. Check if user is active (< 30 min) - don't interrupt
  const lastInteraction = await getLastUserInteraction(userId);
  const minutesSinceActive = calculateMinutesSince(lastInteraction);
  if (minutesSinceActive < 30) {
    return {
      allowed: false,
      reason: 'user_active',
    };
  }

  // ✅ All checks passed - safe to send proactive message
  return {
    allowed: true,
    reason: 'approved',
  };
}
```

**app/api/cron/maintain-windows/route.ts** (Cron job):
```typescript
/**
 * Cron job para mantener ventanas de mensajería abiertas
 * Runs: 7am, 10am, 1pm, 4pm Bogotá (12pm, 3pm, 6pm, 9pm UTC)
 */
export async function GET(req: Request): Promise<Response> {
  // Find windows expiring in next 4 hours
  const windows = await findWindowsNearExpiration(4);

  for (const window of windows) {
    // Check if we should send proactive message
    const decision = await shouldSendProactiveMessage(
      window.user_id,
      window.phone_number
    );

    if (!decision.allowed) continue;

    // Generate personalized message with AI
    const message = await ProactiveAgent.generateFollowUp(
      window.user_id,
      window.phone_number
    );

    // Send NORMAL message (not template) - FREE
    await sendWhatsAppText(window.phone_number, message);

    // Increment counter
    await incrementProactiveCounter(window.phone_number);
  }

  return new Response('OK', { status: 200 });
}
```

### Para Templates (cuando ventana está CERRADA)

**lib/template-messages.ts** (Solo para ventana cerrada):
```typescript
/**
 * Send template message (only when 24h window is CLOSED)
 */
export async function sendTemplate(
  to: string,
  template: TemplateMessage
): Promise<string> {
  // Check if window is open first
  const shouldUse = await shouldUseTemplate(to);

  if (!shouldUse) {
    // Window is open - DON'T use template, use normal message
    logger.warn('[template] Window is open, use normal message instead');
    throw new Error('Window is open - use sendWhatsAppText() instead');
  }

  // Window is closed - template is required
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language },
      components: template.components,
    },
  };

  return sendWhatsAppRequest(payload);
}

/**
 * Check if we should use template (window closed?)
 */
export async function shouldUseTemplate(phoneNumber: string): Promise<boolean> {
  const window = await getMessagingWindow(phoneNumber);

  // Use template if both window and free entry point are closed
  return !window.isOpen && !window.isFreeEntry;
}
```

### Métricas Actuales

**Tracking de ventanas** (`lib/metrics.ts`):
```typescript
export async function trackWindowMetrics(): Promise<WindowMetrics> {
  const stats = await supabase
    .from('messaging_windows_stats')
    .select('*')
    .single();

  return {
    totalActiveWindows: stats.active_windows,
    windowsNearExpiration: stats.windows_near_expiration,
    freeEntryPointActive: stats.free_entry_active,
    proactiveMessagesSentToday: stats.total_proactive_today,
    avgProactivePerActiveUser: stats.avg_proactive_per_active_user,
    estimatedCostSavings: stats.total_proactive_today * 0.0667, // vs Marketing
    totalUsers: totalUsers,
    activeConversations: activeConversations,
  };
}
```

**Métricas en producción**:
- Active windows: ~38-42 (90%+ de usuarios activos)
- Proactive messages/day: ~150-180
- Cost savings: ~$10-12/day vs templates
- Monthly savings: ~$300-360

---

## Troubleshooting

### Problema 1: Template Marcado como Marketing

**Síntoma**: Template que creaste como UTILITY es marcado como MARKETING por Meta.

**Causa**: Contenido muy genérico, parece engagement/promocional.

**Solución**: Ver [Template Troubleshooting Guide](./template-troubleshooting.md)

**Quick fix**:
1. Hacer contenido más específico/transaccional
2. Agregar IDs, números, referencias
3. Quitar emojis y preguntas genéricas
4. Usar lenguaje de "sistema" o "notificación"

### Problema 2: Mensaje Rechazado (Ventana Cerrada)

**Síntoma**: Error "Message failed to send" cuando envías mensaje normal.

**Causa**: Ventana de 24h está cerrada, solo se permiten templates.

**Solución**:
```typescript
// Verificar antes de enviar
const window = await getMessagingWindow(phoneNumber);

if (window.isOpen) {
  // Ventana abierta - usar mensaje normal
  await sendWhatsAppText(phoneNumber, message);
} else {
  // Ventana cerrada - usar template
  await sendTemplate(phoneNumber, templateConfig);
}
```

### Problema 3: Templates No Aprobados

**Síntoma**: Template en estado "Pending" por más de 24 horas.

**Causa**:
- Contenido viola políticas de WhatsApp
- Información sensible o privada
- Contenido no claro

**Solución**:
1. Revisar [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)
2. Quitar información sensible
3. Hacer contenido más claro y específico
4. Si rechazado: 60 días para apelar

### Problema 4: Costos Altos

**Síntoma**: Costos de WhatsApp más altos de lo esperado.

**Diagnóstico**:
```typescript
// Revisar métricas
const metrics = await trackWindowMetrics();
console.log({
  activeWindows: metrics.totalActiveWindows,
  templatesUsed: metrics.templatesSentToday, // Si esto es alto = problema
  costSavings: metrics.estimatedCostSavings,
});
```

**Causas comunes**:
1. Sistema de mantenimiento de ventanas desactivado
2. Templates categorizados como Marketing en vez de Utility/Service
3. Mensajes fuera de horario laboral
4. Rate limits muy agresivos

**Solución**:
1. Verificar cron jobs activos: `/api/cron/maintain-windows`
2. Recategorizar templates a SERVICE
3. Ajustar horarios en `BUSINESS_HOURS`
4. Optimizar frecuencia de mensajes proactivos

---

## Referencias

### Documentación Meta
- [Pricing Updates](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/)
- [Template Guidelines](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)
- [Conversation Types](https://developers.facebook.com/docs/whatsapp/pricing/conversation-based-pricing)
- [Business Policy](https://www.whatsapp.com/legal/business-policy)

### Documentación migue.ai
- [Template Troubleshooting](./template-troubleshooting.md) - Solucionar categorización incorrecta
- [Service Conversations](./service-conversations.md) - Migrar a categoría SERVICE gratuita
- [WhatsApp Window Maintenance](../04-features/whatsapp-window-maintenance.md) - Sistema de mantenimiento

### Código Relacionado
- `lib/messaging-windows.ts` - Gestión de ventanas de 24h
- `lib/template-messages.ts` - Envío de templates
- `lib/metrics.ts` - Tracking de costos
- `app/api/cron/maintain-windows/route.ts` - Cron job mantenimiento

---

**Siguiente**: [Template Troubleshooting Guide →](./template-troubleshooting.md)
