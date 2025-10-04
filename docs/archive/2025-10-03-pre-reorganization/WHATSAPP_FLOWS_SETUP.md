# WhatsApp Flows - Configuración del Proyecto

**Proyecto:** migue.ai
**Última Actualización:** Octubre 2025
**API Version:** v23.0

---

## Tabla de Contenidos

1. [Prerequisitos](#prerequisitos)
2. [Configuración Inicial](#configuración-inicial)
3. [Crear Flows en Meta Business Manager](#crear-flows-en-meta-business-manager)
4. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
5. [Configuración de Encriptación (Data Exchange)](#configuración-de-encriptación-data-exchange)
6. [Verificación de Configuración](#verificación-de-configuración)
7. [Flows Disponibles](#flows-disponibles)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisitos

Antes de configurar WhatsApp Flows, asegúrate de tener:

- [ ] Cuenta de Meta Business Manager
- [ ] Aplicación de WhatsApp Business configurada
- [ ] WhatsApp API Token con permisos de `whatsapp_business_messaging`
- [ ] Phone Number ID configurado
- [ ] Supabase conectado y configurado
- [ ] Variables de entorno básicas configuradas (ver `.env.example`)

---

## Configuración Inicial

### 1. Vincular Supabase

El proyecto ya tiene las tablas necesarias definidas en `supabase/schema.sql`, pero necesitas vincular tu instancia de Supabase:

```bash
# Autenticarse en Supabase
supabase login

# Vincular con el proyecto
supabase link --project-ref <tu-project-ref>

# Regenerar tipos TypeScript
supabase gen types typescript --linked > types/database.types.ts
```

**Nota:** El project-ref lo encuentras en tu URL de Supabase: `https://[project-ref].supabase.co`

### 2. Verificar Schema de Base de Datos

Asegúrate de que la tabla `flow_sessions` exista en tu base de datos Supabase:

```sql
-- Verificar en Supabase SQL Editor
SELECT * FROM information_schema.tables
WHERE table_name = 'flow_sessions';
```

Si no existe, ejecuta el schema completo desde `supabase/schema.sql` en el SQL Editor de Supabase.

---

## Crear Flows en Meta Business Manager

### 1. Acceder al Flow Builder

1. Ve a [Meta Business Manager](https://business.facebook.com)
2. Selecciona tu aplicación de WhatsApp Business
3. En el menú lateral, busca **WhatsApp > Flows**
4. Haz clic en **Create Flow**

### 2. Configurar el Endpoint de Data Exchange

Para flows con `data_exchange`, configura el endpoint:

**Endpoint URL:**
```
https://tu-dominio.com/api/whatsapp/flows
```

**Método:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

### 3. Tipos de Flows Disponibles

El proyecto incluye implementación completa para tres tipos de flows:

#### A. Lead Generation Flow

**Propósito:** Capturar información de contacto de potenciales clientes

**Pantallas:**
- `LEAD_FORM`: Formulario de contacto (nombre, email, teléfono, empresa)
- `CONFIRMATION`: Confirmación de envío

**Configuración en Meta:**
- Flow Type: `navigate`
- Initial Screen: `LEAD_FORM`

#### B. Appointment Booking Flow

**Propósito:** Permitir a usuarios agendar citas

**Pantallas:**
- `DATE_PICKER`: Selección de fecha
- `TIME_PICKER`: Selección de hora
- `APPOINTMENT_CONFIRMED`: Confirmación

**Configuración en Meta:**
- Flow Type: `data_exchange`
- Initial Screen: `DATE_PICKER`
- Endpoint: `/api/whatsapp/flows`

#### C. Feedback Collection Flow

**Propósito:** Recopilar feedback y calificaciones de usuarios

**Pantallas:**
- `RATING`: Calificación (1-5 estrellas)
- `THANK_YOU`: Agradecimiento

**Configuración en Meta:**
- Flow Type: `navigate`
- Initial Screen: `RATING`

### 4. Obtener Flow IDs

Después de crear cada flow:

1. Ve a **WhatsApp > Flows** en Meta Business Manager
2. Selecciona el flow
3. Copia el **Flow ID** (formato: número largo, ej: `123456789012345`)

---

## Configuración de Variables de Entorno

### 1. Agregar Flow IDs a `.env.local`

```bash
# WhatsApp Flows Configuration
FLOW_ID_LEAD_GENERATION=<tu-flow-id-aqui>
FLOW_ID_APPOINTMENT_BOOKING=<tu-flow-id-aqui>
FLOW_ID_FEEDBACK=<tu-flow-id-aqui>
```

### 2. Mapeo de Flow IDs en el Código

Los Flow IDs se mapean automáticamente en `lib/whatsapp-flows.ts`:

```typescript
export const FLOW_TEMPLATES = {
  LEAD_GENERATION: {
    id: process.env.FLOW_ID_LEAD_GENERATION || 'lead_generation_flow',
    name: 'Lead Generation',
    cta: 'Get Started',
    bodyText: 'Please provide your contact information',
  },
  // ...otros flows
};
```

---

## Configuración de Encriptación (Data Exchange)

**Nota:** Solo necesario si usas flows con `data_exchange` y quieres encriptación.

### 1. Generar Private Key en Meta

1. Ve a **WhatsApp > Flows > Settings**
2. En la sección **Encryption**, haz clic en **Generate Private Key**
3. Copia la clave privada generada

### 2. Agregar a Variables de Entorno

```bash
# .env.local
FLOW_PRIVATE_KEY=<tu-private-key-desde-meta>
```

### 3. Implementar Encriptación (Opcional)

Si necesitas encriptación, agrega la lógica en `lib/whatsapp-flows.ts`:

```typescript
import crypto from 'crypto';

function decryptFlowData(encryptedData: string, privateKey: string) {
  // Implementación de desencriptación según docs de Meta
  // https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint#encryption
}
```

---

## Verificación de Configuración

### 1. Verificar Endpoint de Flows

```bash
curl -X POST https://tu-dominio.com/api/whatsapp/flows \
  -H "Content-Type: application/json" \
  -d '{
    "flow_token": "test-token",
    "action": "ping",
    "screen": "TEST",
    "data": {}
  }'
```

**Respuesta esperada:**
```json
{
  "version": "3.0",
  "screen": "SUCCESS",
  "data": {
    "status": "pong"
  }
}
```

### 2. Probar Flow desde WhatsApp

Usa la función `sendFlow` desde tu código:

```typescript
import { sendFlow } from '@/lib/whatsapp-flows';

// Enviar flow de lead generation
await sendFlow(
  '+1234567890',
  process.env.FLOW_ID_LEAD_GENERATION!,
  'Get Started',
  'Please provide your contact information'
);
```

### 3. Verificar en Supabase

Después de enviar un flow, verifica que se creó la sesión:

```sql
SELECT * FROM flow_sessions
ORDER BY created_at DESC
LIMIT 5;
```

---

## Flows Disponibles

### Uso desde Código

#### Lead Generation
```typescript
import { sendFlow, FLOW_TEMPLATES } from '@/lib/whatsapp-flows';

const template = FLOW_TEMPLATES.LEAD_GENERATION;
await sendFlow(
  userPhone,
  template.id,
  template.cta,
  template.bodyText
);
```

#### Appointment Booking
```typescript
const template = FLOW_TEMPLATES.APPOINTMENT_BOOKING;
await sendFlow(
  userPhone,
  template.id,
  template.cta,
  template.bodyText,
  {
    flowType: 'data_exchange',
    initialScreen: 'DATE_PICKER',
  }
);
```

#### Feedback Collection
```typescript
const template = FLOW_TEMPLATES.FEEDBACK_COLLECTION;
await sendFlow(
  userPhone,
  template.id,
  template.cta,
  template.bodyText
);
```

---

## Troubleshooting

### Error: "Invalid flow_id"

**Causa:** El Flow ID configurado no existe o no está publicado en Meta.

**Solución:**
1. Verifica que el Flow ID esté correcto en `.env.local`
2. Asegúrate de que el flow esté **Publicado** en Meta Business Manager
3. Verifica que tengas permisos de `whatsapp_business_messaging`

### Error: "Flow token invalid"

**Causa:** El token de flow no existe en la base de datos o expiró.

**Solución:**
1. Verifica que la tabla `flow_sessions` existe en Supabase
2. Revisa los logs de la función `sendFlow`
3. Asegúrate de que `generateFlowToken()` está generando tokens únicos

### Error: "Data exchange endpoint not responding"

**Causa:** El endpoint `/api/whatsapp/flows` no está accesible o tiene errores.

**Solución:**
1. Verifica que el endpoint esté desplegado en producción
2. Revisa los logs de Vercel para errores
3. Prueba el endpoint manualmente con curl (ver sección de verificación)

### Flow no aparece en WhatsApp

**Causa:** El flow no está publicado o hay un error en la configuración.

**Solución:**
1. Verifica que el flow esté **Publicado** en Meta Business Manager
2. Asegúrate de que el WhatsApp Token tenga permisos correctos
3. Revisa que el Flow ID sea correcto

---

## Referencias

- [Documentación completa de Flows](./whatsapp-api-v23-flows.md)
- [WhatsApp Flows API Reference](https://developers.facebook.com/docs/whatsapp/flows)
- [Código de implementación](../lib/whatsapp-flows.ts)
- [Endpoint de Data Exchange](../app/api/whatsapp/flows/route.ts)

---

## Próximos Pasos

1. [ ] Crear flows en Meta Business Manager
2. [ ] Obtener Flow IDs
3. [ ] Configurar variables de entorno
4. [ ] Probar flows en desarrollo
5. [ ] Desplegar a producción
6. [ ] Monitorear métricas de uso

---

**Última actualización:** 2025-10-03
**Mantenido por:** claude-master
