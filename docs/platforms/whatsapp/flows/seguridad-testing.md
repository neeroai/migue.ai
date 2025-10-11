# Parte 4: Seguridad, Testing y Debugging

**[← Parte 3: Templates](./03-templates-casos-uso.md)** | **[Volver al Índice](./README.md)**

---

## Tabla de Contenidos

1. [Seguridad](#seguridad)
2. [Testing](#testing)
3. [Debugging](#debugging)
4. [Mejores Prácticas](#mejores-prácticas)
5. [Limitaciones y Consideraciones](#limitaciones-y-consideraciones)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring y Alertas](#monitoring-y-alertas)

---

## Seguridad

### 1. Validación HMAC-SHA256

#### ¿Por qué es Crítico?

Sin validación de firma, cualquiera podría enviar requests falsificados a tu endpoint:

```typescript
// ❌ SIN VALIDACIÓN - VULNERABLE
export async function POST(req: Request) {
  const body = await req.json();
  // Procesa directamente - CUALQUIERA puede enviar esto
  await handleFlowDataExchange(body);
}

// ✅ CON VALIDACIÓN - SEGURO
export async function POST(req: Request) {
  const rawBody = await req.text();

  // CRÍTICO: Validar ANTES de procesar
  const isValid = await validateFlowSignature(req, rawBody);
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = JSON.parse(rawBody);
  await handleFlowDataExchange(body);
}
```

#### Implementación Segura

```typescript
/**
 * Validación HMAC completa con constant-time comparison
 */
export async function validateFlowSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  // 1. Obtener header de firma
  const header = req.headers.get('x-hub-signature-256');
  const secret = process.env.WHATSAPP_APP_SECRET;

  // 2. Fail-closed en producción
  if (!header || !secret) {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error('❌ Missing signature or secret in production');
      return false;
    }
    console.warn('⚠️  Dev mode: Signature validation disabled');
    return true;
  }

  // 3. Validar formato: sha256=hex_signature
  const [algorithm, providedSig] = header.split('=');
  if (algorithm !== 'sha256' || !providedSig) {
    console.error('❌ Invalid signature format');
    return false;
  }

  // 4. Calcular firma esperada
  const expectedSig = await hmacSha256Hex(secret, rawBody);

  // 5. Comparación constant-time (previene timing attacks)
  if (providedSig.length !== expectedSig.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ providedSig.charCodeAt(i);
  }

  return diff === 0;
}
```

#### ¿Qué es un Timing Attack?

```typescript
// ❌ VULNERABLE a timing attacks
function insecureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;  // ← Se detiene aquí!
    }
  }
  return true;
}

// Atacante puede medir tiempo de respuesta:
// "aaaaa..." → 10ms (falla en primer char)
// "abaaa..." → 15ms (falla en segundo char)
// "aabaa..." → 20ms (falla en tercer char)
// ← Puede deducir la firma carácter por carácter!

// ✅ SEGURO - constant-time
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;  // ← SIEMPRE itera completo
}

// Tiempo es constante sin importar qué char difiere:
// "aaaaa..." → 50ms
// "abaaa..." → 50ms
// "aabaa..." → 50ms
// ← No hay información útil para el atacante
```

### 2. Generación de Tokens Seguros

#### Web Crypto API (Edge Runtime Compatible)

```typescript
/**
 * Genera token único de 256 bits (64 chars hex)
 */
export function generateFlowToken(): string {
  const array = new Uint8Array(32);  // 32 bytes = 256 bits
  crypto.getRandomValues(array);     // Criptográficamente seguro

  return Array.from(array, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

// Ejemplo output:
// "a3f2e1d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1"

// Entropía: 2^256 combinaciones posibles
// Probabilidad de colisión: ~0 (prácticamente imposible)
```

#### ¿Por qué NO usar otras alternativas?

```typescript
// ❌ MAL - Predecible
const token = Date.now().toString();  // "1696515600000"

// ❌ MAL - No criptográfico
const token = Math.random().toString(36);  // Predecible

// ❌ MAL - Requiere Node.js crypto (no Edge compatible)
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex');

// ✅ BIEN - Web Crypto API (Edge compatible + seguro)
const array = new Uint8Array(32);
crypto.getRandomValues(array);
```

### 3. Validación de Flow Token

```typescript
/**
 * Valida que flow_token existe y está activo
 */
async function validateFlowToken(flowToken: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();

  const { data: session, error } = await supabase
    .from('flow_sessions')
    .select('*')
    .eq('flow_token', flowToken)
    .eq('status', 'in_progress')  // Solo sesiones activas
    .gt('expires_at', new Date().toISOString())  // No expirada
    .single();

  if (error || !session) {
    console.error('Invalid or expired flow token:', flowToken);
    return false;
  }

  return true;
}
```

### 4. Rate Limiting

```typescript
/**
 * Rate limiting por IP y por usuario
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// 10 requests por minuto por IP
const rateLimitIP = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'flow_ratelimit_ip',
});

// 5 flows por hora por usuario
const rateLimitUser = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'flow_ratelimit_user',
});

export async function POST(req: Request) {
  // 1. Rate limit por IP
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const { success: ipAllowed } = await rateLimitIP.limit(ip);

  if (!ipAllowed) {
    return new Response('Too many requests from IP', { status: 429 });
  }

  // 2. Validar firma
  const rawBody = await req.text();
  if (!await validateFlowSignature(req, rawBody)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // 3. Rate limit por usuario
  const { success: userAllowed } = await rateLimitUser.limit(body.flow_token);

  if (!userAllowed) {
    return new Response('Too many flow requests', { status: 429 });
  }

  // Procesar request
  return handleFlowDataExchange(body);
}
```

### 5. Input Validation

```typescript
/**
 * Validar y sanitizar datos de usuario
 */
import { z } from 'zod';

const LeadFormSchema = z.object({
  full_name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  message: z.string().min(10).max(1000),
  consent: z.boolean().refine(val => val === true, {
    message: 'Consent is required'
  })
});

async function handleLeadSubmission(data: unknown) {
  // Validar con Zod
  const result = LeadFormSchema.safeParse(data);

  if (!result.success) {
    console.error('Validation error:', result.error);
    return {
      error: 'Invalid data',
      details: result.error.flatten()
    };
  }

  // Sanitizar (remover caracteres peligrosos)
  const sanitized = {
    full_name: sanitize(result.data.full_name),
    email: result.data.email.toLowerCase().trim(),
    phone: result.data.phone?.replace(/\s/g, ''),
    message: sanitize(result.data.message),
    consent: result.data.consent
  };

  // Procesar datos sanitizados
  await saveLead(sanitized);
}

function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '')  // Remover < >
    .replace(/\\/g, '')    // Remover backslashes
    .slice(0, 1000);       // Limitar longitud
}
```

---

## Testing

### 1. Unit Tests

#### Test: generateFlowToken()

```typescript
// tests/unit/whatsapp-flows.test.ts

import { generateFlowToken } from '@/lib/whatsapp-flows';

describe('generateFlowToken', () => {
  it('should generate 64-character hex string', () => {
    const token = generateFlowToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate unique tokens', () => {
    const tokens = new Set();

    for (let i = 0; i < 1000; i++) {
      tokens.add(generateFlowToken());
    }

    // Todos deben ser únicos
    expect(tokens.size).toBe(1000);
  });

  it('should not contain predictable patterns', () => {
    const token1 = generateFlowToken();
    const token2 = generateFlowToken();

    // No deben ser secuenciales
    expect(parseInt(token1, 16)).not.toBe(parseInt(token2, 16) + 1);
  });
});
```

#### Test: validateFlowSignature()

```typescript
import { validateFlowSignature } from '@/lib/whatsapp-flows';

describe('validateFlowSignature', () => {
  const mockSecret = 'test_secret_key';

  beforeEach(() => {
    process.env.WHATSAPP_APP_SECRET = mockSecret;
    process.env.NODE_ENV = 'production';
  });

  it('should validate correct signature', async () => {
    const body = JSON.stringify({ test: 'data' });
    const signature = await hmacSha256Hex(mockSecret, body);

    const req = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${signature}`
      },
      body
    });

    const isValid = await validateFlowSignature(req, body);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const body = JSON.stringify({ test: 'data' });
    const wrongSignature = 'invalid_signature_here';

    const req = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${wrongSignature}`
      },
      body
    });

    const isValid = await validateFlowSignature(req, body);
    expect(isValid).toBe(false);
  });

  it('should reject tampered body', async () => {
    const originalBody = JSON.stringify({ test: 'data' });
    const signature = await hmacSha256Hex(mockSecret, originalBody);

    const tamperedBody = JSON.stringify({ test: 'tampered' });

    const req = new Request('https://example.com', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${signature}`
      },
      body: tamperedBody
    });

    const isValid = await validateFlowSignature(req, tamperedBody);
    expect(isValid).toBe(false);
  });

  it('should fail closed in production without secret', async () => {
    delete process.env.WHATSAPP_APP_SECRET;

    const req = new Request('https://example.com', {
      method: 'POST',
      body: '{}'
    });

    const isValid = await validateFlowSignature(req, '{}');
    expect(isValid).toBe(false);
  });
});
```

### 2. Integration Tests

```typescript
// tests/integration/flow-endpoint.test.ts

import { POST } from '@/app/api/whatsapp/flows/route';

describe('Flow Endpoint Integration', () => {
  it('should handle INIT action', async () => {
    const flowToken = 'test_token_123';

    // Setup: Crear sesión en DB
    await supabase.from('flow_sessions').insert({
      user_id: testUserId,
      flow_token: flowToken,
      flow_id: 'lead_generation_flow',
      status: 'pending'
    });

    // Request
    const body = JSON.stringify({
      version: '3.0',
      action: 'INIT',
      screen: 'LEAD_FORM',
      data: {},
      flow_token: flowToken
    });

    const signature = await hmacSha256Hex(process.env.WHATSAPP_APP_SECRET!, body);

    const req = new Request('https://example.com/api/whatsapp/flows', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': `sha256=${signature}`
      },
      body
    });

    // Execute
    const response = await POST(req);
    const data = await response.json();

    // Assertions
    expect(response.status).toBe(200);
    expect(data.version).toBe('3.0');
    expect(data.screen).toBe('LEAD_FORM');
    expect(data.data).toHaveProperty('title');

    // Verify DB update
    const { data: session } = await supabase
      .from('flow_sessions')
      .select('status')
      .eq('flow_token', flowToken)
      .single();

    expect(session?.status).toBe('in_progress');
  });

  it('should reject request without valid signature', async () => {
    const req = new Request('https://example.com/api/whatsapp/flows', {
      method: 'POST',
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature'
      },
      body: JSON.stringify({ test: 'data' })
    });

    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});
```

### 3. Manual Testing con cURL

```bash
# Test 1: Enviar Flow (simular desde backend)
curl -X POST https://migue.app/api/test/send-flow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -d '{
    "to": "+5491112345678",
    "flow_id": "lead_generation_flow",
    "cta": "Get Started",
    "body_text": "Test flow message"
  }'

# Test 2: Simular data exchange request (con firma válida)
BODY='{"version":"3.0","action":"INIT","screen":"TEST","data":{},"flow_token":"test123"}'
SECRET="your_whatsapp_app_secret"

# Calcular firma HMAC
SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')

# Enviar request
curl -X POST https://migue.app/api/whatsapp/flows \
  -H "Content-Type: application/json" \
  -H "x-hub-signature-256: sha256=$SIGNATURE" \
  -d "$BODY"

# Test 3: Verificar estado de sesión
curl https://migue.app/api/test/flow-session/test123 \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"
```

### 4. Test de UI con WhatsApp Test Number

```typescript
// scripts/test-flow-locally.ts

import { sendFlow, FLOW_TEMPLATES } from '@/lib/whatsapp-flows';

async function testFlowLocally() {
  const testPhone = process.env.TEST_PHONE_NUMBER!;  // Tu número personal

  console.log(`🧪 Enviando flow de prueba a ${testPhone}...`);

  // Enviar Lead Generation Flow
  const messageId = await sendFlow(
    testPhone,
    FLOW_TEMPLATES.LEAD_GENERATION.id,
    'Test Flow',
    '🧪 Este es un flow de prueba. Por favor complétalo para verificar funcionamiento.',
    {
      header: 'Testing',
      footer: 'Powered by migue.ai (TEST)'
    }
  );

  if (messageId) {
    console.log(`✅ Flow enviado exitosamente: ${messageId}`);
    console.log(`📱 Revisa tu WhatsApp y completa el formulario.`);
    console.log(`📊 Monitorea los logs en Vercel para ver el procesamiento.`);
  } else {
    console.error('❌ Error al enviar flow');
  }
}

// Ejecutar
testFlowLocally();
```

---

## Debugging

### 1. Structured Logging

```typescript
// lib/logger.ts

interface FlowLogContext {
  flow_token: string;
  user_id?: string;
  action: string;
  screen: string;
  timestamp: string;
}

export function logFlowEvent(
  level: 'info' | 'warn' | 'error',
  message: string,
  context: FlowLogContext
) {
  const log = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development'
  };

  // En producción: enviar a servicio de logging
  if (process.env.NODE_ENV === 'production') {
    // Logtail, Datadog, etc.
    console.log(JSON.stringify(log));
  } else {
    // En desarrollo: formato legible
    console.log(`[${log.level.toUpperCase()}] ${log.message}`, context);
  }
}

// Uso
logFlowEvent('info', 'Flow session started', {
  flow_token: 'abc123...',
  user_id: 'user-uuid',
  action: 'INIT',
  screen: 'LEAD_FORM',
  timestamp: new Date().toISOString()
});
```

### 2. Debug Mode

```typescript
// app/api/whatsapp/flows/route.ts

const DEBUG = process.env.FLOW_DEBUG === 'true';

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    const rawBody = await req.text();

    if (DEBUG) {
      console.log('=== FLOW REQUEST DEBUG ===');
      console.log('Headers:', Object.fromEntries(req.headers.entries()));
      console.log('Body:', rawBody);
      console.log('Body length:', rawBody.length);
    }

    // Validar firma
    const isValid = await validateFlowSignature(req, rawBody);

    if (DEBUG) {
      console.log('Signature valid:', isValid);
    }

    if (!isValid) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(rawBody) as FlowDataExchangeRequest;

    if (DEBUG) {
      console.log('Parsed body:', JSON.stringify(body, null, 2));
      console.log('Flow token:', body.flow_token);
      console.log('Action:', body.action);
      console.log('Screen:', body.screen);
    }

    // Procesar
    const response = await handleFlowDataExchange(body);

    if (DEBUG) {
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log('Processing time:', Date.now() - startTime, 'ms');
      console.log('=== END DEBUG ===');
    }

    return Response.json(response);
  } catch (error) {
    console.error('Flow endpoint error:', error);

    if (DEBUG) {
      console.error('Stack trace:', error.stack);
    }

    return new Response('Internal error', { status: 500 });
  }
}
```

### 3. Errores Comunes y Soluciones

#### Error 1: "Invalid signature"

**Síntoma:**
```
❌ Invalid flow signature - potential spoofing attempt
```

**Causas posibles:**
1. `WHATSAPP_APP_SECRET` incorrecto
2. Body modificado después de generar firma
3. Header `x-hub-signature-256` faltante

**Solución:**
```typescript
// Verificar que el secret sea correcto
console.log('Secret configured:', !!process.env.WHATSAPP_APP_SECRET);

// Log la firma recibida vs esperada (SOLO EN DEV)
if (process.env.NODE_ENV !== 'production') {
  console.log('Provided signature:', providedSig);
  console.log('Expected signature:', expectedSig);
}

// Verificar que lees rawBody ANTES de parsear
const rawBody = await req.text();  // ← Lee raw
const isValid = await validateFlowSignature(req, rawBody);  // ← Valida raw
const body = JSON.parse(rawBody);  // ← Parsea DESPUÉS
```

#### Error 2: "Invalid flow token"

**Síntoma:**
```
Error handling flow data exchange: Invalid flow token
```

**Causas posibles:**
1. Sesión expirada (>24h)
2. Token no existe en DB
3. Status no es 'in_progress'

**Solución:**
```typescript
// Debugging query
const { data: session, error } = await supabase
  .from('flow_sessions')
  .select('*')
  .eq('flow_token', flow_token)
  .single();

console.log('Session found:', !!session);
console.log('Session status:', session?.status);
console.log('Expires at:', session?.expires_at);
console.log('Current time:', new Date().toISOString());

if (session && session.status === 'expired') {
  // Sesión expiró
  return {
    version: '3.0',
    screen: 'ERROR',
    data: {
      error: 'Session expired. Please start again.'
    }
  };
}
```

#### Error 3: "Screen not found"

**Síntoma:**
```
Unknown screen: CONFIRMATION
```

**Causa:**
Screen ID en el switch-case no coincide con el enviado

**Solución:**
```typescript
async function handleDataExchange(session: any, screen: string, data: any) {
  // Log para debugging
  console.log(`Handling screen: "${screen}"`);

  switch (screen) {
    case 'SELECT_SERVICE':
      // ...
      break;

    case 'SELECT_DATE':
      // ...
      break;

    case 'CONFIRMATION':  // ← Asegurar que coincide exactamente
      // ...
      break;

    default:
      console.error(`Unknown screen: ${screen}`);
      return {
        version: '3.0',
        screen: 'ERROR',
        data: {
          error: `Unknown screen: ${screen}`,
          available_screens: ['SELECT_SERVICE', 'SELECT_DATE', 'CONFIRMATION']
        }
      };
  }
}
```

#### Error 4: "Flow session not completing"

**Síntoma:**
Flow se completa en WhatsApp pero status en DB sigue 'in_progress'

**Causa:**
Webhook no está procesando la completación

**Solución:**
```typescript
// app/api/whatsapp/webhook/route.ts

// Detectar flow completion
if (message.type === 'interactive' &&
    message.interactive?.type === 'nfm_reply') {

  const flowToken = message.interactive.nfm_reply.response_json;
  const responseData = JSON.parse(message.interactive.nfm_reply.body);

  console.log('Flow completed:', flowToken);
  console.log('Response data:', responseData);

  // Actualizar sesión
  const { error } = await supabase
    .from('flow_sessions')
    .update({
      status: 'completed',
      response_data: responseData,
      completed_at: new Date().toISOString()
    })
    .eq('flow_token', flowToken);

  if (error) {
    console.error('Failed to update session:', error);
  } else {
    console.log('✅ Session completed successfully');
  }
}
```

### 4. Herramientas de Debugging

```typescript
// scripts/debug-flow-session.ts

/**
 * Debug específico de una sesión de Flow
 */
async function debugFlowSession(flowToken: string) {
  const supabase = getSupabaseServerClient();

  // 1. Obtener sesión
  const { data: session, error } = await supabase
    .from('flow_sessions')
    .select(`
      *,
      user:users(*),
      conversation:conversations(*)
    `)
    .eq('flow_token', flowToken)
    .single();

  if (error || !session) {
    console.error('❌ Session not found:', flowToken);
    return;
  }

  console.log('=== FLOW SESSION DEBUG ===');
  console.log('Flow ID:', session.flow_id);
  console.log('Status:', session.status);
  console.log('Created:', session.created_at);
  console.log('Expires:', session.expires_at);
  console.log('Completed:', session.completed_at || 'N/A');
  console.log('\nUser:', session.user.name, `(${session.user.phone_number})`);
  console.log('\nSession Data:', JSON.stringify(session.session_data, null, 2));
  console.log('\nResponse Data:', JSON.stringify(session.response_data, null, 2));

  // 2. Verificar si expiró
  const isExpired = new Date(session.expires_at) < new Date();
  console.log('\nExpired:', isExpired);

  if (isExpired && session.status !== 'expired') {
    console.log('⚠️  Session should be marked as expired!');
  }

  // 3. Timeline de eventos
  const { data: interactions } = await supabase
    .from('user_interactions')
    .select('*')
    .eq('metadata->>flow_token', flowToken)
    .order('created_at', { ascending: true });

  if (interactions && interactions.length > 0) {
    console.log('\n=== INTERACTION TIMELINE ===');
    interactions.forEach(i => {
      console.log(`[${i.created_at}] ${i.interaction_type}`);
    });
  }

  console.log('=== END DEBUG ===');
}

// Uso
debugFlowSession('a3f2e1d9c8b7...');
```

---

## Mejores Prácticas

### 1. Diseño de Flows

✅ **DO:**
- Mantén flows cortos (máx 3-4 pantallas)
- Una pregunta por pantalla
- Labels claros y concisos
- Helper text para campos complejos
- Validación en frontend Y backend
- Progress indicators si >2 pantallas

❌ **DON'T:**
- Flows de >5 pantallas
- Múltiples preguntas complejas en una pantalla
- Dropdowns con >20 opciones
- Requerir información innecesaria
- Confiar solo en validación frontend

### 2. Error Handling

```typescript
// ✅ Manejo robusto de errores
async function handleFlowDataExchange(request: FlowDataExchangeRequest) {
  try {
    // Validaciones
    if (!request.flow_token) {
      return buildErrorResponse('Missing flow token');
    }

    const session = await getFlowSession(request.flow_token);
    if (!session) {
      return buildErrorResponse('Invalid session');
    }

    // Procesar
    const response = await processScreen(session, request);
    return response;

  } catch (error) {
    console.error('Flow processing error:', error);

    // Error específico vs genérico
    if (error instanceof ValidationError) {
      return buildErrorResponse(error.message);
    }

    if (error instanceof DatabaseError) {
      return buildErrorResponse('Temporary issue. Please try again.');
    }

    // Error genérico
    return buildErrorResponse('Something went wrong. Please try again later.');
  }
}

function buildErrorResponse(message: string): FlowDataExchangeResponse {
  return {
    version: '3.0',
    screen: 'ERROR',
    data: {
      error_message: message,
      can_retry: true
    }
  };
}
```

### 3. Performance

```typescript
// ✅ Cachear datos estáticos
import { unstable_cache } from 'next/cache';

const getServices = unstable_cache(
  async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('active', true);
    return data;
  },
  ['services-list'],
  { revalidate: 300 }  // 5 minutos
);

// ✅ Parallel queries
async function loadFlowData(serviceId: string) {
  const [service, availability, pricing] = await Promise.all([
    getService(serviceId),
    getAvailability(serviceId),
    getPricing(serviceId)
  ]);

  return { service, availability, pricing };
}

// ✅ Early returns
async function handleScreen(screen: string) {
  if (screen === 'SIMPLE_SCREEN') {
    return getSimpleData();  // No consultas DB
  }

  if (screen === 'COMPLEX_SCREEN') {
    return await getComplexData();  // Consultas necesarias
  }
}
```

### 4. User Experience

```typescript
// ✅ Feedback inmediato
async function handleAppointmentBooking(data: any) {
  // 1. Validar disponibilidad ANTES de confirmar
  const isAvailable = await checkAvailability(data.date, data.time);

  if (!isAvailable) {
    return {
      screen: 'SELECT_DATE',
      data: {
        error: 'Este horario ya no está disponible',
        suggested_times: await getSimilarAvailableTimes(data.date),
        ...data  // Preservar selecciones anteriores
      }
    };
  }

  // 2. Confirmación con resumen
  return {
    screen: 'CONFIRMATION',
    data: {
      summary: {
        service: data.service_name,
        date: formatDate(data.date),
        time: formatTime(data.time),
        price: data.price
      }
    }
  };
}

// ✅ Progress indicators
{
  "type": "TextCaption",
  "text": "Paso 2 de 3"
}

// ✅ Contextual help
{
  "type": "TextInput",
  "name": "tax_id",
  "label": "CUIT/CUIL",
  "helper-text": "Formato: 20-12345678-9"
}
```

---

## Limitaciones y Consideraciones

### 1. Límites de WhatsApp API

| Límite | Valor | Notas |
|--------|-------|-------|
| Flow size | 10 MB | JSON completo del Flow |
| Screens por Flow | 10 | Máximo recomendado: 5 |
| Fields por Screen | 15 | Mantener <10 para mejor UX |
| Dropdown options | 200 | Recomendado: <20 |
| Text input | 3,000 chars | Por campo |
| Session timeout | 24 horas | Después expira automáticamente |
| Messages por segundo | 250 | Rate limit de WhatsApp |

### 2. Edge Runtime Constraints

❌ **NO disponibles en Edge Runtime:**
```typescript
// Node.js APIs
import fs from 'fs';  // ❌ No funciona
import crypto from 'crypto';  // ❌ No funciona (usa Web Crypto)
import child_process from 'child_process';  // ❌ No funciona

// Heavy computations
await heavyCalculation();  // ⚠️  Timeout después de 30s
```

✅ **Alternativas Edge-compatible:**
```typescript
// Web Crypto API
const array = new Uint8Array(32);
crypto.getRandomValues(array);  // ✅ Funciona

// Fetch API
const response = await fetch('https://api.example.com');  // ✅ Funciona

// Headers, URL, FormData
const headers = new Headers();  // ✅ Funciona
```

### 3. Database Considerations

```typescript
// ✅ Indexes apropiados
CREATE INDEX idx_flow_sessions_token ON flow_sessions(flow_token);
CREATE INDEX idx_flow_sessions_expires ON flow_sessions(expires_at)
  WHERE status IN ('pending', 'in_progress');

// ✅ Limpieza automática de sesiones expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_flow_sessions()
RETURNS void AS $$
BEGIN
  UPDATE flow_sessions
  SET status = 'expired'
  WHERE status IN ('pending', 'in_progress')
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

// Ejecutar cada hora via cron
SELECT cron.schedule('cleanup-expired-flows', '0 * * * *', 'SELECT cleanup_expired_flow_sessions()');
```

---

## Performance Optimization

### 1. Caching Strategy

```typescript
// Redis cache para datos frecuentes
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

async function getServicesWithCache() {
  // 1. Intentar cache
  const cached = await redis.get('services:active');
  if (cached) {
    return JSON.parse(cached as string);
  }

  // 2. Query DB
  const { data: services } = await supabase
    .from('services')
    .select('*')
    .eq('active', true);

  // 3. Guardar en cache (5 min)
  await redis.setex('services:active', 300, JSON.stringify(services));

  return services;
}
```

### 2. Database Query Optimization

```typescript
// ❌ Múltiples queries
const session = await getSession(flowToken);
const user = await getUser(session.user_id);
const service = await getService(session.service_id);

// ✅ Single query con joins
const { data } = await supabase
  .from('flow_sessions')
  .select(`
    *,
    user:users(*),
    service:services(*)
  `)
  .eq('flow_token', flowToken)
  .single();

// ✅ Select solo campos necesarios
const { data } = await supabase
  .from('users')
  .select('id, name, phone_number')  // No todo
  .eq('id', userId)
  .single();
```

### 3. Minimize Payload Size

```typescript
// ❌ Payload grande (100+ options)
{
  "data": {
    "cities": cities.map(c => ({
      id: c.id,
      title: c.name,
      description: c.description,  // Innecesario
      population: c.population,    // Innecesario
      coordinates: c.coordinates   // Innecesario
    }))
  }
}

// ✅ Payload mínimo
{
  "data": {
    "cities": cities.map(c => ({
      id: c.id,
      title: c.name
    }))
  }
}
```

---

## Monitoring y Alertas

### 1. Métricas Clave

```typescript
// lib/metrics.ts

import { track } from '@vercel/analytics';

export async function trackFlowMetrics(event: string, properties: any) {
  await track(event, properties);
}

// Eventos a trackear
trackFlowMetrics('flow_sent', {
  flow_id: 'lead_generation_flow',
  user_id: userId
});

trackFlowMetrics('flow_opened', {
  flow_id: 'lead_generation_flow',
  flow_token: flowToken
});

trackFlowMetrics('flow_completed', {
  flow_id: 'lead_generation_flow',
  flow_token: flowToken,
  duration_seconds: completionTime
});

trackFlowMetrics('flow_abandoned', {
  flow_id: 'lead_generation_flow',
  flow_token: flowToken,
  last_screen: 'SELECT_DATE'
});
```

### 2. Alertas Automáticas

```typescript
// Alertar si tasa de completación < 50%
async function checkFlowCompletionRate() {
  const { data } = await supabase.rpc('get_flow_completion_rate', {
    flow_id: 'appointment_booking_flow',
    period_hours: 24
  });

  if (data.completion_rate < 0.5) {
    await sendAlert({
      severity: 'warning',
      message: `Low completion rate for appointment_booking_flow: ${data.completion_rate * 100}%`,
      details: {
        total_sent: data.total_sent,
        completed: data.completed,
        abandoned: data.abandoned
      }
    });
  }
}

// Ejecutar cada hora
```

---

## Resumen

**Seguridad Esencial:**
- ✅ Validación HMAC-SHA256 obligatoria
- ✅ Constant-time comparison
- ✅ Tokens criptográficamente seguros
- ✅ Rate limiting por IP y usuario
- ✅ Input validation con Zod
- ✅ Fail-closed en producción

**Testing Completo:**
- ✅ Unit tests para funciones críticas
- ✅ Integration tests para endpoints
- ✅ Manual testing con cURL
- ✅ Real testing con WhatsApp test numbers

**Debugging Efectivo:**
- ✅ Structured logging
- ✅ Debug mode para development
- ✅ Error handling robusto
- ✅ Scripts de debugging

**Mejores Prácticas:**
- ✅ Flows cortos y focalizados
- ✅ Validación dual (frontend + backend)
- ✅ Error messages útiles
- ✅ Performance optimization
- ✅ Monitoring continuo

---

**[← Parte 3: Templates](./03-templates-casos-uso.md)** | **[Volver al Índice](./README.md)**
