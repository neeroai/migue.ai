# Guía Completa: WhatsApp Flows en migue.ai

**Última actualización:** Octubre 2025
**API Version:** v23.0
**Data API Version:** 3.0
**Edge Runtime Compatible:** ✅ Sí

---

## 📚 Índice de la Documentación

Esta guía está dividida en 4 partes para facilitar la navegación y el aprendizaje:

### [Parte 1: Fundamentos de WhatsApp Flows](./01-fundamentos.md)
- ¿Qué son los WhatsApp Flows?
- Casos de uso principales
- Arquitectura del sistema en migue.ai
- Tipos de Flows (Navigate vs Data Exchange)
- Cuándo usar cada tipo
- Flujo de datos completo

### [Parte 2: Implementación Técnica](./02-implementacion-tecnica.md)
- Estructura de archivos y código
- Análisis detallado de `lib/whatsapp-flows.ts`
- Endpoint API en `app/api/whatsapp/flows/route.ts`
- Base de datos: tabla `flow_sessions`
- TypeScript types y validación
- Ciclo de vida completo de un Flow

### [Parte 3: Templates y Casos de Uso](./03-templates-casos-uso.md)
- Template: Lead Generation (formulario de contacto)
- Template: Appointment Booking (reserva con disponibilidad)
- Template: Feedback Collection (ratings y comentarios)
- Ejemplos de código completos
- Integración con el sistema AI
- Cómo crear templates personalizados

### [Parte 4: Seguridad, Testing y Debugging](./04-seguridad-testing.md)
- Validación HMAC-SHA256
- Generación de tokens seguros
- Gestión de sesiones y expiración
- Testing local de Flows
- Debugging y logs
- Errores comunes y soluciones
- Mejores prácticas
- Limitaciones y consideraciones

---

## 🚀 Quick Start

### Enviar un Flow Navigate (autocontenido)

```typescript
import { sendFlow, FLOW_TEMPLATES } from '@/lib/whatsapp-flows';

// Enviar formulario de contacto
await sendFlow(
  '1234567890',                           // Número WhatsApp
  FLOW_TEMPLATES.LEAD_GENERATION.id,      // Flow ID
  FLOW_TEMPLATES.LEAD_GENERATION.cta,     // "Get Started"
  FLOW_TEMPLATES.LEAD_GENERATION.bodyText // Mensaje principal
);
```

### Enviar un Flow Data Exchange (dinámico)

```typescript
// Reserva de citas con disponibilidad en tiempo real
await sendFlow(
  '1234567890',
  FLOW_TEMPLATES.APPOINTMENT_BOOKING.id,
  FLOW_TEMPLATES.APPOINTMENT_BOOKING.cta,
  FLOW_TEMPLATES.APPOINTMENT_BOOKING.bodyText,
  {
    flowType: 'data_exchange',
    initialScreen: 'SELECT_SERVICE',
    initialData: {
      user_name: 'Juan Pérez'
    }
  }
);
```

### Manejar Data Exchange Request

```typescript
// app/api/whatsapp/flows/route.ts
import { handleFlowDataExchange } from '@/lib/whatsapp-flows';

export async function POST(req: Request) {
  const body = await req.json();
  const response = await handleFlowDataExchange(body);
  return Response.json(response);
}
```

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     WhatsApp User                           │
│                 (Interactúa con el Flow)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Completa Flow
┌─────────────────────────────────────────────────────────────┐
│              WhatsApp Cloud API (v23.0)                     │
│          - Envía Flow al usuario                            │
│          - Recibe respuestas completadas                    │
│          - Envía webhooks con datos                         │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
        ↓ Navigate Flow                   ↓ Data Exchange Flow
┌─────────────────┐              ┌───────────────────────────┐
│   Webhook       │              │  Flow Endpoint            │
│   Handler       │              │  /api/whatsapp/flows      │
│  (route.ts)     │              │  - Valida firma HMAC      │
│                 │              │  - Maneja data exchange   │
│  Recibe datos   │              │  - Consulta backend       │
│  completados    │              │  - Retorna datos dinámicos│
└────────┬────────┘              └────────┬──────────────────┘
         │                                │
         └────────────┬───────────────────┘
                      ↓
         ┌────────────────────────────────┐
         │     lib/whatsapp-flows.ts      │
         │  - sendFlow()                  │
         │  - handleFlowDataExchange()    │
         │  - validateFlowSignature()     │
         │  - completeFlowSession()       │
         └────────────┬───────────────────┘
                      ↓
         ┌────────────────────────────────┐
         │   Supabase (flow_sessions)     │
         │  - Persistencia de sesiones    │
         │  - Estados: pending → completed│
         │  - Expiración automática 24h   │
         └────────────────────────────────┘
```

---

## 📊 Estado de Implementación

| Característica | Estado | Notas |
|---------------|--------|-------|
| Navigate Flows | ✅ Completo | Envío y recepción funcionando |
| Data Exchange Flows | ✅ Completo | Backend integration activo |
| Validación HMAC | ✅ Completo | Web Crypto API (Edge compatible) |
| Sesiones en DB | ✅ Completo | Tabla `flow_sessions` con RLS |
| Templates Predefinidos | ✅ 3 Templates | Lead Gen, Appointments, Feedback |
| Edge Runtime | ✅ Compatible | No usa Node.js APIs |
| Manejo de Errores | ✅ Completo | Fail-closed en producción |
| Testing | ⚠️ Parcial | Necesita más cobertura |

---

## 🎯 Casos de Uso Principales

### 1. Captura de Leads
Formularios de contacto estructurados con validación en tiempo real.

**Ejemplo:** Cliente interesado en servicios → Flow de Lead Generation → Datos guardados en Supabase → Notificación al equipo

### 2. Reserva de Citas
Sistema de booking con disponibilidad en tiempo real desde Google Calendar.

**Ejemplo:** Cliente quiere agendar → Flow de Appointment Booking → Verifica disponibilidad → Crea evento en Calendar → Confirma al cliente

### 3. Recolección de Feedback
Encuestas de satisfacción post-servicio con ratings y comentarios.

**Ejemplo:** Servicio completado → Flow de Feedback → Usuario califica experiencia → Datos guardados → Analytics actualizados

### 4. Autenticación y Verificación
Flows de login con OTP para verificar identidad.

**Ejemplo:** Usuario solicita acceso → Flow envía OTP → Usuario ingresa código → Verifica en backend → Sesión autenticada

### 5. Procesos de Onboarding
Guiar nuevos usuarios a través de configuración inicial.

**Ejemplo:** Nuevo cliente → Flow de onboarding → Recolecta preferencias → Configura cuenta → Mensaje de bienvenida

---

## 🔧 Requisitos Técnicos

### Dependencias
- **Next.js 15+** con App Router
- **Vercel Edge Runtime** (runtime = 'edge')
- **Supabase** para persistencia
- **Web Crypto API** para seguridad
- **WhatsApp Cloud API v23.0+**

### Variables de Entorno Requeridas

```bash
# WhatsApp API
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_TOKEN=your_access_token
WHATSAPP_APP_SECRET=your_app_secret  # Para validación HMAC

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
```

### Tabla de Base de Datos

```sql
-- Se crea automáticamente con migrations
-- Ver: supabase/schema.sql (líneas 374-427)
create table flow_sessions (
  id uuid primary key,
  user_id uuid references users(id),
  flow_id text not null,
  flow_token text unique not null,
  flow_type text check (flow_type in ('navigate', 'data_exchange')),
  session_data jsonb default '{}'::jsonb,
  status flow_status default 'pending',
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);
```

---

## 📖 Recursos Adicionales

### Documentación Externa
- [WhatsApp Flows Official Docs](https://developers.facebook.com/docs/whatsapp/flows)
- [WhatsApp Cloud API v23.0](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/flows)
- [Meta Business Manager](https://business.facebook.com/latest/inbox/settings/flows)

### Documentación Interna
- [WhatsApp API v23 Guide](../api-v23-guide.md) - Guía general de la API
- [Interactive Features](../interactive-features.md) - Botones, listas, etc.
- [Edge Runtime Guide](../../05-deployment/edge-error-handling.md) - Limitaciones y optimizaciones

### Código de Referencia
- `lib/whatsapp-flows.ts` - Implementación principal (467 líneas)
- `app/api/whatsapp/flows/route.ts` - Endpoint Edge (75 líneas)
- `types/whatsapp.ts` - Definiciones TypeScript (líneas 161-218)
- `supabase/schema.sql` - Database schema (líneas 374-427)

---

## 🎓 Cómo Usar Esta Guía

### Para Principiantes
1. Lee **Parte 1: Fundamentos** para entender los conceptos básicos
2. Revisa la arquitectura y tipos de Flows
3. Prueba el Quick Start con un Flow Navigate simple
4. Revisa **Parte 3: Templates** para ver ejemplos completos

### Para Desarrolladores Intermedios
1. Estudia **Parte 2: Implementación Técnica** para entender el código
2. Analiza el ciclo de vida completo de un Flow
3. Implementa un template personalizado
4. Revisa **Parte 4: Seguridad** para mejores prácticas

### Para Desarrolladores Avanzados
1. Analiza la integración con el sistema AI
2. Implementa Data Exchange Flows complejos
3. Optimiza el rendimiento del endpoint
4. Contribuye con nuevos templates o mejoras

---

## 🤝 Contribuir

Si encuentras errores, tienes sugerencias o quieres agregar ejemplos:

1. Actualiza la documentación correspondiente
2. Añade ejemplos de código si es relevante
3. Actualiza este README si cambias la estructura
4. Documenta decisiones importantes en `.claude/memory/decisions.md`

---

## 📝 Changelog

### 2025-10-06 - Documentación Inicial
- ✅ Creada estructura modular de 4 partes
- ✅ Documentados 3 templates predefinidos
- ✅ Incluida guía de seguridad HMAC
- ✅ Agregados diagramas de arquitectura
- ✅ Ejemplos de código completos

---

**Siguiente paso:** [Parte 1: Fundamentos de WhatsApp Flows →](./01-fundamentos.md)
