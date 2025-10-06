# Parte 2: Implementación Técnica

**[← Parte 1: Fundamentos](./01-fundamentos.md)** | **[Volver al Índice](./README.md)** | **[Siguiente: Templates →](./03-templates-casos-uso.md)**

---

## Tabla de Contenidos

1. [Estructura de Archivos](#estructura-de-archivos)
2. [lib/whatsapp-flows.ts - Análisis Detallado](#libwhatsapp-flowsts---análisis-detallado)
3. [Endpoint API - route.ts](#endpoint-api---routets)
4. [Base de Datos - flow_sessions](#base-de-datos---flow_sessions)
5. [TypeScript Types](#typescript-types)
6. [Ciclo de Vida Técnico](#ciclo-de-vida-técnico)
7. [Integración con WhatsApp API](#integración-con-whatsapp-api)
8. [Manejo de Estados](#manejo-de-estados)

---

## Estructura de Archivos

```
migue.ai/
├── lib/
│   └── whatsapp-flows.ts          # 467 líneas - Lógica core
├── app/
│   └── api/
│       └── whatsapp/
│           ├── webhook/
│           │   └── route.ts        # Recibe flow completions
│           └── flows/
│               └── route.ts        # 75 líneas - Data exchange endpoint
├── types/
│   └── whatsapp.ts                 # TypeScript definitions (161-218)
└── supabase/
    └── schema.sql                  # Database schema (374-427)
```

### Responsabilidades por Archivo

| Archivo | Responsabilidad | LOC |
|---------|----------------|-----|
| `lib/whatsapp-flows.ts` | Lógica de negocio, validación, templates | 467 |
| `app/api/whatsapp/flows/route.ts` | Endpoint Edge para data exchange | 75 |
| `app/api/whatsapp/webhook/route.ts` | Receptor de flow completions | ~200 |
| `types/whatsapp.ts` | Definiciones TypeScript | 58 |
| `supabase/schema.sql` | Schema de flow_sessions | 54 |

---

## lib/whatsapp-flows.ts - Análisis Detallado

### Imports y Dependencias

```typescript
/**
 * WhatsApp Flows - v23.0 Implementation
 * Handles interactive flow messages and data exchange
 *
 * ✅ Edge Runtime Compatible - Uses Web Crypto API
 * @vercel-force-rebuild 2025-10-05
 */

import { sendWhatsAppRequest } from './whatsapp';
import { getSupabaseServerClient } from './supabase';
import type {
  FlowMessagePayload,
  FlowDataExchangeRequest,
  FlowDataExchangeResponse,
  FlowSessionStatus,
} from '../types/whatsapp';
```

**Dependencias Clave:**
- `sendWhatsAppRequest`: Envío genérico de mensajes a WhatsApp API
- `getSupabaseServerClient`: Cliente Supabase server-side
- Types: Tipos TypeScript para validación estricta

### 1. generateFlowToken() - Generación de Tokens

```typescript
/**
 * Generate a secure flow token using Web Crypto API (Edge Runtime compatible)
 */
export function generateFlowToken(): string {
  // Use Web Crypto API available in Edge Runtime
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
```

**Análisis Línea por Línea:**

```typescript
const array = new Uint8Array(32);
```
- Crea un array de 32 bytes (256 bits)
- Uint8Array: cada elemento es un número 0-255
- 32 bytes = 64 caracteres hexadecimales
- Suficiente entropía para prevenir colisiones

```typescript
crypto.getRandomValues(array);
```
- `crypto` es el objeto global Web Crypto API
- Compatible con Edge Runtime (NO usa Node.js `crypto`)
- Genera números aleatorios criptográficamente seguros
- Llena el array con valores random

```typescript
return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
```
- `Array.from(array, mapper)`: Convierte Uint8Array a Array normal
- `byte.toString(16)`: Convierte número a hexadecimal
- `.padStart(2, '0')`: Asegura 2 dígitos (ej: 5 → "05")
- `.join('')`: Une todo en un string

**Ejemplo Output:**
```
"a3f2e1d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1"
```

**¿Por qué este método?**
- ✅ Edge Runtime compatible (Web Crypto API)
- ✅ Criptográficamente seguro
- ✅ No requiere imports externos
- ✅ Produce tokens únicos (probabilidad de colisión ≈ 0)

### 2. hex() - Conversión ArrayBuffer a Hex

```typescript
/**
 * Convert ArrayBuffer to hex string
 */
function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}
```

**Propósito:** Convierte resultado de HMAC (ArrayBuffer) a string hexadecimal

**¿Por qué `bytes[i]!`?**
- TypeScript strict mode con `noUncheckedIndexedAccess: true`
- `!` es non-null assertion (sabemos que el índice existe)
- Evita `bytes[i]` potencialmente undefined

### 3. hmacSha256Hex() - HMAC SHA-256

```typescript
/**
 * Generate HMAC-SHA256 hex signature (same as webhook validation)
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(sig);
}
```

**Análisis Detallado:**

```typescript
const key = await crypto.subtle.importKey(
  'raw',                              // Formato de la key
  new TextEncoder().encode(secret),   // Secret como Uint8Array
  { name: 'HMAC', hash: 'SHA-256' },  // Algoritmo
  false,                               // No exportable
  ['sign']                             // Uso: solo firmar
);
```

**Parámetros:**
1. `'raw'`: Key en formato raw bytes
2. `new TextEncoder().encode(secret)`: Convierte string a bytes UTF-8
3. `{ name: 'HMAC', hash: 'SHA-256' }`: Algoritmo HMAC con hash SHA-256
4. `false`: Key no exportable (seguridad)
5. `['sign']`: Solo para signing (no verificación)

```typescript
const sig = await crypto.subtle.sign(
  'HMAC',
  key,
  new TextEncoder().encode(message)
);
```

**Firma el mensaje:**
- Usa HMAC con la key importada
- Message se convierte a bytes
- Retorna ArrayBuffer con la firma

```typescript
return hex(sig);
```

**Convierte a hexadecimal** para comparación con header

### 4. validateFlowSignature() - Validación de Seguridad

```typescript
/**
 * Validate WhatsApp Flow signature
 * Uses the same HMAC-SHA256 validation as webhooks
 *
 * @param req - Request with x-hub-signature-256 header
 * @param rawBody - Raw request body as string
 * @returns true if signature is valid
 */
export async function validateFlowSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256');
  const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

  // Security: Fail closed in production if credentials missing
  if (!header || !WHATSAPP_APP_SECRET) {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProd) {
      console.error('❌ Missing WHATSAPP_APP_SECRET in production - blocking flow request');
      return false;
    }

    console.warn('⚠️  Development mode: Flow signature validation disabled');
    return true;
  }

  // Header format: sha256=abcdef...
  const parts = header.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('❌ Invalid flow signature header format');
    return false;
  }

  const provided = parts[1];
  if (!provided) {
    console.error('❌ Missing flow signature value');
    return false;
  }

  // Calculate expected signature
  const expected = await hmacSha256Hex(WHATSAPP_APP_SECRET, rawBody);

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length) {
    console.error('❌ Flow signature length mismatch');
    return false;
  }

  // XOR-based constant-time string comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  const isValid = diff === 0;

  if (!isValid) {
    console.error('❌ Flow signature validation failed');
  }

  return isValid;
}
```

**Análisis de Seguridad:**

#### Fail-Closed Strategy

```typescript
if (!header || !WHATSAPP_APP_SECRET) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (isProd) {
    console.error('❌ Missing WHATSAPP_APP_SECRET in production - blocking flow request');
    return false;  // ✅ Bloquea en producción
  }

  console.warn('⚠️  Development mode: Flow signature validation disabled');
  return true;  // ⚠️  Permite en desarrollo
}
```

**Lógica:**
- **Producción:** Sin secret → BLOQUEA (fail-closed)
- **Desarrollo:** Sin secret → PERMITE (facilita testing)
- **Razón:** Previene ataques en producción, pero permite desarrollo local

#### Header Validation

```typescript
const parts = header.split('=');
if (parts.length !== 2 || parts[0] !== 'sha256') {
  return false;
}
```

**Formato esperado:**
```
x-hub-signature-256: sha256=abc123def456...
```

**Validaciones:**
1. Header tiene exactamente 2 partes (algoritmo=signature)
2. Algoritmo es 'sha256'
3. Signature no está vacía

#### Constant-Time Comparison

```typescript
let diff = 0;
for (let i = 0; i < expected.length; i++) {
  diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
}
const isValid = diff === 0;
```

**¿Por qué constant-time?**

❌ **Comparación Normal (VULNERABLE):**
```typescript
if (provided === expected) {
  return true;
}
```
- Se detiene en el primer carácter diferente
- Atacante puede medir tiempo de respuesta
- **Timing attack:** Probar carácter por carácter

✅ **Comparación Constant-Time (SEGURA):**
```typescript
let diff = 0;
for (let i = 0; i < expected.length; i++) {
  diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
}
```

**Cómo funciona:**
1. `charCodeAt(i)`: Obtiene código ASCII del carácter
2. `^` (XOR): Compara bits - 0 si iguales, 1 si diferentes
3. `|=` (OR): Acumula diferencias
4. **Siempre** itera toda la longitud (constant-time)

**Ejemplo:**
```
expected: "abc"  → [97, 98, 99]
provided: "abd"  → [97, 98, 100]

Iteración 1: diff = 0 | (97 ^ 97) = 0 | 0 = 0
Iteración 2: diff = 0 | (98 ^ 98) = 0 | 0 = 0
Iteración 3: diff = 0 | (99 ^ 100) = 0 | 3 = 3

diff !== 0 → Invalid ✗
```

### 5. sendFlow() - Enviar Flow a Usuario

```typescript
/**
 * Send a WhatsApp Flow message
 * @param to - Phone number in WhatsApp format
 * @param flowId - Flow ID from Meta Business Manager
 * @param flowCta - Call to action text for the button
 * @param bodyText - Main message text
 * @param options - Optional header, footer, and flow configuration
 */
export async function sendFlow(
  to: string,
  flowId: string,
  flowCta: string,
  bodyText: string,
  options?: {
    header?: string;
    footer?: string;
    flowType?: 'navigate' | 'data_exchange';
    initialScreen?: string;
    initialData?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const flowToken = generateFlowToken();
    const flowType = options?.flowType || 'navigate';

    // Store flow session in database
    const supabase = getSupabaseServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', to)
      .single();

    if (user) {
      await supabase.from('flow_sessions').insert({
        user_id: user.id,
        flow_id: flowId,
        flow_token: flowToken,
        flow_type: flowType,
        status: 'pending' as const,
        session_data: (options?.initialData || {}) as any,
      });
    }

    const payload: FlowMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowToken,
            flow_id: flowId,
            flow_cta: flowCta,
            flow_action: flowType,
            ...(options?.initialScreen && {
              flow_action_payload: {
                screen: options.initialScreen,
                ...(options.initialData && { data: options.initialData }),
              },
            }),
          },
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header },
        }),
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
    };

    const result = await sendWhatsAppRequest(payload as any);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending flow:', error);
    return null;
  }
}
```

**Flujo Completo:**

#### 1. Generar Token Único
```typescript
const flowToken = generateFlowToken();
```
- Token de 64 caracteres hex
- Usado para validar posteriormente
- Asocia sesión con usuario

#### 2. Buscar Usuario en DB
```typescript
const { data: user } = await supabase
  .from('users')
  .select('id')
  .eq('phone_number', to)
  .single();
```

**Query SQL equivalente:**
```sql
SELECT id FROM users WHERE phone_number = $1 LIMIT 1;
```

**¿Por qué necesitamos user_id?**
- Asociar flow session con usuario
- Auditoría y analytics
- Datos históricos

#### 3. Crear Flow Session
```typescript
if (user) {
  await supabase.from('flow_sessions').insert({
    user_id: user.id,
    flow_id: flowId,
    flow_token: flowToken,
    flow_type: flowType,
    status: 'pending' as const,
    session_data: (options?.initialData || {}) as any,
  });
}
```

**Registro creado:**
```json
{
  "id": "uuid-generado",
  "user_id": "user-uuid",
  "flow_id": "lead_generation_flow",
  "flow_token": "a3f2e1d9...",
  "flow_type": "navigate",
  "status": "pending",
  "session_data": {},
  "created_at": "2025-10-06T10:00:00Z",
  "expires_at": "2025-10-07T10:00:00Z"
}
```

#### 4. Construir Payload
```typescript
const payload: FlowMessagePayload = {
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to,
  type: 'interactive',
  interactive: {
    type: 'flow',
    body: { text: bodyText },
    action: {
      name: 'flow',
      parameters: {
        flow_message_version: '3',
        flow_token: flowToken,
        flow_id: flowId,
        flow_cta: flowCta,
        flow_action: flowType,
      },
    },
  },
};
```

**Campos Críticos:**
- `flow_message_version: '3'`: API version actual
- `flow_token`: Token único para esta sesión
- `flow_id`: ID del Flow en Meta Business Manager
- `flow_cta`: Texto del botón (ej: "Get Started")
- `flow_action`: 'navigate' o 'data_exchange'

#### 5. Conditional Flow Action Payload
```typescript
...(options?.initialScreen && {
  flow_action_payload: {
    screen: options.initialScreen,
    ...(options.initialData && { data: options.initialData }),
  },
}),
```

**¿Qué hace `...(...&& { }))`?**

**Ejemplo sin initial data:**
```typescript
// options = undefined
// Resultado: No se agrega flow_action_payload
```

**Ejemplo con initial data:**
```typescript
// options = { initialScreen: 'HOME', initialData: { name: 'Juan' } }
// Resultado:
{
  flow_action_payload: {
    screen: 'HOME',
    data: { name: 'Juan' }
  }
}
```

**Spread operator (`...`):**
- Si condición es false → spread undefined → nada se agrega
- Si condición es true → spread object → campos se agregan

#### 6. Enviar a WhatsApp API
```typescript
const result = await sendWhatsAppRequest(payload as any);
return result?.messages?.[0]?.id ?? null;
```

**Response esperado:**
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{"input": "5491112345678", "wa_id": "5491112345678"}],
  "messages": [{"id": "wamid.ABC123=="}]
}
```

**Retorno:**
- Éxito: `"wamid.ABC123=="` (message ID)
- Error: `null`

### 6. handleFlowDataExchange() - Procesamiento de Data Exchange

```typescript
/**
 * Handle data exchange request from WhatsApp Flow
 * @param request - Encrypted data exchange request
 * @returns Data exchange response or null on error
 */
export async function handleFlowDataExchange(
  request: FlowDataExchangeRequest
): Promise<FlowDataExchangeResponse | null> {
  try {
    const { flow_token, action, screen, data } = request;

    // Validate flow token
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from('flow_sessions')
      .select('*')
      .eq('flow_token', flow_token)
      .single();

    if (!session) {
      console.error('Invalid flow token');
      return null;
    }

    // Update session status
    await supabase
      .from('flow_sessions')
      .update({
        status: 'in_progress',
        session_data: { ...(session as any).session_data, ...data },
      })
      .eq('flow_token', flow_token);

    // Handle different actions
    switch (action) {
      case 'ping':
        return {
          version: '3.0',
          screen: 'SUCCESS',
          data: { status: 'pong' },
        };

      case 'INIT':
        return handleFlowInit(session, screen, data);

      case 'data_exchange':
        return handleDataExchange(session, screen, data);

      default:
        return null;
    }
  } catch (error) {
    console.error('Error handling flow data exchange:', error);
    return null;
  }
}
```

**Actions Soportados:**

1. **`ping`** - Health check
   - WhatsApp verifica que el endpoint funciona
   - Retorna simple pong

2. **`INIT`** - Inicialización
   - Primera carga del Flow
   - Retorna datos iniciales de la primera pantalla

3. **`data_exchange`** - Intercambio de datos
   - Usuario avanza entre pantallas
   - Backend provee datos dinámicos

**Flujo de Validación:**

```typescript
const { data: session } = await supabase
  .from('flow_sessions')
  .select('*')
  .eq('flow_token', flow_token)
  .single();

if (!session) {
  console.error('Invalid flow token');
  return null;
}
```

**¿Por qué validar token?**
- ✅ Prevenir spoofing
- ✅ Verificar que sesión existe
- ✅ Obtener contexto de la sesión

**Update Session:**
```typescript
await supabase
  .from('flow_sessions')
  .update({
    status: 'in_progress',
    session_data: { ...(session as any).session_data, ...data },
  })
  .eq('flow_token', flow_token);
```

**Cambios:**
- `status`: 'pending' → 'in_progress'
- `session_data`: Merge de datos existentes + nuevos datos
- `updated_at`: Trigger automático actualiza timestamp

### 7. handleFlowInit() - Inicialización de Flow

```typescript
/**
 * Handle flow initialization
 */
async function handleFlowInit(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  // Return initial screen data based on flow type
  switch (session.flow_id) {
    case 'lead_generation_flow':
      return {
        version: '3.0',
        screen: 'LEAD_FORM',
        data: {
          title: 'Contact Information',
          fields: ['name', 'email', 'phone', 'company'],
        },
      };

    case 'appointment_booking_flow':
      return {
        version: '3.0',
        screen: 'DATE_PICKER',
        data: {
          title: 'Select Appointment Date',
          available_dates: getAvailableDates(),
        },
      };

    case 'feedback_flow':
      return {
        version: '3.0',
        screen: 'RATING',
        data: {
          title: 'Rate Your Experience',
          max_rating: 5,
        },
      };

    default:
      return {
        version: '3.0',
        screen: 'DEFAULT',
        data: {},
      };
  }
}
```

**¿Cuándo se llama?**
- Usuario abre el Flow por primera vez
- WhatsApp envía action: 'INIT'
- Backend retorna datos para screen inicial

**Response Structure:**
```typescript
{
  version: '3.0',      // Data API version
  screen: 'SCREEN_ID', // Screen a mostrar
  data: { ... }        // Datos para popular el screen
}
```

### 8. handleDataExchange() - Navegación entre Screens

```typescript
/**
 * Handle data exchange between screens
 */
async function handleDataExchange(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  const supabase = getSupabaseServerClient();

  // Save screen data
  await supabase
    .from('flow_sessions')
    .update({
      session_data: { ...session.session_data, [screen]: data },
    })
    .eq('flow_token', session.flow_token);

  // Determine next screen based on current screen and data
  switch (screen) {
    case 'LEAD_FORM':
      if (validateLeadData(data)) {
        return {
          version: '3.0',
          screen: 'CONFIRMATION',
          data: {
            message: 'Thank you! We will contact you soon.',
            summary: data,
          },
        };
      } else {
        return {
          version: '3.0',
          screen: 'LEAD_FORM',
          data: {
            error: 'Please fill all required fields',
            ...data,
          },
        };
      }

    case 'DATE_PICKER':
      return {
        version: '3.0',
        screen: 'TIME_PICKER',
        data: {
          title: 'Select Time',
          selected_date: data.selected_date,
          available_times: getAvailableTimesForDate(data.selected_date as string),
        },
      };

    // ... más cases
  }
}
```

**Lógica de Navegación:**

1. **Guarda datos del screen actual**
2. **Valida si es necesario**
3. **Determina siguiente screen**
4. **Consulta datos dinámicos si es necesario**
5. **Retorna response con nuevo screen**

**Ejemplo de Validación:**
```typescript
if (validateLeadData(data)) {
  // Avanza a CONFIRMATION
} else {
  // Queda en LEAD_FORM con error
  return {
    screen: 'LEAD_FORM',
    data: {
      error: 'Please fill all required fields',
      ...data  // Preserva lo que el usuario ingresó
    },
  };
}
```

### 9. completeFlowSession() - Finalización

```typescript
/**
 * Complete a flow session
 */
export async function completeFlowSession(flowToken: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase
    .from('flow_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('flow_token', flowToken);
}
```

**Cuándo llamar:**
- Usuario completa el Flow
- Screen final mostrado (SUCCESS, THANK_YOU, etc.)
- Datos procesados correctamente

**Trigger SQL:**
```sql
-- Automáticamente actualiza completed_at cuando status = 'completed'
CREATE TRIGGER t_flow_sessions_set_completed
BEFORE UPDATE ON flow_sessions
FOR EACH ROW
EXECUTE FUNCTION flow_sessions_set_completed_at();
```

---

## Endpoint API - route.ts

```typescript
export const runtime = 'edge';

import { handleFlowDataExchange, completeFlowSession, validateFlowSignature } from '../../../../lib/whatsapp-flows';
import type { FlowDataExchangeRequest } from '../../../../types/whatsapp';

/**
 * WhatsApp Flows Data Exchange Endpoint
 * Handles encrypted data exchange for WhatsApp Flows
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // CRITICAL: Validate signature before processing to prevent spoofing
    const rawBody = await req.text();
    const isValid = await validateFlowSignature(req, rawBody);

    if (!isValid) {
      console.error('❌ Invalid flow signature - potential spoofing attempt');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = JSON.parse(rawBody) as FlowDataExchangeRequest;

    // Validate required fields
    if (!body.flow_token || !body.action || !body.screen) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Handle the data exchange
    const response = await handleFlowDataExchange(body);

    if (!response) {
      return new Response(
        JSON.stringify({ error: 'Failed to process flow request' }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // If this is a completion screen, mark the session as completed
    if (response.screen === 'SUCCESS' ||
        response.screen === 'THANK_YOU' ||
        response.screen === 'APPOINTMENT_CONFIRMED') {
      await completeFlowSession(body.flow_token).catch(console.error);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Flow endpoint error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}
```

**Orden de Ejecución:**

```
1. Recibe POST request
         ↓
2. Lee raw body (await req.text())
         ↓
3. Valida firma HMAC ✓
         ↓
4. Parsea JSON
         ↓
5. Valida campos requeridos
         ↓
6. Procesa data exchange
         ↓
7. Auto-completa si screen final
         ↓
8. Retorna response
```

**Seguridad:**
- ✅ Validación HMAC ANTES de procesar
- ✅ Validación de campos requeridos
- ✅ Manejo de errores robusto
- ✅ Logging de intentos inválidos

**Edge Runtime:**
- ✅ `export const runtime = 'edge'`
- ✅ No usa Node.js APIs
- ✅ Web Crypto API
- ✅ Despliega en Edge Network de Vercel

---

## Base de Datos - flow_sessions

### Schema Completo

```sql
-- Flow status enum
CREATE TYPE flow_status AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'failed');

CREATE TABLE flow_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  flow_id text NOT NULL,
  flow_token text NOT NULL UNIQUE,
  flow_type text NOT NULL CHECK (flow_type IN ('navigate', 'data_exchange')),
  session_data jsonb DEFAULT '{}'::jsonb,
  response_data jsonb,
  status flow_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Indexes
CREATE INDEX idx_flow_sessions_user ON flow_sessions(user_id);
CREATE INDEX idx_flow_sessions_conversation ON flow_sessions(conversation_id);
CREATE INDEX idx_flow_sessions_token ON flow_sessions(flow_token);
CREATE INDEX idx_flow_sessions_status ON flow_sessions(status);
CREATE INDEX idx_flow_sessions_expires ON flow_sessions(expires_at) WHERE status IN ('pending', 'in_progress');

-- Triggers
CREATE TRIGGER t_flow_sessions_updated
BEFORE UPDATE ON flow_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER t_flow_sessions_set_completed
BEFORE UPDATE ON flow_sessions
FOR EACH ROW EXECUTE FUNCTION flow_sessions_set_completed_at();

-- RLS
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_flow_sessions" ON flow_sessions FOR ALL USING (true) WITH CHECK (true);
```

### Campos Explicados

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | uuid | Primary key, auto-generado |
| `user_id` | uuid | Referencia a tabla users |
| `conversation_id` | uuid | Contexto de conversación |
| `flow_id` | text | ID del Flow en Meta (ej: 'lead_generation_flow') |
| `flow_token` | text | Token único de esta sesión (64 chars hex) |
| `flow_type` | text | 'navigate' o 'data_exchange' |
| `session_data` | jsonb | Datos acumulados durante el Flow |
| `response_data` | jsonb | Datos finales cuando completa |
| `status` | enum | pending → in_progress → completed/expired/failed |
| `created_at` | timestamptz | Timestamp de creación |
| `updated_at` | timestamptz | Auto-actualizado por trigger |
| `completed_at` | timestamptz | Cuando status = 'completed' |
| `expires_at` | timestamptz | Default: 24 horas después de created_at |

### Estados de Sesión

```
pending
   ↓ Usuario abre el Flow
in_progress
   ↓ Usuario completa → SUCCESS
completed
```

```
pending
   ↓ 24 horas sin interacción
expired
```

```
in_progress
   ↓ Error en backend
failed
```

### Queries Comunes

**Buscar sesión por token:**
```sql
SELECT * FROM flow_sessions WHERE flow_token = $1;
```

**Actualizar status:**
```sql
UPDATE flow_sessions
SET status = 'completed',
    completed_at = now()
WHERE flow_token = $1;
```

**Limpiar sesiones expiradas:**
```sql
UPDATE flow_sessions
SET status = 'expired'
WHERE status IN ('pending', 'in_progress')
  AND expires_at < now();
```

**Analytics - Tasa de completación:**
```sql
SELECT
  flow_id,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / COUNT(*), 2) AS completion_rate
FROM flow_sessions
WHERE created_at >= now() - interval '30 days'
GROUP BY flow_id;
```

---

## TypeScript Types

```typescript
/**
 * Flow Message Payload - Enviado a WhatsApp API
 */
export interface FlowMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'flow';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      name: 'flow';
      parameters: {
        flow_message_version: '3';
        flow_token: string;
        flow_id: string;
        flow_cta: string;
        flow_action: FlowActionType;
        flow_action_payload?: {
          screen: string;
          data?: Record<string, unknown>;
        };
      };
    };
  };
}

/**
 * Flow Action Types
 */
export type FlowActionType = 'navigate' | 'data_exchange';

/**
 * Flow Session Status
 */
export type FlowSessionStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

/**
 * Flow Data Exchange Request - Recibido de WhatsApp
 */
export interface FlowDataExchangeRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen: string;
  data: Record<string, unknown>;
  flow_token: string;
}

/**
 * Flow Data Exchange Response - Retornado a WhatsApp
 */
export interface FlowDataExchangeResponse {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}
```

**Uso en código:**

```typescript
// Type-safe envío de Flow
const payload: FlowMessagePayload = {
  messaging_product: 'whatsapp',
  to: userPhone,
  type: 'interactive',
  // ... TypeScript valida toda la estructura
};

// Type-safe procesamiento de request
async function handleRequest(req: FlowDataExchangeRequest): Promise<FlowDataExchangeResponse> {
  // TypeScript sabe que req.action es 'ping' | 'INIT' | 'data_exchange'
  // TypeScript sabe que response debe tener version, screen, data
}
```

---

## Ciclo de Vida Técnico

### Navigate Flow - Secuencia Completa

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Backend: sendFlow()                                      │
├─────────────────────────────────────────────────────────────┤
│ - generateFlowToken() → "a3f2e1..."                         │
│ - INSERT INTO flow_sessions (token, status='pending')       │
│ - POST /v23.0/{phone_id}/messages (WhatsApp API)           │
│ - Response: { messages: [{ id: "wamid.ABC==" }] }          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ WhatsApp entrega mensaje
┌─────────────────────────────────────────────────────────────┐
│ 2. Usuario recibe mensaje con botón Flow                   │
├─────────────────────────────────────────────────────────────┤
│ Usuario: "Hola, necesito info"                              │
│ Bot: "¿Te gustaría contactarnos?"                           │
│      [Sí, comenzar]  ← Botón Flow                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Usuario toca botón
┌─────────────────────────────────────────────────────────────┐
│ 3. Flow se abre (pantalla completa en WhatsApp)            │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐                    │
│ │ ← Información de Contacto      [✕] │                    │
│ ├─────────────────────────────────────┤                    │
│ │ Nombre Completo                     │                    │
│ │ [                             ]     │                    │
│ │                                     │                    │
│ │ Email                               │                    │
│ │ [                             ]     │                    │
│ │                                     │                    │
│ │ Teléfono                            │                    │
│ │ [                             ]     │                    │
│ │                                     │                    │
│ │            [Enviar]                 │                    │
│ └─────────────────────────────────────┘                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Usuario completa y presiona Enviar
┌─────────────────────────────────────────────────────────────┐
│ 4. WhatsApp valida frontend                                │
├─────────────────────────────────────────────────────────────┤
│ - Email tiene formato correcto? ✓                          │
│ - Campos requeridos completos? ✓                           │
│ - Pasa validaciones del Flow JSON? ✓                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Validación exitosa
┌─────────────────────────────────────────────────────────────┐
│ 5. WhatsApp envía webhook a nuestro servidor               │
├─────────────────────────────────────────────────────────────┤
│ POST /api/whatsapp/webhook                                  │
│                                                             │
│ Headers:                                                    │
│   x-hub-signature-256: sha256=abc123...                    │
│                                                             │
│ Body:                                                       │
│ {                                                           │
│   "entry": [{                                               │
│     "changes": [{                                           │
│       "value": {                                            │
│         "messages": [{                                      │
│           "from": "5491112345678",                          │
│           "type": "interactive",                            │
│           "interactive": {                                  │
│             "type": "nfm_reply",                            │
│             "nfm_reply": {                                  │
│               "response_json": "a3f2e1...",                 │
│               "body": "{\"name\":\"Juan\",...}"             │
│             }                                               │
│           }                                                 │
│         }]                                                  │
│       }                                                     │
│     }]                                                      │
│   }]                                                        │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend procesa webhook                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Valida firma HMAC ✓                                     │
│ 2. Extrae flow_token = "a3f2e1..."                         │
│ 3. Parsea response_data = JSON.parse(body)                 │
│ 4. Busca sesión: SELECT * WHERE flow_token = ...           │
│ 5. Actualiza:                                               │
│    UPDATE flow_sessions SET                                 │
│      response_data = {...},                                 │
│      status = 'completed',                                  │
│      completed_at = now()                                   │
│    WHERE flow_token = ...                                   │
│ 6. Crea lead en DB:                                         │
│    INSERT INTO leads (name, email, phone, ...)              │
│ 7. Notifica equipo (email/Slack)                           │
│ 8. Procesa con AI Agent si es necesario                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Backend envía confirmación al usuario                   │
├─────────────────────────────────────────────────────────────┤
│ sendWhatsAppText(                                           │
│   userPhone,                                                │
│   "✅ Gracias Juan! Recibimos tu información."             │
│ )                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Usuario recibe confirmación                             │
├─────────────────────────────────────────────────────────────┤
│ Miguel AI                                                   │
│ ✅ Gracias Juan! Recibimos tu información.                 │
│    Te contactaremos dentro de 24 horas.                    │
│                                   11:45 AM                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Exchange Flow - Secuencia Completa

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Backend: sendFlow() con data_exchange                   │
├─────────────────────────────────────────────────────────────┤
│ sendFlow(phone, flowId, cta, body, {                        │
│   flowType: 'data_exchange',                                │
│   initialScreen: 'SELECT_SERVICE'                           │
│ })                                                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Usuario abre Flow
┌─────────────────────────────────────────────────────────────┐
│ 2. WhatsApp envía INIT request                             │
├─────────────────────────────────────────────────────────────┤
│ POST /api/whatsapp/flows                                    │
│                                                             │
│ Headers:                                                    │
│   x-hub-signature-256: sha256=...                          │
│                                                             │
│ {                                                           │
│   "version": "3.0",                                         │
│   "action": "INIT",                                         │
│   "screen": "SELECT_SERVICE",                               │
│   "data": {},                                               │
│   "flow_token": "a3f2e1..."                                 │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Backend procesa INIT                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Valida firma HMAC ✓                                     │
│ 2. Valida flow_token ✓                                     │
│ 3. UPDATE flow_sessions SET status='in_progress'            │
│ 4. Consulta servicios disponibles:                         │
│    SELECT * FROM services WHERE active = true               │
│ 5. Retorna response:                                        │
│    {                                                        │
│      "version": "3.0",                                      │
│      "screen": "SELECT_SERVICE",                            │
│      "data": {                                              │
│        "services": [                                        │
│          {"id": "1", "title": "Consulta - $50"},            │
│          {"id": "2", "title": "Tratamiento - $100"}         │
│        ]                                                    │
│      }                                                      │
│    }                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Flow muestra dropdown con servicios
┌─────────────────────────────────────────────────────────────┐
│ 4. Usuario selecciona servicio y presiona Siguiente        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. WhatsApp envía data_exchange request                    │
├─────────────────────────────────────────────────────────────┤
│ POST /api/whatsapp/flows                                    │
│                                                             │
│ {                                                           │
│   "version": "3.0",                                         │
│   "action": "data_exchange",                                │
│   "screen": "SELECT_SERVICE",                               │
│   "data": {                                                 │
│     "selected_service": "1"                                 │
│   },                                                        │
│   "flow_token": "a3f2e1..."                                 │
│ }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Backend procesa data_exchange                           │
├─────────────────────────────────────────────────────────────┤
│ 1. Valida firma y token ✓                                  │
│ 2. Guarda selected_service en session_data                  │
│ 3. Consulta fechas disponibles:                            │
│    - Llama Google Calendar API                              │
│    - Filtra próximos 30 días                               │
│    - Excluye fines de semana                               │
│ 4. Retorna:                                                 │
│    {                                                        │
│      "screen": "SELECT_DATE",                               │
│      "data": {                                              │
│        "available_dates": [                                 │
│          "2025-10-15",                                      │
│          "2025-10-16",                                      │
│          "2025-10-17"                                       │
│        ],                                                   │
│        "service_name": "Consulta"                           │
│      }                                                      │
│    }                                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Flow muestra DatePicker
┌─────────────────────────────────────────────────────────────┐
│ 7. Usuario selecciona fecha                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ (proceso similar)
┌─────────────────────────────────────────────────────────────┐
│ 8. Backend retorna horarios disponibles para esa fecha     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓ Usuario confirma
┌─────────────────────────────────────────────────────────────┐
│ 9. Backend crea cita en Google Calendar                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Crea evento en Calendar                                  │
│ 2. UPDATE flow_sessions SET                                 │
│      status = 'completed',                                  │
│      response_data = {...}                                  │
│ 3. INSERT INTO appointments (...)                           │
│ 4. Envía email de confirmación                             │
│ 5. Programa reminder via cron                              │
│ 6. Retorna screen de confirmación                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Resumen

**Archivos Clave:**
- `lib/whatsapp-flows.ts` - Core logic (467 LOC)
- `app/api/whatsapp/flows/route.ts` - Edge endpoint (75 LOC)
- `types/whatsapp.ts` - TypeScript types
- `supabase/schema.sql` - Database schema

**Funciones Principales:**
- `generateFlowToken()` - Tokens seguros con Web Crypto
- `validateFlowSignature()` - Validación HMAC SHA-256
- `sendFlow()` - Envío de Flows
- `handleFlowDataExchange()` - Procesamiento dinámico
- `completeFlowSession()` - Finalización

**Security Features:**
- ✅ HMAC-SHA256 validation
- ✅ Constant-time comparison
- ✅ Fail-closed in production
- ✅ Token uniqueness enforced by DB

**Next Steps:**
- **[Parte 3: Templates y Casos de Uso →](./03-templates-casos-uso.md)** - Ejemplos completos de código y casos de uso reales

---

**[← Parte 1: Fundamentos](./01-fundamentos.md)** | **[Volver al Índice](./README.md)** | **[Siguiente: Templates →](./03-templates-casos-uso.md)**
