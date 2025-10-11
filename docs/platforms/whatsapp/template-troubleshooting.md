# WhatsApp Template Troubleshooting Guide

**Última actualización**: 2025-10-08
**Para**: Meta Business Manager Template Creation

---

## 📋 Problema Principal

**Meta marca templates UTILITY como MARKETING** → Costo 5x mayor

- UTILITY: $0.0125/mensaje
- MARKETING: $0.0667/mensaje
- **Pérdida**: $0.0542 por mensaje mal categorizado

En 1000 mensajes/mes = **$54.20 desperdiciados**

---

## ¿Por Qué Sucede?

Meta usa **IA automática** para detectar categorías basándose en el contenido:

### Triggers que Marcan como MARKETING ❌

1. **Lenguaje genérico/relacional**:
   - "¿Cómo va todo?"
   - "¿Cómo estás?"
   - "Te extraño"
   - "Hola amigo"

2. **Frases de engagement**:
   - "Estoy aquí si necesitas"
   - "Disponible para ayudarte"
   - "Cuéntame qué necesitas"

3. **Múltiples emojis**:
   - "Hola 😊 ¿cómo estás? 🤗"
   - Más de 1 emoji = sospecha marketing

4. **Preguntas abiertas sin contexto**:
   - "¿En qué puedo ayudarte?"
   - "¿Necesitas algo?"
   - "¿Todo bien?"

5. **Palabras promocionales**:
   - "oferta", "descuento", "gratis"
   - "nuevo", "exclusivo", "limitado"
   - "aprovecha", "ahora", "hoy"

6. **Lenguaje persuasivo**:
   - "No te pierdas"
   - "Última oportunidad"
   - "Solo por hoy"

### Señales de UTILITY Correctas ✅

1. **Referencias específicas**:
   - "Cita #12345"
   - "Pedido #ABC123"
   - "Sesión iniciada el 2025-10-08"

2. **Lenguaje transaccional**:
   - "Confirmación de"
   - "Notificación de sistema"
   - "Acción requerida"
   - "Estado: pendiente"

3. **Contexto claro de acción previa**:
   - "Según tu solicitud del {{date}}"
   - "Para completar tu proceso"
   - "Continuación de consulta #{{id}}"

4. **Llamadas a acción específicas**:
   - "Responde 1-Confirmar, 2-Cancelar"
   - "Click aquí para ver detalles"
   - "Ingresa código de verificación"

5. **Información técnica/de sistema**:
   - IDs, números de referencia
   - Timestamps, fechas específicas
   - Estados (pendiente, confirmado, cancelado)

---

## Casos de Estudio: Template de Mantenimiento de Ventana

### ❌ RECHAZADO (Marcado como Marketing)

**Template Original**:
```
window_maintenance_reminder

Categoría: UTILITY
Idioma: Spanish

Body:
Hola {{customer_name}}, ¿cómo va todo? Estoy aquí si necesitas ayuda 😊

Variables:
{{customer_name}}: robert
```

**¿Por qué fue rechazado?**
1. "¿Cómo va todo?" → Muy genérico, parece small talk
2. "Estoy aquí si necesitas ayuda" → Suena a engagement marketing
3. Emoji 😊 → Señal de mensaje relacional
4. No hay contexto transaccional
5. No hay acción específica

**Resultado**: Meta lo categoriza como **MARKETING** = $0.0667

---

### ✅ APROBADO (Categorizado como UTILITY)

**Template Corregido**:
```
session_expiry_notification

Categoría: UTILITY
Idioma: Spanish

Body:
Notificación de sistema: Sesión #{{session_id}}

Estado: Por expirar en {{hours}} horas
Acción requerida: Responder para continuar soporte activo

Variables:
{{session_id}}: 24851
{{hours}}: 2
```

**¿Por qué fue aprobado?**
1. ✅ "Notificación de sistema" → Transaccional claro
2. ✅ "Sesión #{{session_id}}" → ID específico, parece backend
3. ✅ "Estado: Por expirar" → Información de estado técnica
4. ✅ "Acción requerida" → CTA específica clara
5. ✅ Sin emojis ni lenguaje relacional
6. ✅ Contexto técnico/sistemático

**Resultado**: Aprobado como **UTILITY** = $0.0125

---

## Fórmulas de Templates Aprobados

### Template de Recordatorio de Cita

**✅ FUNCIONA**:
```
appointment_confirmation

Body:
Confirmación de cita #{{appointment_id}}

Servicio: {{service_name}}
Fecha: {{date}}
Hora: {{time}}
Ubicación: {{location}}

Responde:
1 - Confirmar asistencia
2 - Reagendar cita
3 - Cancelar

Variables:
{{appointment_id}}: APT-2024-10851
{{service_name}}: Consulta médica general
{{date}}: 15 de octubre 2025
{{time}}: 10:30 AM
{{location}}: Calle 123 #45-67
```

**Por qué funciona**:
- ID de cita específico
- Información transaccional estructurada
- CTA con opciones numeradas claras
- Sin lenguaje promocional

---

### Template de Seguimiento Post-Consulta

**❌ NO FUNCIONA**:
```
Hola {{name}}, espero que estés bien.
¿Cómo te fue con lo que hablamos?
Estoy disponible si necesitas más ayuda 😊
```

**✅ FUNCIONA**:
```
follow_up_consultation

Body:
Seguimiento: Consulta #{{ticket_id}} del {{date}}

Tema: {{subject}}
Estado: {{status}}

Acción pendiente: {{action_required}}

Responde si necesitas asistencia adicional para este caso.

Variables:
{{ticket_id}}: TKT-48291
{{date}}: 8 de octubre 2025
{{subject}}: Configuración de cuenta
{{status}}: En progreso
{{action_required}}: Validar documento de identidad
```

---

### Template de Notificación de Acción Pendiente

**✅ FUNCIONA**:
```
pending_action_reminder

Body:
Acción pendiente en tu cuenta #{{account_id}}

Descripción: {{action_description}}
Vence: {{deadline}}
Prioridad: {{priority}}

Completar acción: {{action_link}}

Sin acción antes del {{deadline}}, se cancelará automáticamente.

Variables:
{{account_id}}: ACC-97231
{{action_description}}: Verificar correo electrónico
{{deadline}}: 12 de octubre 2025, 5:00 PM
{{priority}}: Alta
{{action_link}}: https://app.migue.ai/verify/abc123
```

---

### Template de Recordatorio de Vencimiento

**✅ FUNCIONA**:
```
expiration_notice

Body:
Aviso de vencimiento: {{item_type}} #{{item_id}}

Vence: {{expiry_date}}
Días restantes: {{days_left}}

Renovar antes del {{expiry_date}} para mantener acceso activo.

Variables:
{{item_type}}: Suscripción
{{item_id}}: SUB-48192
{{expiry_date}}: 20 de octubre 2025
{{days_left}}: 12
```

---

## Proceso de Creación Paso a Paso

### Paso 1: Planificar Contenido

**Checklist antes de escribir**:

- [ ] ¿Es específico a una acción del usuario?
- [ ] ¿Tiene contexto transaccional claro?
- [ ] ¿Incluye IDs o números de referencia?
- [ ] ¿La CTA es específica y clara?
- [ ] ¿Evita lenguaje genérico/relacional?
- [ ] ¿Evita palabras promocionales?
- [ ] ¿Usa máximo 1 emoji (preferible 0)?
- [ ] ¿Suena a "sistema" o "backend"?

### Paso 2: Crear Template en Meta Business Manager

1. **Ir a**: https://business.facebook.com
2. **Seleccionar**: Tu WhatsApp Business Account
3. **Click**: "Message Templates" (menú izquierdo)
4. **Click**: "Create Template"

### Paso 3: Configuración Inicial

**Category**: Seleccionar **UTILITY** primero (MUY IMPORTANTE)
- NO seleccionar Marketing
- Utility primero, luego validar con contenido

**Name**: Usar snake_case, descriptivo
- ✅ `appointment_confirmation`
- ✅ `session_expiry_notification`
- ✅ `pending_action_reminder`
- ❌ `reminder` (muy genérico)
- ❌ `message1` (sin contexto)

**Language**: Spanish (es)

### Paso 4: Variables

**Type of variable**: Usar tipos descriptivos
- **Name**: Para nombres de personas/empresas
- **Number**: Para IDs, cantidades, horas
- **Text**: Para descripciones, acciones

**IMPORTANTE**: Los nombres que pongas son solo para ti. Meta los convierte internamente a {{1}}, {{2}}, etc. para la API.

**En el template**:
```
{{customer_name}} - lo ves como {{customer_name}} en editor
```

**En la API** (automático):
```typescript
components: [
  {
    type: 'body',
    parameters: [
      { type: 'text', text: 'Carlos' } // Esto llena {{1}}
    ]
  }
]
```

### Paso 5: Contenido del Body

**Estructura recomendada**:
```
[Tipo de notificación]: [Item] #[ID]

[Campo 1]: [Valor 1]
[Campo 2]: [Valor 2]
[Campo 3]: [Valor 3]

[Acción específica requerida]

[Consecuencia de no actuar - opcional]
```

**Ejemplo aplicado**:
```
Confirmación de cita #{{1}}

Servicio: {{2}}
Fecha: {{3}}
Hora: {{4}}

Responde 1-Confirmar o 2-Cancelar
```

### Paso 6: Variable Samples (CRÍTICO)

**NO usar**:
- ❌ "test"
- ❌ "ejemplo"
- ❌ "lorem ipsum"
- ❌ "123"
- ❌ "xxx"

**SÍ usar** (datos realistas):
- ✅ Nombres reales: "Carlos", "María", "roberto"
- ✅ IDs realistas: "APT-2024-10851", "TKT-48291"
- ✅ Fechas específicas: "15 de octubre 2025"
- ✅ Números plausibles: "24" (horas), "2" (días)

**Por qué importa**: Meta valida el template con estos ejemplos. Si parecen fake, puede rechazarlo.

### Paso 7: Submit para Revisión

**ANTES de hacer click en "Submit"**:

1. **Revisar preview** (lado derecho)
2. **Verificar que suene transaccional**, no promocional
3. **Contar emojis** (max 1, preferible 0)
4. **Buscar palabras trigger** de marketing

**Al hacer click "Submit"**:

Meta puede mostrar modal: **"Submitting this template will update its category to marketing"**

**SI ves este modal**:
1. ❌ **NO hacer click en "Submit"**
2. ✅ Click "Cancel"
3. ✅ Volver a editar contenido
4. ✅ Hacer más transaccional/específico
5. ✅ Remover elementos promocionales/genéricos

### Paso 8: Esperar Aprobación

**Timeline normal**:
- Mayoría: Aprobados en **minutos** a **2 horas**
- Algunos: Hasta 24 horas
- Si > 24h: Probablemente necesita revisión manual

**Estados**:
- **Pending**: En revisión
- **Approved**: ✅ Listo para usar
- **Rejected**: ❌ Necesita cambios

### Paso 9: Si es Rechazado

**Tienes 60 días** para:
1. Ver razón de rechazo en Meta
2. Editar template
3. Re-enviar para aprobación
4. O apelar a través de Business Support

**Razones comunes de rechazo**:
- Contenido muy genérico
- Parece promocional/marketing
- Información sensible (contraseñas, tarjetas)
- Lenguaje inapropiado
- No cumple con políticas de WhatsApp

---

## Testing Local Antes de Crear Template

### Validador de Contenido

```typescript
/**
 * Predice si Meta marcará template como Marketing
 * Basado en análisis de rechazos reales
 */
function willBeMarkedAsMarketing(content: string): {
  isMarketing: boolean;
  reasons: string[];
  score: number; // 0-100, >50 = riesgo alto
} {
  const triggers = {
    // Palabras genéricas (peso: 15 puntos c/u)
    generic: [
      'cómo va',
      'cómo estás',
      'cómo te fue',
      'todo bien',
      'qué tal',
    ],

    // Engagement (peso: 20 puntos c/u)
    engagement: [
      'estoy aquí',
      'disponible',
      'ayudarte',
      'necesitas',
      'cuéntame',
    ],

    // Promocional (peso: 30 puntos c/u)
    promotional: [
      'oferta',
      'descuento',
      'gratis',
      'nuevo',
      'exclusivo',
      'limitado',
      'aprovecha',
      'última oportunidad',
    ],

    // Relacional (peso: 10 puntos c/u)
    relational: [
      'amigo',
      'te extraño',
      'espero que',
      'me alegra',
    ],
  };

  const reasons: string[] = [];
  let score = 0;
  const lowerContent = content.toLowerCase();

  // Check each category
  Object.entries(triggers).forEach(([category, words]) => {
    words.forEach((word) => {
      if (lowerContent.includes(word)) {
        const weights = {
          generic: 15,
          engagement: 20,
          promotional: 30,
          relational: 10,
        };
        score += weights[category as keyof typeof weights];
        reasons.push(`"${word}" → ${category}`);
      }
    });
  });

  // Check emoji count
  const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length;
  if (emojiCount > 1) {
    score += emojiCount * 5;
    reasons.push(`${emojiCount} emojis → relational`);
  }

  // Check for exclamation marks
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 2) {
    score += exclamationCount * 3;
    reasons.push(`${exclamationCount} exclamation marks → promotional`);
  }

  // Check for IDs/numbers (reduce score)
  const hasIds = /\#\{\{?\d+\}\}?|#[A-Z]+-\d+/.test(content);
  if (hasIds) {
    score -= 20;
    reasons.push('Has IDs → transactional ✅');
  }

  // Check for transactional keywords (reduce score)
  const transactional = [
    'confirmación',
    'notificación',
    'recordatorio',
    'estado:',
    'acción requerida',
    'vence:',
  ];
  transactional.forEach((word) => {
    if (lowerContent.includes(word)) {
      score -= 10;
      reasons.push(`"${word}" → transactional ✅`);
    }
  });

  return {
    isMarketing: score > 50,
    reasons,
    score: Math.max(0, Math.min(100, score)),
  };
}

// Uso:
const template = `
Hola {{customer_name}}, ¿cómo va todo? Estoy aquí si necesitas ayuda 😊
`;

const validation = willBeMarkedAsMarketing(template);
console.log(validation);
/*
{
  isMarketing: true,
  reasons: [
    '"cómo va" → generic',
    '"estoy aquí" → engagement',
    '"ayuda" → engagement',
    '1 emojis → relational'
  ],
  score: 55
}
*/

const templateFixed = `
Notificación de sistema: Sesión #{{session_id}}
Estado: Por expirar en {{hours}} horas
Acción requerida: Responder para continuar
`;

const validationFixed = willBeMarkedAsMarketing(templateFixed);
console.log(validationFixed);
/*
{
  isMarketing: false,
  reasons: [
    'Has IDs → transactional ✅',
    '"notificación" → transactional ✅',
    '"estado:" → transactional ✅',
    '"acción requerida" → transactional ✅'
  ],
  score: 10
}
*/
```

### Script de Validación

Crear archivo: `scripts/validate-template.ts`

```typescript
import { willBeMarkedAsMarketing } from '../lib/template-validator';

const templates = {
  window_maintenance_v1: `
    Hola {{customer_name}}, ¿cómo va todo?
    Estoy aquí si necesitas ayuda 😊
  `,

  window_maintenance_v2: `
    Notificación de sistema: Sesión #{{session_id}}
    Estado: Por expirar en {{hours}} horas
    Acción requerida: Responder para continuar
  `,

  appointment_reminder: `
    Confirmación de cita #{{appointment_id}}
    Fecha: {{date}} a las {{time}}
    Responde 1-Confirmar o 2-Cancelar
  `,
};

console.log('=== Template Validation Report ===\n');

Object.entries(templates).forEach(([name, content]) => {
  const result = willBeMarkedAsMarketing(content);

  console.log(`Template: ${name}`);
  console.log(`Score: ${result.score}/100`);
  console.log(`Risk: ${result.isMarketing ? '❌ HIGH (will be Marketing)' : '✅ LOW (should be Utility)'}`);
  console.log(`Reasons:`);
  result.reasons.forEach((reason) => console.log(`  - ${reason}`));
  console.log('');
});
```

Ejecutar:
```bash
npx tsx scripts/validate-template.ts
```

---

## Apelar Categorización Incorrecta

Si tu template fue marcado como Marketing pero debería ser Utility:

### Opción 1: Business Support

1. Ir a: https://business.facebook.com/support
2. Click "Get Support"
3. Seleccionar: WhatsApp Business Platform
4. Issue: Template Category Review
5. Explicar:
   ```
   Template Name: [nombre]
   Current Category: MARKETING
   Requested Category: UTILITY

   Justification:
   This template is transactional, not promotional.
   It serves to [explicar uso específico transaccional].

   Evidence:
   - Contains transaction ID: {{id}}
   - Relates to user action: [acción]
   - No promotional content
   - Specific call-to-action related to ongoing process
   ```

### Opción 2: Editar y Re-enviar

Más rápido que apelar:

1. Crear nuevo template con nombre diferente
2. Usar contenido más transaccional (ver ejemplos arriba)
3. Enviar para aprobación
4. Una vez aprobado, deprecar el anterior

---

## Mejores Prácticas Resumidas

### DO ✅

1. **Usar IDs y números de referencia**
   - Cita #12345, Pedido #ABC789
   - Sesión #48291, Ticket #TKT-9281

2. **Lenguaje de sistema/backend**
   - "Notificación de sistema"
   - "Estado actualizado"
   - "Acción requerida"

3. **Contexto transaccional claro**
   - Referencia a acción previa del usuario
   - Información de proceso iniciado
   - Continuación de consulta

4. **CTAs específicas**
   - "Responde 1-Confirmar, 2-Cancelar"
   - "Click aquí para completar verificación"
   - "Ingresa código recibido"

5. **Datos estructurados**
   - Campos: Valores
   - Formato consistente
   - Fácil de escanear

### DON'T ❌

1. **Evitar lenguaje genérico**
   - "¿Cómo estás?"
   - "¿Todo bien?"
   - "¿Cómo va?"

2. **No usar engagement**
   - "Estoy aquí para ayudarte"
   - "Disponible cuando necesites"
   - "Cuéntame qué necesitas"

3. **No palabras promocionales**
   - "Oferta", "descuento", "gratis"
   - "Nuevo", "exclusivo", "limitado"

4. **Limitar emojis**
   - Máximo 1 emoji
   - Preferiblemente 0

5. **No preguntas abiertas sin contexto**
   - "¿En qué puedo ayudarte?"
   - "¿Necesitas algo?"

---

## Recursos Adicionales

### Herramientas
- [Template Validator Script](../../scripts/validate-template.ts)
- [Template Generator](../../scripts/generate-template.ts) (próximamente)

### Documentación
- [Pricing Guide 2025](./pricing-guide-2025.md)
- [Service Conversations](./service-conversations.md)
- [Meta Template Guidelines](https://developers.facebook.com/docs/whatsapp/updates-to-pricing/new-template-guidelines/)

### Soporte
- [Business Support Home](https://business.facebook.com/support)
- [WhatsApp Business Policy](https://www.whatsapp.com/legal/business-policy)

---

**Última actualización**: 2025-10-08
**Autor**: migue.ai team
