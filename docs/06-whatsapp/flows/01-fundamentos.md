# Parte 1: Fundamentos de WhatsApp Flows

**[← Volver al Índice](./README.md)** | **[Siguiente: Implementación Técnica →](./02-implementacion-tecnica.md)**

---

## Tabla de Contenidos

1. [¿Qué son los WhatsApp Flows?](#qué-son-los-whatsapp-flows)
2. [Ventajas sobre Mensajes Tradicionales](#ventajas-sobre-mensajes-tradicionales)
3. [Casos de Uso Principales](#casos-de-uso-principales)
4. [Arquitectura en migue.ai](#arquitectura-en-migueai)
5. [Tipos de Flows](#tipos-de-flows)
6. [Componentes del Sistema](#componentes-del-sistema)
7. [Flujo de Datos Completo](#flujo-de-datos-completo)

---

## ¿Qué son los WhatsApp Flows?

WhatsApp Flows son **experiencias interactivas ricas** que permiten crear interfaces tipo formulario dentro de la conversación de WhatsApp, sin que el usuario necesite salir del chat.

### Características Principales

- **Interfaces Estructuradas:** Formularios multipantalla con validación
- **Componentes Ricos:** Text inputs, dropdowns, date pickers, checkboxes, radio buttons
- **Navegación Guiada:** Flujos multi-paso con lógica condicional
- **Validación en Tiempo Real:** Frontend y backend validation
- **Datos Estructurados:** Respuestas en formato JSON bien definido
- **Experiencia Nativa:** Todo sucede dentro de WhatsApp, sin abrir browser

### Ejemplo Visual

```
Usuario en WhatsApp:
┌─────────────────────────────────────┐
│ Miguel AI                      [⚙] │
├─────────────────────────────────────┤
│                                     │
│ 🤖 Hola Juan, ¿te gustaría         │
│    agendar una cita?                │
│                                     │
│    [Agendar Cita]  ← Botón Flow    │
│                          11:30 AM   │
└─────────────────────────────────────┘

Usuario toca el botón → Se abre el Flow:
┌─────────────────────────────────────┐
│ ← Reserva de Cita            [✕]   │
├─────────────────────────────────────┤
│                                     │
│ Selecciona el Servicio              │
│ ┌─────────────────────────────────┐ │
│ │ Consulta General          [▼] │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Selecciona la Fecha                 │
│ ┌─────────────────────────────────┐ │
│ │ 📅 15 de Octubre, 2025        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Horario Disponible                  │
│ ○ 9:00 AM                          │
│ ○ 10:00 AM                         │
│ ● 11:00 AM  ← Seleccionado         │
│ ○ 2:00 PM                          │
│                                     │
│           [Confirmar]               │
└─────────────────────────────────────┘

Después de confirmar:
┌─────────────────────────────────────┐
│ Miguel AI                      [⚙] │
├─────────────────────────────────────┤
│                                     │
│ ✅ Cita confirmada para:            │
│    15 Oct 2025 a las 11:00 AM      │
│                                     │
│    Te envié un recordatorio por     │
│    email. ¿Necesitas algo más?      │
│                          11:31 AM   │
└─────────────────────────────────────┘
```

---

## Ventajas sobre Mensajes Tradicionales

### Comparación: Botones vs Flows

#### Con Botones Tradicionales (Interactivos)

```
Bot: ¿Qué servicio necesitas?
     [Consulta] [Tratamiento] [Emergencia]

Usuario: *toca Consulta*

Bot: ¿Qué día prefieres?
     [Lunes] [Martes] [Miércoles]

Usuario: *toca Martes*

Bot: ¿Qué horario?
     [9 AM] [10 AM] [11 AM] [2 PM]

Usuario: *toca 11 AM*

Bot: ¿Tu nombre completo?

Usuario: Juan Pérez

Bot: ¿Tu email?

Usuario: juan@example.com

Bot: ✅ Cita confirmada
```

**Problemas:**
- ❌ Muchos mensajes en el chat (contamina el historial)
- ❌ Usuario puede escribir texto libre en cualquier momento
- ❌ Difícil validar formato (emails, teléfonos, etc.)
- ❌ No hay vista de resumen antes de confirmar
- ❌ Imposible volver atrás para corregir datos

#### Con Flows

```
Bot: ¿Te gustaría agendar una cita?
     [Agendar Cita]  ← Abre Flow

*Flow se abre en pantalla completa*
- Usuario ve TODAS las opciones en una interfaz clara
- Puede navegar adelante/atrás
- Validación instantánea de campos
- Vista de resumen antes de confirmar
- UN SOLO mensaje final en el chat

Bot: ✅ Cita confirmada para Juan Pérez
     15 Oct 2025, 11:00 AM
```

**Ventajas:**
- ✅ Chat limpio (solo 2 mensajes)
- ✅ Datos estructurados y validados
- ✅ Mejor UX (interfaz nativa de WhatsApp)
- ✅ Usuario puede corregir errores antes de enviar
- ✅ Menos fricción, mayor conversión

### Tabla Comparativa

| Característica | Botones Interactivos | WhatsApp Flows |
|----------------|----------------------|----------------|
| **Mensajes en chat** | 10-15 por formulario | 2-3 totalmente |
| **Validación** | Solo backend | Frontend + backend |
| **Experiencia** | Fragmentada | Cohesiva |
| **Corrección de errores** | Difícil | Fácil (antes de enviar) |
| **Campos complejos** | Limitado | Completo (dates, dropdowns) |
| **Vista de resumen** | ❌ No | ✅ Sí |
| **Navegación** | Lineal | Libre (adelante/atrás) |
| **Datos recolectados** | Texto libre | Estructurados |
| **Tasa de completación** | 40-60% | 70-90% |

---

## Casos de Uso Principales

### 1. 📝 Lead Generation (Captura de Contactos)

**Escenario:** Recolectar información de clientes potenciales

**Datos típicos:**
- Nombre completo
- Email
- Teléfono
- Empresa
- Mensaje o consulta
- Consentimiento de contacto

**Ventajas:**
- Datos válidos (email con formato correcto)
- Consentimiento explícito documentado
- Segmentación por interés
- Integración directa con CRM

```typescript
// Ejemplo de uso
await sendFlow(
  userPhone,
  FLOW_TEMPLATES.LEAD_GENERATION.id,
  'Comenzar',
  '¿Interesado en nuestros servicios? Cuéntanos más sobre ti.'
);
```

### 2. 📅 Appointment Booking (Reserva de Citas)

**Escenario:** Agendar servicios con disponibilidad en tiempo real

**Datos típicos:**
- Tipo de servicio
- Fecha preferida
- Horario disponible
- Información de contacto
- Notas especiales

**Ventajas:**
- Verifica disponibilidad en tiempo real (Google Calendar)
- Evita doble reserva
- Confirmación instantánea
- Recordatorios automáticos

```typescript
await sendFlow(
  userPhone,
  FLOW_TEMPLATES.APPOINTMENT_BOOKING.id,
  'Agendar',
  'Selecciona el mejor momento para tu cita',
  {
    flowType: 'data_exchange',  // Necesita verificar disponibilidad
    initialData: { userName: 'Juan' }
  }
);
```

### 3. ⭐ Feedback Collection (Encuestas de Satisfacción)

**Escenario:** Recolectar feedback post-servicio

**Datos típicos:**
- Rating de satisfacción (1-5 estrellas)
- Aspectos específicos (velocidad, calidad, atención)
- Comentarios adicionales
- Recomendaría el servicio (Sí/No)

**Ventajas:**
- Mayor tasa de respuesta (70-90% vs 10-20% de email)
- Feedback estructurado y cuantificable
- Recolección inmediata post-servicio
- Analytics en tiempo real

```typescript
await sendFlow(
  userPhone,
  FLOW_TEMPLATES.FEEDBACK_COLLECTION.id,
  'Dar Feedback',
  '¿Cómo fue tu experiencia? Tu opinión nos importa.'
);
```

### 4. 🔐 Authentication & Verification (Autenticación)

**Escenario:** Verificar identidad con OTP

**Flujo:**
1. Usuario ingresa número de teléfono
2. Sistema envía código OTP
3. Usuario ingresa código en el Flow
4. Backend valida en tiempo real
5. Sesión autenticada

**Ventajas:**
- Verificación en 2 pasos
- Sin salir de WhatsApp
- Validación instantánea
- Sesión segura

### 5. 🛍️ Order Placement (Pedidos)

**Escenario:** Realizar pedidos con verificación de inventario

**Datos típicos:**
- Selección de productos (dropdown dinámico)
- Cantidad
- Método de pago
- Dirección de entrega
- Notas especiales

**Ventajas:**
- Verifica stock en tiempo real
- Cálculo de precio dinámico
- Previene pedidos de productos agotados
- Confirmación inmediata

### 6. 👥 Onboarding (Configuración Inicial)

**Escenario:** Configurar cuenta de nuevo usuario

**Datos típicos:**
- Información personal
- Preferencias de comunicación
- Intereses/categorías
- Configuración de notificaciones

**Ventajas:**
- Proceso guiado paso a paso
- Recolección completa de datos desde el inicio
- Personalización inmediata
- Mayor retención de usuarios

---

## Arquitectura en migue.ai

### Vista General del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHATSAPP USER (Cliente)                      │
│                     - Recibe Flow                               │
│                     - Completa formulario                       │
│                     - Envía datos                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ↓ API Request
┌─────────────────────────────────────────────────────────────────┐
│              WHATSAPP CLOUD API (v23.0)                         │
│              - Envía Flow al usuario                            │
│              - Recibe respuesta completada                      │
│              - Envía webhook a nuestro servidor                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┴──────────────────┐
          │                                   │
          ↓ Navigate Flow                     ↓ Data Exchange Flow
          (Autocontenido)                     (Backend integration)
          │                                   │
┌─────────┴──────────┐           ┌───────────┴──────────────────┐
│  Webhook Handler   │           │   Flow Endpoint (Edge)        │
│  route.ts          │           │   /api/whatsapp/flows         │
│                    │           │                               │
│  - Recibe mensaje  │           │   - Valida HMAC signature     │
│  - type: nfm_reply │           │   - Decripta request          │
│  - Extrae datos    │◄──────────┤   - Consulta backend          │
│  - Procesa con AI  │           │   - Retorna datos dinámicos   │
└─────────┬──────────┘           │   - Encripta response         │
          │                      └───────────┬──────────────────┘
          │                                  │
          └──────────────┬───────────────────┘
                         ↓
           ┌─────────────────────────────────────┐
           │   lib/whatsapp-flows.ts             │
           │   (Lógica Principal)                │
           │                                     │
           │   sendFlow()                        │
           │   - Genera token único              │
           │   - Crea sesión en DB               │
           │   - Envía Flow via API              │
           │                                     │
           │   handleFlowDataExchange()          │
           │   - Valida token                    │
           │   - Procesa según screen            │
           │   - Actualiza sesión                │
           │   - Retorna siguiente screen        │
           │                                     │
           │   validateFlowSignature()           │
           │   - HMAC-SHA256 validation          │
           │   - Constant-time comparison        │
           │                                     │
           │   completeFlowSession()             │
           │   - Marca sesión como completada    │
           │   - Guarda timestamp                │
           └─────────────┬───────────────────────┘
                         ↓
           ┌─────────────────────────────────────┐
           │   SUPABASE (PostgreSQL)             │
           │                                     │
           │   flow_sessions                     │
           │   - id, user_id, flow_id            │
           │   - flow_token (unique)             │
           │   - flow_type                       │
           │   - session_data (jsonb)            │
           │   - response_data (jsonb)           │
           │   - status (enum)                   │
           │   - created_at, expires_at          │
           │                                     │
           │   RLS Policies                      │
           │   Triggers (updated_at)             │
           │   Auto-expiration (24h)             │
           └─────────────────────────────────────┘
```

### Componentes Clave

#### 1. Frontend (Lado del Cliente)
- **WhatsApp App:** Interfaz nativa del usuario
- **Flow JSON:** Define estructura de pantallas y componentes

#### 2. WhatsApp Cloud API
- **Flow Sender:** Envía Flows a usuarios
- **Webhook System:** Notifica completaciones
- **Data Exchange:** Comunicación en tiempo real

#### 3. Backend (migue.ai en Vercel Edge)
- **lib/whatsapp-flows.ts:** Lógica core
- **app/api/whatsapp/flows/route.ts:** Endpoint Edge
- **app/api/whatsapp/webhook/route.ts:** Receptor de webhooks

#### 4. Persistencia (Supabase)
- **flow_sessions:** Tabla principal
- **users:** Relación con usuarios
- **conversations:** Contexto de conversación

#### 5. Integraciones
- **AI Agents:** Claude, Groq para procesamiento
- **Google Calendar:** Verificación de disponibilidad
- **Email/SMS:** Notificaciones y confirmaciones

---

## Tipos de Flows

WhatsApp ofrece dos tipos principales de Flows, cada uno con un propósito específico.

### Navigate Flows (Autocontenidos)

**Definición:** Flows con todas las pantallas predefinidas en el JSON. No requieren comunicación con el backend durante la interacción.

#### Características

- ✅ Todas las pantallas definidas estáticamente
- ✅ Navegación predefinida entre screens
- ✅ Datos estáticos (no cambian según contexto)
- ✅ No requiere endpoint de data exchange
- ✅ Más rápido (sin latencia de red)
- ✅ Funciona offline (relativo)

#### Cuándo Usar Navigate Flows

1. **Formularios de Contacto**
   - Campos fijos (nombre, email, teléfono, mensaje)
   - No requiere validación externa
   - Datos se procesan al final

2. **Encuestas Estáticas**
   - Preguntas predefinidas
   - Opciones fijas
   - Rating y feedback

3. **Registro de Usuario**
   - Datos personales básicos
   - Preferencias de comunicación
   - Términos y condiciones

4. **Recolección de Información**
   - Cualquier formulario con campos conocidos
   - Sin dependencias externas

#### Ejemplo Navigate Flow

```json
{
  "version": "5.0",
  "screens": [
    {
      "id": "CONTACT_FORM",
      "title": "Información de Contacto",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "full_name",
            "label": "Nombre Completo",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "email",
            "label": "Email",
            "input-type": "email",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Enviar",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### Data Exchange Flows (Dinámicos)

**Definición:** Flows que se comunican con tu backend durante la interacción para obtener datos dinámicos, validar en tiempo real, o determinar el siguiente paso.

#### Características

- ✅ Comunicación en tiempo real con backend
- ✅ Datos dinámicos según contexto
- ✅ Validación en tiempo real
- ✅ Navegación condicional
- ✅ Contenido personalizado por usuario
- ❌ Requiere endpoint de data exchange
- ❌ Latencia de red (pequeña)

#### Cuándo Usar Data Exchange Flows

1. **Reservas con Disponibilidad**
   - Verificar slots disponibles en tiempo real
   - Calendario actualizado
   - Evitar doble reserva

2. **Autenticación con OTP**
   - Generar y validar códigos
   - Verificación en tiempo real
   - Seguridad adicional

3. **Pedidos con Inventario**
   - Verificar stock disponible
   - Cálculo de precios dinámico
   - Validación de cupones

4. **Formularios con Validación Externa**
   - Verificar datos contra base de datos
   - Validar números de documento
   - Consultar APIs externas

5. **Experiencias Personalizadas**
   - Contenido basado en perfil del usuario
   - Recomendaciones personalizadas
   - Flujos adaptativos

#### Ejemplo Data Exchange Flow

```json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://migue.app/api/whatsapp/flows",
  "screens": [
    {
      "id": "SELECT_DATE",
      "title": "Selecciona Fecha",
      "data": {
        "available_dates": {
          "type": "array",
          "__example__": ["2025-10-15", "2025-10-16"]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "DatePicker",
            "name": "date",
            "label": "Fecha de Cita",
            "available-dates": "${data.available_dates}"
          },
          {
            "type": "Footer",
            "label": "Siguiente",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "selected_date": "${form.date}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

#### Flujo de Data Exchange

```
Usuario selecciona fecha
         ↓
Flow envía request a tu endpoint
         ↓
POST /api/whatsapp/flows
{
  "version": "3.0",
  "screen": "SELECT_DATE",
  "data": {
    "selected_date": "2025-10-15"
  },
  "flow_token": "abc123..."
}
         ↓
Tu backend:
1. Valida firma HMAC
2. Consulta disponibilidad en DB/Calendar
3. Retorna horarios disponibles
         ↓
Response
{
  "version": "3.0",
  "screen": "SELECT_TIME",
  "data": {
    "available_times": [
      {"id": "09:00", "title": "9:00 AM"},
      {"id": "10:00", "title": "10:00 AM"}
    ]
  }
}
         ↓
Flow muestra siguiente pantalla con datos
```

### Matriz de Decisión: ¿Qué Tipo Usar?

| Pregunta | Navigate | Data Exchange |
|----------|----------|---------------|
| ¿Los datos son fijos? | ✅ Sí | ❌ No |
| ¿Necesitas validar contra DB externa? | ❌ No | ✅ Sí |
| ¿El contenido cambia según usuario? | ❌ No | ✅ Sí |
| ¿Requieres verificación en tiempo real? | ❌ No | ✅ Sí |
| ¿Quieres la experiencia más rápida? | ✅ Sí | ⚠️ Casi igual |
| ¿Necesitas navegación condicional? | ❌ No | ✅ Sí |
| ¿Simplicidad es prioridad? | ✅ Sí | ❌ Más complejo |

### Ejemplos Prácticos de Decisión

#### Ejemplo 1: Formulario de Newsletter

**Necesitas recolectar:**
- Nombre
- Email
- Categorías de interés (3 opciones fijas)

**Decisión:** Navigate Flow ✅
**Razón:** Datos estáticos, no requiere validación externa

#### Ejemplo 2: Reserva de Servicios

**Necesitas:**
- Seleccionar servicio
- Ver disponibilidad en tiempo real
- Elegir horario disponible
- Confirmar con el calendar

**Decisión:** Data Exchange Flow ✅
**Razón:** Requiere consultar disponibilidad en tiempo real

#### Ejemplo 3: Encuesta de Satisfacción

**Necesitas recolectar:**
- Rating 1-5
- Comentarios
- ¿Recomendarías? (Sí/No)

**Decisión:** Navigate Flow ✅
**Razón:** Preguntas fijas, no necesita backend durante Flow

#### Ejemplo 4: Login con OTP

**Necesitas:**
- Ingresar número de teléfono
- Generar código OTP
- Validar código en tiempo real
- Crear sesión

**Decisión:** Data Exchange Flow ✅
**Razón:** Generación y validación en tiempo real es crítica

---

## Componentes del Sistema

### 1. lib/whatsapp-flows.ts

**Propósito:** Lógica core de WhatsApp Flows

**Funciones Principales:**

```typescript
// Generar token seguro con Web Crypto API
function generateFlowToken(): string

// Validar firma HMAC-SHA256 de WhatsApp
async function validateFlowSignature(
  req: Request,
  rawBody: string
): Promise<boolean>

// Enviar Flow a un usuario
async function sendFlow(
  to: string,
  flowId: string,
  flowCta: string,
  bodyText: string,
  options?: {
    flowType?: 'navigate' | 'data_exchange';
    initialScreen?: string;
    initialData?: Record<string, unknown>;
  }
): Promise<string | null>

// Manejar data exchange request
async function handleFlowDataExchange(
  request: FlowDataExchangeRequest
): Promise<FlowDataExchangeResponse | null>

// Completar sesión de Flow
async function completeFlowSession(
  flowToken: string
): Promise<void>
```

**Ubicación:** `lib/whatsapp-flows.ts` (467 líneas)

### 2. app/api/whatsapp/flows/route.ts

**Propósito:** Endpoint Edge Runtime para data exchange

**Método:** POST

**Flujo:**
1. Recibe request de WhatsApp
2. Valida firma HMAC
3. Procesa según `action` y `screen`
4. Consulta backend si es necesario
5. Retorna response con datos dinámicos
6. Auto-completa sesión en screens finales

**Características:**
- ✅ Edge Runtime compatible
- ✅ Validación de seguridad
- ✅ Manejo de errores robusto

**Ubicación:** `app/api/whatsapp/flows/route.ts` (75 líneas)

### 3. Tabla flow_sessions

**Propósito:** Persistencia de sesiones de Flows

**Schema:**

```sql
create table flow_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  conversation_id uuid references conversations(id),
  flow_id text not null,
  flow_token text not null unique,
  flow_type text not null check (flow_type in ('navigate', 'data_exchange')),
  session_data jsonb default '{}'::jsonb,
  response_data jsonb,
  status flow_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours')
);
```

**Estados de Sesión:**
- `pending`: Flow enviado, esperando interacción
- `in_progress`: Usuario interactuando con el Flow
- `completed`: Flow completado exitosamente
- `expired`: Sesión expirada (24h sin completar)
- `failed`: Error durante el procesamiento

**Índices:**
- `idx_flow_sessions_user` - Búsqueda por usuario
- `idx_flow_sessions_token` - Validación de tokens
- `idx_flow_sessions_status` - Filtrado por estado
- `idx_flow_sessions_expires` - Limpieza de expirados

### 4. TypeScript Types

**Ubicación:** `types/whatsapp.ts` (líneas 161-218)

```typescript
// Payload para enviar Flow
interface FlowMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'flow';
    body: { text: string };
    action: {
      name: 'flow';
      parameters: {
        flow_message_version: '3';
        flow_token: string;
        flow_id: string;
        flow_cta: string;
        flow_action: 'navigate' | 'data_exchange';
      };
    };
  };
}

// Request de data exchange
interface FlowDataExchangeRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen: string;
  data: Record<string, unknown>;
  flow_token: string;
}

// Response de data exchange
interface FlowDataExchangeResponse {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}
```

### 5. Templates Predefinidos

**Ubicación:** `lib/whatsapp-flows.ts` (líneas 445-467)

```typescript
export const FLOW_TEMPLATES = {
  LEAD_GENERATION: {
    id: 'lead_generation_flow',
    name: 'Lead Generation',
    description: 'Collect contact information from potential customers',
    cta: 'Get Started',
    bodyText: 'Please provide your contact information',
  },
  APPOINTMENT_BOOKING: {
    id: 'appointment_booking_flow',
    name: 'Appointment Booking',
    description: 'Schedule appointments with customers',
    cta: 'Book Appointment',
    bodyText: 'Schedule your appointment',
  },
  FEEDBACK_COLLECTION: {
    id: 'feedback_flow',
    name: 'Feedback Collection',
    description: 'Collect customer feedback and ratings',
    cta: 'Give Feedback',
    bodyText: 'We value your feedback',
  },
};
```

---

## Flujo de Datos Completo

### Navigate Flow: De Principio a Fin

```
PASO 1: Envío del Flow
═══════════════════════════════════════

Backend (lib/whatsapp-flows.ts)
  ↓
  sendFlow(phone, flowId, cta, bodyText)
  ↓
  1. Genera token único: generateFlowToken()
  2. Crea registro en flow_sessions:
     - status: 'pending'
     - flow_type: 'navigate'
     - flow_token: 'abc123...'
  3. Envía a WhatsApp API:
     POST /v23.0/{phone_id}/messages

WhatsApp Cloud API
  ↓
  Envía Flow al usuario


PASO 2: Usuario Completa el Flow
═══════════════════════════════════════

Usuario en WhatsApp
  ↓
  1. Toca botón "Get Started"
  2. Flow se abre en pantalla completa
  3. Completa formulario:
     - Nombre: "Juan Pérez"
     - Email: "juan@example.com"
     - Teléfono: "+5491112345678"
     - Mensaje: "Necesito información..."
  4. Presiona "Enviar"

WhatsApp valida frontend
  ↓
  - Email con formato correcto ✅
  - Campos requeridos completos ✅
  ↓
  Envía webhook a nuestro servidor


PASO 3: Webhook Recibe Completación
═══════════════════════════════════════

POST /api/whatsapp/webhook

{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5491112345678",
          "type": "interactive",
          "interactive": {
            "type": "nfm_reply",
            "nfm_reply": {
              "response_json": "abc123...",  // flow_token
              "body": "{\"full_name\":\"Juan Pérez\",\"email\":\"juan@example.com\",...}"
            }
          }
        }]
      }
    }]
  }]
}

Backend (webhook handler)
  ↓
  1. Extrae flow_token
  2. Parsea response_data (JSON)
  3. Busca sesión en flow_sessions por token
  4. Actualiza:
     - response_data = datos del usuario
     - status = 'completed'
     - completed_at = now()
  5. Procesa con AI Agent:
     - Crea lead en base de datos
     - Envía notificación al equipo
     - Responde al usuario


PASO 4: Confirmación al Usuario
═══════════════════════════════════════

Backend envía mensaje confirmación
  ↓
  sendWhatsAppText(
    userPhone,
    "✅ Gracias Juan! Recibimos tu información. Te contactaremos pronto."
  )
  ↓
WhatsApp Cloud API
  ↓
Usuario recibe confirmación
```

### Data Exchange Flow: De Principio a Fin

```
PASO 1: Envío del Flow
═══════════════════════════════════════

Backend
  ↓
  sendFlow(phone, flowId, cta, bodyText, {
    flowType: 'data_exchange',
    initialScreen: 'SELECT_SERVICE'
  })
  ↓
  Crea sesión en DB (status: 'pending')
  ↓
WhatsApp envía Flow al usuario


PASO 2: Usuario Abre el Flow
═══════════════════════════════════════

WhatsApp envía INIT request
  ↓
POST /api/whatsapp/flows
{
  "action": "INIT",
  "screen": "SELECT_SERVICE",
  "flow_token": "abc123...",
  "version": "3.0"
}
  ↓
Backend (handleFlowDataExchange)
  ↓
  1. Valida token
  2. Actualiza status: 'in_progress'
  3. Consulta servicios disponibles en DB
  4. Retorna:
     {
       "screen": "SELECT_SERVICE",
       "data": {
         "services": [
           {"id": "1", "title": "Consulta - $50"},
           {"id": "2", "title": "Tratamiento - $100"}
         ]
       }
     }
  ↓
Flow muestra dropdown con servicios


PASO 3: Usuario Selecciona Servicio
═══════════════════════════════════════

Usuario elige "Consulta"
Presiona "Siguiente"
  ↓
WhatsApp envía data_exchange request
  ↓
POST /api/whatsapp/flows
{
  "action": "data_exchange",
  "screen": "SELECT_SERVICE",
  "data": {
    "selected_service": "1"
  },
  "flow_token": "abc123..."
}
  ↓
Backend
  ↓
  1. Valida token
  2. Guarda en session_data: {"selected_service": "1"}
  3. Consulta fechas disponibles en Google Calendar
  4. Retorna:
     {
       "screen": "SELECT_DATE",
       "data": {
         "available_dates": ["2025-10-15", "2025-10-16"],
         "service_name": "Consulta"
       }
     }
  ↓
Flow muestra DatePicker con fechas disponibles


PASO 4: Usuario Selecciona Fecha y Hora
═══════════════════════════════════════

Usuario elige fecha y hora
Presiona "Confirmar"
  ↓
WhatsApp envía completación
  ↓
POST /api/whatsapp/flows
{
  "action": "data_exchange",
  "screen": "SELECT_TIME",
  "data": {
    "selected_date": "2025-10-15",
    "selected_time": "10:00"
  },
  "flow_token": "abc123..."
}
  ↓
Backend
  ↓
  1. Valida disponibilidad final
  2. Crea evento en Google Calendar
  3. Actualiza flow_session:
     - response_data = datos completos
     - status = 'completed'
  4. Retorna screen de confirmación:
     {
       "screen": "CONFIRMATION",
       "data": {
         "message": "✅ Cita confirmada",
         "appointment_id": "APT-12345"
       }
     }


PASO 5: Webhook de Completación
═══════════════════════════════════════

WhatsApp envía webhook
  ↓
POST /api/whatsapp/webhook
{
  "messages": [{
    "type": "interactive",
    "interactive": {
      "type": "nfm_reply",
      "nfm_reply": {
        "response_json": "abc123...",
        "body": "{...datos completos...}"
      }
    }
  }]
}
  ↓
Backend
  ↓
  1. Procesa cita confirmada
  2. Envía email de confirmación
  3. Programa reminder en cron
  4. Responde al usuario en WhatsApp
```

---

## Resumen

### Key Takeaways

1. **WhatsApp Flows** son interfaces ricas para recolectar datos estructurados sin salir de WhatsApp

2. **Dos tipos:**
   - **Navigate:** Autocontenidos, rápidos, datos estáticos
   - **Data Exchange:** Dinámicos, validación en tiempo real, personalización

3. **Ventajas clave:**
   - Mejor UX que botones tradicionales
   - Mayor tasa de completación (70-90% vs 40-60%)
   - Datos validados y estructurados
   - Chat limpio (2-3 mensajes vs 10-15)

4. **Arquitectura en migue.ai:**
   - `lib/whatsapp-flows.ts`: Lógica core
   - `app/api/whatsapp/flows/route.ts`: Endpoint Edge
   - `flow_sessions`: Persistencia en Supabase
   - Edge Runtime compatible

5. **Casos de uso principales:**
   - Lead generation
   - Appointment booking
   - Feedback collection
   - Authentication
   - Order placement

### Próximos Pasos

- **[Parte 2: Implementación Técnica →](./02-implementacion-tecnica.md)** - Análisis detallado del código y ciclo de vida completo

---

**[← Volver al Índice](./README.md)** | **[Siguiente: Implementación Técnica →](./02-implementacion-tecnica.md)**
