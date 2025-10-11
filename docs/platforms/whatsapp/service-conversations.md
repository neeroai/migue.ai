# WhatsApp Service Conversations Guide

**Última actualización**: 2025-10-08
**Disponible desde**: Noviembre 1, 2024

---

## 🆕 Categoría SERVICE: La Oportunidad Dorada

Desde Noviembre 2024, Meta introdujo la categoría **SERVICE** para conversaciones de soporte al cliente.

### ¿Qué la hace especial?

**SERVICE conversations son GRATIS ILIMITADAS** ⭐

- **Sin límite** de 1000 conversaciones/mes (antes el límite de "free tier")
- **$0.00** por cada conversación, siempre
- **No requiere templates** si estás dentro de ventana de 24h
- **Gratis incluso fuera de ventana** si usas templates SERVICE

---

## Comparación de Costos

### ANTES de Noviembre 2024

| Tipo | Dentro 24h | Fuera 24h | Límite Free Tier |
|------|-----------|-----------|------------------|
| User Support | Mensajes gratis | $0.0125 (Utility) | 1000/mes |

**Problema**: Después de 1000 conversaciones, había que pagar por soporte.

### DESPUÉS de Noviembre 2024

| Tipo | Dentro 24h | Fuera 24h | Límite Free Tier |
|------|-----------|-----------|------------------|
| **SERVICE** | **$0.00** | **$0.00** | **∞ ilimitado** |

**Beneficio**: Todo el soporte es gratis, sin límites.

---

## ¿Qué Califica como SERVICE?

### Conversaciones Válidas para SERVICE ✅

1. **Soporte técnico**:
   - "No puedo acceder a mi cuenta"
   - "Error al procesar pago"
   - "¿Cómo funciona X feature?"

2. **Atención al cliente**:
   - "Necesito cambiar mi cita"
   - "¿Cuál es el estado de mi pedido?"
   - "Quiero actualizar mi información"

3. **Resolución de problemas**:
   - "Mi servicio no está funcionando"
   - "No recibí mi confirmación"
   - "Hay un error en mi factura"

4. **Preguntas sobre servicio**:
   - "¿Cuáles son sus horarios?"
   - "¿Dónde está ubicado?"
   - "¿Aceptan X método de pago?"

5. **Seguimiento de casos**:
   - "¿Hay actualización en mi caso #123?"
   - "Quiero saber estado de mi consulta"
   - "¿Resolvieron mi problema?"

### NO Califica como SERVICE ❌

1. **Marketing/Promociones**:
   - "Oferta especial 20% descuento"
   - "Nuevos productos disponibles"
   - "No te pierdas esta oportunidad"

2. **Ventas proactivas**:
   - "¿Te interesa comprar X?"
   - "Tenemos nuevo inventario"
   - "Upgrade a plan premium"

3. **Engagement genérico**:
   - "¿Cómo estás?"
   - "¿Todo bien?"
   - Solo para mantener contacto sin propósito de soporte

### Zona Gris (Depende del Contexto) ⚠️

1. **"¿En qué te puedo ayudar?"**:
   - ✅ SERVICE: Si es respuesta a consulta del usuario
   - ❌ NO SERVICE: Si es outreach sin consulta previa

2. **Recordatorios de citas**:
   - ✅ SERVICE: Cita agendada por usuario
   - ❌ UTILITY: Si es sistema automatizado sin interacción

3. **Follow-ups**:
   - ✅ SERVICE: Seguimiento a problema reportado
   - ❌ MARKETING: Check-in sin problema específico

---

## Cómo Usar SERVICE en migue.ai

### Escenario 1: Dentro de Ventana 24h (Actual ✅)

**Situación actual**: Ya estás enviando mensajes gratis dentro de 24h window.

**¿Cambia algo?**: NO

**Por qué**: Dentro de 24h, todos los mensajes son gratis sin importar categoría. SERVICE no añade beneficio aquí.

**Código actual** (mantener):
```typescript
// lib/messaging-windows.ts
if (window.isOpen) {
  // Mensaje normal gratis
  await sendWhatsAppText(phoneNumber, message);
}
```

### Escenario 2: Fuera de Ventana 24h (OPORTUNIDAD 🔥)

**Situación actual**: Usas templates UTILITY ($0.0125) o MARKETING ($0.0667).

**Oportunidad**: Cambiar a templates SERVICE = $0.00 ⭐

**Beneficio**:
```
Antes: 100 templates UTILITY/mes × $0.0125 = $1.25/mes
Ahora: 100 templates SERVICE/mes × $0.00 = $0.00/mes
Ahorro: $1.25/mes (100% reducción)
```

### Implementación: Templates SERVICE

**Crear en Meta Business Manager**:

1. **Nombre**: `service_followup` (o similar)
2. **Categoría**: **SERVICE** (seleccionar en dropdown)
3. **Idioma**: Spanish (es)
4. **Contenido**:

```
Seguimiento de tu consulta #{{ticket_id}}

Estado: {{status}}
Última actualización: {{timestamp}}

¿Necesitas información adicional sobre este caso?
Responde y con gusto te ayudamos.
```

5. **Variables de ejemplo**:
   - {{ticket_id}}: "TKT-48291"
   - {{status}}: "En progreso"
   - {{timestamp}}: "8 de octubre 2025, 3:45 PM"

### Código: Enviar Templates SERVICE

**Actualizar** `lib/template-messages.ts`:

```typescript
/**
 * Send SERVICE template (FREE - even outside 24h window)
 *
 * SERVICE templates are for customer support conversations.
 * Introduced Nov 2024, they are FREE unlimited.
 */
export async function sendServiceTemplate(
  phoneNumber: string,
  ticketId: string,
  status: string,
  timestamp: string
): Promise<string> {
  return sendTemplate(phoneNumber, {
    name: 'service_followup',
    language: 'es',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: ticketId },
          { type: 'text', text: status },
          { type: 'text', text: timestamp },
        ],
      },
    ],
  });
}
```

**Uso en cron job** `app/api/cron/maintain-windows/route.ts`:

```typescript
// Cuando ventana está CERRADA
if (!window.isOpen) {
  // ANTES: Template UTILITY ($0.0125)
  // await sendWindowMaintenanceTemplate(phoneNumber, userName);

  // AHORA: Template SERVICE ($0.00) ⭐
  await sendServiceTemplate(
    phoneNumber,
    `SESS-${window.user_id}`,
    'Activa',
    new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })
  );
}
```

---

## Tracking de Ahorro

### Antes (Solo UTILITY)

```typescript
// Métricas mensuales
const metrics = {
  messagesInWindow: 900,      // $0 (gratis)
  templatesUtility: 100,      // $0.0125 c/u
  totalCost: 100 * 0.0125,   // $1.25/mes
};
```

### Después (Con SERVICE)

```typescript
// Métricas mensuales
const metrics = {
  messagesInWindow: 900,      // $0 (gratis)
  templatesService: 100,      // $0 c/u ⭐
  totalCost: 0,              // $0/mes
  savings: 1.25,             // 100% reducción
};
```

### Implementar Tracking

**Crear** `lib/service-conversations.ts`:

```typescript
import { getSupabaseServerClient } from './supabase';
import { logger } from './logger';

/**
 * Track SERVICE template usage and cost savings
 */
export async function trackServiceTemplate(
  phoneNumber: string,
  templateName: string,
  wasWithinWindow: boolean
): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Calculate savings vs alternative
  const alternativeCost = wasWithinWindow ? 0 : 0.0125; // UTILITY
  const actualCost = 0; // SERVICE always free
  const savings = alternativeCost - actualCost;

  // Log to database (future: create service_templates table)
  logger.info('[service] SERVICE template sent', {
    metadata: {
      phoneNumber: phoneNumber.slice(0, 8) + '***',
      templateName,
      wasWithinWindow,
      savings: `$${savings.toFixed(4)}`,
    },
  });

  // TODO: Guardar en tabla para análisis mensual
}

/**
 * Get monthly savings from SERVICE templates
 */
export async function getMonthlyServiceSavings(): Promise<{
  templatesService: number;
  templatesUtility: number;
  templateMarketing: number;
  totalSavings: number;
}> {
  const supabase = getSupabaseServerClient();

  // Query templates sent this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // @ts-ignore - Future: create service_templates table
  const { data: templates } = await supabase
    .from('template_logs')
    .select('*')
    .gte('created_at', startOfMonth.toISOString());

  const counts = {
    service: 0,
    utility: 0,
    marketing: 0,
  };

  templates?.forEach((t) => {
    if (t.category === 'SERVICE') counts.service++;
    else if (t.category === 'UTILITY') counts.utility++;
    else if (t.category === 'MARKETING') counts.marketing++;
  });

  // Calculate savings
  // If all SERVICE were UTILITY instead:
  const savingsVsUtility = counts.service * 0.0125;
  // If all SERVICE were MARKETING instead:
  const savingsVsMarketing = counts.service * 0.0667;

  return {
    templatesService: counts.service,
    templatesUtility: counts.utility,
    templateMarketing: counts.marketing,
    totalSavings: savingsVsUtility, // Conservative estimate
  };
}
```

---

## Migración: UTILITY → SERVICE

### Paso 1: Identificar Templates Candidatos

**Pregunta para cada template UTILITY**:
> ¿Es este template para soporte/atención al cliente?

**Si SÍ** → Candidato para SERVICE

**Si NO** → Mantener como UTILITY

**Ejemplos**:

| Template Actual | Categoría Actual | ¿Migrar a SERVICE? | Por qué |
|-----------------|------------------|---------------------|---------|
| `window_maintenance_reminder` | UTILITY | ✅ SÍ | Es seguimiento de soporte |
| `appointment_reminder` | UTILITY | ❌ NO | Es notificación transaccional, no soporte |
| `session_expiry` | UTILITY | ✅ SÍ | Es continuación de sesión de soporte |
| `payment_confirmation` | UTILITY | ❌ NO | Es confirmación transaccional |

### Paso 2: Crear Versión SERVICE del Template

**Template original** (UTILITY):
```
window_maintenance_reminder

Body:
Notificación de sistema: Sesión #{{session_id}}
Estado: Por expirar en {{hours}} horas
Acción requerida: Responder para continuar soporte activo
```

**Template SERVICE** (nuevo):
```
service_session_followup

Category: SERVICE
Language: Spanish

Body:
Seguimiento de sesión de soporte #{{session_id}}

Última interacción: Hace {{hours}} horas
Estado: Activa

¿Necesitas continuar con el soporte de esta sesión?
Responde y con gusto te asistimos.

Variables:
{{session_id}}: SESS-48291
{{hours}}: 20
```

**Cambios clave**:
1. Nombre diferente (para no confundir)
2. Categoría: **SERVICE**
3. Tono más de "asistencia" que "sistema"
4. Enfoque en soporte continuo

### Paso 3: Actualizar Código

**Antes**:
```typescript
// lib/template-messages.ts
export async function sendWindowMaintenanceTemplate(
  phoneNumber: string,
  userName?: string
): Promise<string> {
  return sendTemplate(phoneNumber, {
    name: 'window_maintenance_reminder',  // UTILITY
    language: 'es',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: userName || 'amigo' },
        ],
      },
    ],
  });
}
```

**Después**:
```typescript
// lib/template-messages.ts

/**
 * Send SERVICE template for session follow-up
 * FREE even outside 24h window (SERVICE category)
 */
export async function sendServiceSessionFollowUp(
  phoneNumber: string,
  sessionId: string,
  hoursSinceLastInteraction: number
): Promise<string> {
  return sendTemplate(phoneNumber, {
    name: 'service_session_followup',  // SERVICE ⭐
    language: 'es',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: sessionId },
          { type: 'text', text: hoursSinceLastInteraction.toString() },
        ],
      },
    ],
  });
}

/**
 * DEPRECATED: Use sendServiceSessionFollowUp() instead
 * This function uses UTILITY template ($0.0125)
 * New SERVICE version is FREE
 */
export async function sendWindowMaintenanceTemplate(
  phoneNumber: string,
  userName?: string
): Promise<string> {
  logger.warn('[template] Using deprecated UTILITY template. Consider migrating to SERVICE.');

  return sendTemplate(phoneNumber, {
    name: 'window_maintenance_reminder',
    language: 'es',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: userName || 'amigo' },
        ],
      },
    ],
  });
}
```

### Paso 4: Actualizar Cron Jobs

**app/api/cron/maintain-windows/route.ts**:

```typescript
// ANTES
if (!window.isOpen) {
  await sendWindowMaintenanceTemplate(window.phone_number, userName);
}

// DESPUÉS
if (!window.isOpen) {
  const sessionId = `SESS-${window.user_id}`;
  const hoursSince = calculateHoursSince(window.updated_at);

  await sendServiceSessionFollowUp(
    window.phone_number,
    sessionId,
    hoursSince
  );

  // Track savings
  await trackServiceTemplate(
    window.phone_number,
    'service_session_followup',
    false // wasWithinWindow
  );
}
```

### Paso 5: Testing

**Test en desarrollo**:
```typescript
// scripts/test-service-template.ts
import { sendServiceSessionFollowUp } from '../lib/template-messages';

async function testServiceTemplate() {
  const testPhone = '+573001234567'; // Tu número de prueba

  try {
    const messageId = await sendServiceSessionFollowUp(
      testPhone,
      'SESS-TEST-001',
      12
    );

    console.log('✅ SERVICE template sent:', messageId);
    console.log('📱 Check WhatsApp for message');
    console.log('💰 Cost: $0.00 (FREE)');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testServiceTemplate();
```

**Ejecutar**:
```bash
npx tsx scripts/test-service-template.ts
```

### Paso 6: Monitoreo Post-Migración

**Dashboard de ahorro**:
```typescript
// api/admin/service-savings/route.ts
export async function GET(req: Request): Promise<Response> {
  const savings = await getMonthlyServiceSavings();

  return new Response(
    JSON.stringify({
      month: new Date().toLocaleString('es-CO', { month: 'long', year: 'numeric' }),
      templates: {
        service: savings.templatesService,
        utility: savings.templatesUtility,
        marketing: savings.templateMarketing,
      },
      savings: {
        amount: `$${savings.totalSavings.toFixed(2)}`,
        percentage: savings.templatesService > 0
          ? `${((savings.totalSavings / (savings.templatesService * 0.0125)) * 100).toFixed(0)}%`
          : '0%',
      },
    }),
    {
      headers: { 'content-type': 'application/json' },
    }
  );
}
```

---

## ROI de Migración a SERVICE

### Escenario Conservador

```
Templates fuera de ventana/mes: 50
Costo actual (UTILITY): 50 × $0.0125 = $0.625/mes
Costo con SERVICE: 50 × $0.00 = $0.00/mes
Ahorro mensual: $0.625
Ahorro anual: $7.50
```

### Escenario Realista

```
Templates fuera de ventana/mes: 200
Costo actual (UTILITY): 200 × $0.0125 = $2.50/mes
Costo con SERVICE: 200 × $0.00 = $0.00/mes
Ahorro mensual: $2.50
Ahorro anual: $30.00
```

### Escenario Escalado (1000 usuarios)

```
Templates fuera de ventana/mes: 2000
Costo actual (UTILITY): 2000 × $0.0125 = $25/mes
Costo con SERVICE: 2000 × $0.00 = $0.00/mes
Ahorro mensual: $25
Ahorro anual: $300
```

### Factor Adicional: Mal Categorizados

Si algunos templates están incorrectamente categorizados como MARKETING:

```
100 templates UTILITY mal categorizados como MARKETING:
Costo actual: 100 × $0.0667 = $6.67/mes
Costo con SERVICE: 100 × $0.00 = $0.00/mes
Ahorro mensual: $6.67
Ahorro anual: $80.04
```

---

## Best Practices para SERVICE

### DO ✅

1. **Usar para soporte legítimo**:
   - Respuestas a consultas de usuarios
   - Seguimiento de problemas
   - Asistencia técnica

2. **Mantener tono de ayuda**:
   - "¿Necesitas asistencia?"
   - "¿Podemos ayudarte?"
   - "Con gusto te asistimos"

3. **Referenciar interacciones previas**:
   - "Seguimiento de tu consulta #123"
   - "Sobre tu caso del [fecha]"
   - "Continuación de sesión de soporte"

4. **Ofrecer valor claro**:
   - Responder preguntas
   - Resolver problemas
   - Proporcionar información

### DON'T ❌

1. **NO abusar de la categoría**:
   - No es para marketing disfrazado
   - No es para ventas proactivas
   - No es para engagement sin propósito

2. **NO vender en SERVICE**:
   - "¿Te interesa upgrade?" ❌
   - "Nuevos productos disponibles" ❌
   - Mantener enfoque en soporte

3. **NO usar para spam**:
   - Templates SERVICE son gratis
   - Pero Meta revisa patrones de abuso
   - Pueden revocar acceso si se abusa

4. **NO mezclar con promocional**:
   - SERVICE es soporte puro
   - Marketing va en templates MARKETING
   - No combinar en mismo template

---

## FAQ

### ¿SERVICE templates reemplazan UTILITY?

**No**. Ambos siguen existiendo:

- **SERVICE**: Para soporte/atención al cliente (gratis siempre)
- **UTILITY**: Para notificaciones transaccionales (gratis en 24h, $0.0125 fuera)

### ¿Cuándo usar cada uno?

**SERVICE**:
- Seguimiento de consultas
- Soporte técnico
- Atención al cliente
- Preguntas sobre servicio

**UTILITY**:
- Confirmaciones de transacciones
- Recordatorios de citas
- Notificaciones de estado
- Alertas de cuenta

### ¿Meta verifica que SERVICE sea legítimo?

**Sí**. Meta puede:
- Revisar contenido de templates
- Analizar patrones de uso
- Suspender cuenta si hay abuso

**Por eso**: Usar SERVICE solo para soporte real.

### ¿Qué pasa si mis templates SERVICE son rechazados?

**Opciones**:
1. Editar contenido para ser más claramente de soporte
2. Apelar con justificación
3. Usar templates UTILITY como backup

### ¿Puedo migrar templates existentes?

**No directamente**. Debes:
1. Crear nuevo template con categoría SERVICE
2. Esperar aprobación
3. Actualizar código para usar nuevo template
4. Deprecar template UTILITY anterior

---

## Recursos

### Documentación
- [Pricing Guide 2025](./pricing-guide-2025.md) - Overview completo de pricing
- [Template Troubleshooting](./template-troubleshooting.md) - Solucionar rechazos

### Meta Docs
- [SERVICE Announcement](https://developers.facebook.com/docs/whatsapp/pricing/updates-to-pricing/)
- [Conversation Types](https://developers.facebook.com/docs/whatsapp/pricing/conversation-based-pricing)

### Código
- `lib/template-messages.ts` - Templates actuales
- `lib/service-conversations.ts` - Tracking SERVICE (crear)
- `app/api/admin/service-savings/route.ts` - Dashboard ahorros (crear)

---

**Última actualización**: 2025-10-08
**Autor**: migue.ai team
**Oportunidad**: 💰 100% reducción de costos en templates de soporte
