# Plan de Deployment Completo - migue.ai 2025
## WhatsApp AI Assistant - Vercel Edge + Supabase + OpenAI

**Fecha de creación**: 2025-01-29
**Versión**: 1.0
**Stack**: WhatsApp Business API → Vercel Edge Functions → Supabase (PostgreSQL + Storage + RLS) → OpenAI (GPT-4o/Whisper/Embeddings)

---

## 📊 Estado Actual del Proyecto

### ✅ Completado (70%)
- Infraestructura Vercel desplegada en producción: https://migue.app
- Edge Functions implementadas:
  - `api/whatsapp/webhook.ts` - Recepción de mensajes con HMAC validation
  - `api/whatsapp/send.ts` - Envío con reintentos y backoff
  - `api/cron/check-reminders.ts` - Cron job para recordatorios
- Lib helpers:
  - `lib/supabase.ts` - Cliente Supabase server-side
  - `lib/persist.ts` - Funciones de persistencia
- Documentación completa:
  - `docs/prd.md` - PRD v4
  - `docs/architecture.md` - Arquitectura técnica
  - `AGENTS.md` - Normativas y estándares
  - `CLAUDE.md` - Guía de desarrollo
- BMAD Method instalado en `.bmad-core/`
- Next.js 15 + React 19 + Tailwind CSS 4 agregados

### 🚧 En Progreso (20%)
- Next.js App Router foundation en `/app` directory
- Story 1.1 (Webhook) en estado Draft
- Configuración TypeScript y build system
- Dependencies actualizadas

### ⚠️ Cambios Sin Commitear
```
M package.json           # Next.js dependencies agregadas
M tsconfig.json          # Configuración para Next.js
?? app/                  # Nuevo App Router directory
?? next.config.mjs       # Configuración Next.js
?? postcss.config.mjs    # PostCSS para Tailwind
?? tailwind.config.ts    # Tailwind CSS 4 config
```

---

## 🎯 Plan de Deployment por Fases

### Fase 0: Consolidación Pre-Deployment (1-2 días)

#### 0.1 Decisión sobre Next.js UI

**Situación Actual**: Se agregó Next.js 15 + React 19 con App Router pero no está commiteado.

**Opción A: Commitear (RECOMENDADA) ⭐**
- ✅ Dashboard futuro para monitoreo y administración
- ✅ Arquitectura moderna (Edge Functions + App Router)
- ✅ No interfiere con Edge Functions API (conviven en `/api`)
- ✅ Vercel optimiza automáticamente la convivencia
- ⚠️ Dependencies adicionales (~50MB node_modules)

**Opción B: Revertir**
- ✅ Proyecto más ligero, focus en backend puro
- ⚠️ Tendrás que re-agregar después para UI
- ⚠️ Perderás trabajo ya invertido

**Recomendación**: **COMMITEAR** porque:
1. Next.js App Router + Edge Functions es la arquitectura estándar de Vercel
2. Ya invertiste tiempo en la configuración
3. Necesitarás dashboard para monitoreo eventualmente
4. No hay overhead en runtime (solo dev dependencies)

**Acción Propuesta**:
```bash
# 1. Validar configuración Next.js
npm run typecheck

# 2. Verificar que app/ tenga página funcional
npm run dev

# 3. Commit limpio
git add .
git commit -m "feat: add Next.js 15 foundation for future dashboard

- Add Next.js 15 with App Router
- Configure Tailwind CSS 4 with @tailwindcss/postcss
- Add React 19 and lucide-react for UI components
- Setup PostCSS and TypeScript for Next.js
- Maintain Edge Functions in /api (unchanged)

This provides foundation for future admin dashboard while keeping
existing Edge Functions fully operational."

git push origin main
```

#### 0.2 Validación de Entorno Vercel

**Variables Críticas a Verificar en Vercel Dashboard**:
```bash
# WhatsApp Business API (Meta)
WHATSAPP_TOKEN=EAAxxxxx              # Production token
WHATSAPP_PHONE_ID=123456789          # Phone number ID
WHATSAPP_VERIFY_TOKEN=mi_token_2025  # Custom verify token
WHATSAPP_APP_SECRET=abc123def456     # App secret para HMAC

# Supabase (usar service_role key para Edge)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx                  # service_role key (NO anon key)
SUPABASE_ANON_KEY=eyJyyy             # Solo si UI requiere client-side

# OpenAI
OPENAI_API_KEY=sk-proj-xxx

# Opcionales
TIMEZONE=America/Mexico_City
NODE_ENV=production
LOG_LEVEL=info
CRON_SECRET=random_secret_123        # Para validar cron requests
```

**⚠️ Vercel Environment Variables Best Practices**:
- Usar scopes "Production" + "Preview" + "Development"
- Secrets sensibles SOLO en Production
- Testing local con `.env.local` (nunca commitear)
- Regenerar secrets cada 3-6 meses

**Checklist de Cuentas**:
- [ ] WhatsApp Business API aprobada por Meta
- [ ] Supabase project creado
- [ ] OpenAI API con billing habilitado
- [ ] Vercel Pro account (opcional pero recomendado para crons)

#### 0.3 Supabase Schema Deployment

**Ejecutar en Supabase SQL Editor** (en orden):

```sql
-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";  -- Para embeddings (Fase 4)

-- 2. Ejecutar schema principal
-- (copiar contenido de supabase/schema.sql)

-- 3. Crear índices optimizados para Edge Functions
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_wa_id ON conversations(wa_conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);

-- 4. Índice para embeddings (preparación Fase 4)
-- Crear después de tener datos, con lists = sqrt(total_rows)
-- CREATE INDEX idx_embeddings_vector
-- ON embeddings USING ivfflat (vector vector_cosine_ops)
-- WITH (lists = 100);

-- 5. Ejecutar RLS policies
-- (copiar contenido de supabase/security.sql)

-- 6. Verificar RLS activo
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
-- Todas las tablas deben tener rowsecurity = true
```

**⚠️ Supabase Best Practices**:
- **Connection Pooling**: Usar Transaction mode para Edge Functions (latencia baja)
- **RLS**: Activar policies estrictas desde MVP (no deshabilitar nunca)
- **Índices**: Crear ANTES de llenar con datos
- **pgvector**: Índice IVFFlat solo después de 10k+ rows

**Storage Buckets** (crear en Supabase Dashboard):
```
audio-files/       # Private, RLS por user_id
documents/         # Private, RLS por user_id
public-assets/     # Public (opcional)
```

---

### Fase 1: Epic 1 - Base Plataforma (3-4 días)

#### Story 1.1: Webhook WhatsApp (COMPLETAR Y MEJORAR)

**Estado Actual**: 80% implementado en `api/whatsapp/webhook.ts`

**✅ Ya Implementado**:
- HMAC SHA-256 validation
- Verify token (GET challenge)
- Parser de mensajes básico
- Persistencia inicial

**🔧 Mejoras Necesarias**:

```typescript
// api/whatsapp/webhook.ts - MEJORAS

// 1. DEDUPLICACIÓN DE MENSAJES
// WhatsApp puede reenviar mensajes (Meta retries)
const messageCache = new Map<string, number>(); // wa_message_id → timestamp

function isDuplicate(waMessageId: string): boolean {
  const now = Date.now();
  const cached = messageCache.get(waMessageId);
  if (cached && now - cached < 300000) return true; // 5 min window
  messageCache.set(waMessageId, now);

  // Cleanup old entries (prevent memory leak)
  if (messageCache.size > 10000) {
    const entries = Array.from(messageCache.entries());
    entries.sort((a, b) => a[1] - b[1]);
    entries.slice(0, 5000).forEach(([k]) => messageCache.delete(k));
  }
  return false;
}

// 2. MANEJO DE STATUSES (delivered, read, failed)
function extractStatus(body: any) {
  const status = body?.entry?.[0]?.changes?.[0]?.value?.statuses?.[0];
  if (status) {
    return {
      waMessageId: status.id,
      status: status.status, // sent, delivered, read, failed
      timestamp: status.timestamp,
      recipientId: status.recipient_id
    };
  }
  return null;
}

// 3. ACK INMEDIATO + PROCESAMIENTO ASYNC
// WhatsApp requiere respuesta < 5s, mejor < 1s
export default async function handler(req: Request): Promise<Response> {
  const requestId = getRequestId();

  try {
    // Validaciones síncronas (rápidas)
    if (isVerifyRequest(req)) {
      return verifyToken(req);
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed', request_id: requestId }, 405);
    }

    const rawBody = await req.text();
    const signatureOk = await validateSignature(req, rawBody);
    if (!signatureOk) {
      return jsonResponse({ error: 'Invalid signature', request_id: requestId }, 401);
    }

    const body = await parseWhatsAppPayloadFromText(rawBody);
    if (!body) {
      return jsonResponse({ error: 'Invalid JSON', request_id: requestId }, 400);
    }

    // ACK INMEDIATO (no esperar DB ni IA)
    const response = jsonResponse({
      success: true,
      request_id: requestId
    });

    // PROCESAMIENTO ASYNC (no await)
    // Edge Functions permiten background tasks
    processMessageAsync(body, requestId).catch(err =>
      console.error(`[${requestId}] Async processing failed:`, err)
    );

    return response;
  } catch (error: any) {
    return jsonResponse({
      error: error?.message ?? 'Unhandled error',
      request_id: requestId
    }, 500);
  }
}

async function processMessageAsync(body: any, requestId: string) {
  // Extraer mensaje o status
  const normalized = extractNormalizedMessage(body);
  const status = extractStatus(body);

  if (status) {
    // Actualizar status de mensaje enviado
    await updateMessageStatus(status.waMessageId, status.status);
    return;
  }

  if (!normalized) {
    console.log(`[${requestId}] No message to process`);
    return;
  }

  // Deduplicar
  if (isDuplicate(normalized.waMessageId)) {
    console.log(`[${requestId}] Duplicate message ${normalized.waMessageId}`);
    return;
  }

  // Persistir
  await persistNormalizedMessage(normalized);

  // Orquestar respuesta (implementar en Story 1.5)
  // await orchestrateResponse(normalized, requestId);
}
```

**⚠️ WhatsApp Webhook Best Practices**:
- **Timeout**: Responder 200 OK en < 5s (mejor < 1s) o Meta reintenta
- **Idempotencia**: Deduplicar mensajes (Meta puede reenviar)
- **Statuses**: Manejar delivered/read/failed para tracking de entregas
- **Errors**: No retornar 5xx innecesariamente (causa reintentos → duplicados)
- **Async Processing**: No bloquear respuesta con operaciones lentas (DB, IA)

**Tests a Agregar**:
```typescript
// tests/unit/webhook.test.ts
describe('WhatsApp Webhook', () => {
  test('deduplicates messages with same wa_message_id', async () => {
    // Enviar mismo mensaje 2 veces
    // Verificar que solo se procesa una vez
  });

  test('handles status updates (delivered/read/failed)', async () => {
    // Enviar payload con status update
    // Verificar que se actualiza en DB
  });

  test('returns 200 OK under 1 second', async () => {
    const start = Date.now();
    const response = await POST('/api/whatsapp/webhook', payload);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
    expect(response.status).toBe(200);
  });

  test('processes message asynchronously without blocking', async () => {
    // Verificar que respuesta llega antes que procesamiento completo
  });

  test('validates HMAC signature correctly', async () => {
    // Test con firma válida e inválida
  });
});
```

#### Story 1.2: API de Envío (MEJORAR)

**Estado Actual**: Implementado en `api/whatsapp/send.ts`

**✅ Ya Implementado**:
- Envío de texto básico
- Reintentos con backoff exponencial
- Manejo de 429 rate limits

**🔧 Mejoras a Implementar**:

```typescript
// api/whatsapp/send.ts - MEJORAS

// 1. RATE LIMIT AWARENESS
const RATE_LIMITS = {
  messages_per_second: 80,      // Business API tier 2
  messages_per_hour: 10000,
  business_initiated_per_24h: 1000  // Fuera de CSW
};

// 2. SOPORTE PARA MESSAGE TEMPLATES
interface TemplateMessage {
  to: string;
  type: 'template';
  template: {
    name: string;                    // Template name aprobado en Meta
    language: { code: string };      // e.g., "es_MX"
    components?: Array<{
      type: 'body' | 'header' | 'button';
      parameters: Array<{
        type: 'text' | 'currency' | 'date_time';
        text?: string;
      }>;
    }>;
  };
}

// 3. SOPORTE PARA INTERACTIVE MESSAGES
interface InteractiveListMessage {
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      button: string;  // Texto del botón (max 20 chars)
      sections: Array<{
        title?: string;
        rows: Array<{
          id: string;           // Identificador único (max 200 chars)
          title: string;        // Título (max 24 chars)
          description?: string; // Descripción (max 72 chars)
        }>;
      }>;
    };
  };
}

interface InteractiveButtonMessage {
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: {
          id: string;     // Identificador único
          title: string;  // Texto del botón (max 20 chars)
        };
      }>;
    };
  };
}

// 4. MEJORAR RETRY CON JITTER
async function callWhatsAppAPI(body: any, attempt: number): Promise<Response> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    return jsonResponse({ error: 'Missing WhatsApp config' }, 500);
  }

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      ...body
    }),
  });

  if (res.ok) return res;

  // Rate limit: respetar Retry-After header
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const delay = retryAfter
      ? parseInt(retryAfter) * 1000
      : 200 * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // +/- 1s jitter

    if (attempt < 3) {
      await new Promise(r => setTimeout(r, delay + jitter));
      return callWhatsAppAPI(body, attempt + 1);
    }
  }

  // Server errors: retry con backoff exponencial
  if (res.status >= 500 && attempt < 3) {
    const delay = 200 * Math.pow(2, attempt);
    const jitter = Math.random() * 500;
    await new Promise(r => setTimeout(r, delay + jitter));
    return callWhatsAppAPI(body, attempt + 1);
  }

  return res;
}

// 5. HANDLER MEJORADO CON SOPORTE PARA TIPOS DE MENSAJE
type SendMessageRequest =
  | { to: string; type: 'text'; text: { body: string } }
  | TemplateMessage
  | InteractiveListMessage
  | InteractiveButtonMessage;

export default async function handler(req: Request): Promise<Response> {
  const requestId = getRequestId();

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed', request_id: requestId }, 405);
    }

    const body = (await req.json().catch(() => null)) as SendMessageRequest | null;

    if (!body || !body.to) {
      return jsonResponse({ error: 'Invalid body', request_id: requestId }, 400);
    }

    // Validar tipo de mensaje
    if (body.type === 'text' && !body.text?.body) {
      return jsonResponse({ error: 'Missing text.body', request_id: requestId }, 400);
    }

    const res = await callWhatsAppAPI(body, 0);

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return jsonResponse({
        error: 'WhatsApp send failed',
        status: res.status,
        detail,
        request_id: requestId
      }, 502);
    }

    const data = await res.json().catch(() => ({}));

    // Persistir mensaje enviado para tracking
    if (data.messages && data.messages[0]) {
      await persistOutboundMessage({
        waMessageId: data.messages[0].id,
        to: body.to,
        type: body.type,
        content: body.type === 'text' ? body.text.body : JSON.stringify(body),
        requestId
      });
    }

    return jsonResponse({ success: true, data, request_id: requestId });
  } catch (err: any) {
    return jsonResponse({
      error: err?.message ?? 'Unhandled error',
      request_id: requestId
    }, 500);
  }
}
```

**⚠️ WhatsApp Send API Best Practices**:
- **Rate Limits**: 80 msg/s (tier 2), 10k/hora, 1k/día fuera de CSW
- **CSW Window**: Mensajes de servicio gratis dentro 24h post-user message
- **Templates**: Fuera de CSW, usar templates aprobados (cuestan dinero)
- **Interactive Messages**:
  - List Messages: max 10 opciones
  - Quick Reply Buttons: max 3 botones
  - Titles: max 24 chars, buttons: max 20 chars
- **Idempotencia**: Guardar `wa_message_id` para tracking

#### Story 1.3: Esquema DB Completo

**Ejecutar en Supabase SQL Editor**:

```sql
-- Verificar que todas las tablas existan
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Debe incluir:
-- users, conversations, messages, reminders, documents, embeddings

-- Verificar RLS activo
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verificar índices creados
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Tests de Integridad**:
```typescript
// tests/integration/db-schema.test.ts
describe('Database Schema', () => {
  test('all tables exist with correct columns', async () => {
    // Verificar estructura de cada tabla
  });

  test('RLS is enabled on all tables', async () => {
    // Query pg_tables para verificar rowsecurity = true
  });

  test('foreign key constraints work', async () => {
    // Intentar insertar con FK inválida (debe fallar)
  });

  test('indexes improve query performance', async () => {
    // EXPLAIN ANALYZE queries críticos
    // Verificar que usa índices correctos
  });
});
```

#### Story 1.4: Intent Detection (NUEVO)

**Nuevo Endpoint**: `POST /api/ai/intent`

**Implementación**:

```typescript
// api/ai/intent.ts
export const config = { runtime: 'edge' };

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 3000, // 3s timeout (Edge tiene 10s free, 30s Pro)
  maxRetries: 1
});

const INTENT_SYSTEM_PROMPT = `Eres un clasificador de intención para migue.ai, asistente personal en WhatsApp.

Clasifica el mensaje del usuario en UNA de estas categorías:

1. "recordatorio": Usuario quiere programar/agendar/recordar algo
   - Ejemplos: "recuérdame llamar a Juan mañana", "agenda reunión", "avísame en 2 horas"

2. "transcribir": Usuario menciona audio o pide transcripción
   - Ejemplos: "transcribe el audio", "qué dice el mensaje de voz"

3. "buscar": Usuario pregunta sobre información previamente compartida (documentos/PDFs)
   - Ejemplos: "busca en el contrato", "qué decía el documento sobre precios"

4. "conversacion": Pregunta general, charla casual, o request de información nueva
   - Ejemplos: "qué es la fotosíntesis", "hola cómo estás", "cuéntame un chiste"

5. "clarificar": Mensaje ambiguo o incompleto que necesita aclaración
   - Ejemplos: "sí", "ok", "eso"

Responde SOLO con un objeto JSON válido con esta estructura:
{
  "intent": "categoria",
  "confidence": 0.0-1.0,
  "entities": {
    // Opcional: extraer entidades relevantes
    // Para "recordatorio": { "fecha": "...", "hora": "...", "descripcion": "..." }
    // Para "buscar": { "query": "..." }
  }
}

Si el mensaje es muy ambiguo, usa intent="clarificar" con confidence < 0.5`;

export default async function handler(req: Request): Promise<Response> {
  const requestId = `intent-${Date.now().toString(36)}`;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const { text, userId } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Intent detection for user ${userId}: "${text.slice(0, 50)}..."`);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // 10x más barato que gpt-4o
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      temperature: 0.3, // Baja para clasificación determinística
      max_tokens: 150,
      response_format: { type: 'json_object' } // Forzar JSON
    });

    const result = JSON.parse(completion.choices[0]!.message.content || '{}');

    console.log(`[${requestId}] Detected intent: ${result.intent} (confidence: ${result.confidence})`);

    return new Response(JSON.stringify({
      ...result,
      request_id: requestId,
      model: 'gpt-4o-mini',
      tokens: completion.usage?.total_tokens
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Intent detection error:`, error);

    // Fallback a "conversacion" si falla
    return new Response(JSON.stringify({
      intent: 'conversacion',
      confidence: 0.5,
      entities: {},
      error: error.message,
      request_id: requestId,
      fallback: true
    }), {
      status: 200, // No 500 para que no bloquee flujo
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**⚠️ OpenAI API Best Practices para Edge**:
- **Model**: `gpt-4o-mini` para clasificación (10x más barato que gpt-4o)
  - gpt-4o: $2.50 por 1M input tokens
  - gpt-4o-mini: $0.15 por 1M input tokens
- **Temperature**: 0.3 para clasificación (más determinístico)
- **JSON Mode**: `response_format: { type: 'json_object' }` (solo GPT-4o/mini)
- **Timeout**: 3s máximo (Edge free tier: 10s, Pro: 30s)
- **Retry**: 1 reintento máximo en SDK
- **Fallback**: Siempre tener respuesta por defecto

**Tests**:
```typescript
// tests/unit/intent.test.ts
describe('Intent Detection', () => {
  test('classifies recordatorio intent correctly', async () => {
    const response = await POST('/api/ai/intent', {
      text: 'recuérdame llamar al doctor mañana a las 3pm'
    });
    const result = await response.json();
    expect(result.intent).toBe('recordatorio');
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  test('falls back to conversacion on error', async () => {
    // Mock OpenAI error
    const response = await POST('/api/ai/intent', {
      text: 'test message'
    });
    expect(response.status).toBe(200);
  });
});
```

#### Story 1.5: Orquestación Completa

**Nuevo Archivo**: `lib/orchestrator.ts`

**Flujo**: `webhook → persist → intent → answer → send`

```typescript
// lib/orchestrator.ts
import { getSupabaseServerClient } from './supabase';
import {
  upsertUserByPhone,
  getOrCreateConversation,
  insertInboundMessage,
  insertOutboundMessage
} from './persist';

interface NormalizedMessage {
  from: string;
  type: 'text' | 'audio' | 'image' | 'document';
  content: string | null;
  mediaUrl: string | null;
  waMessageId: string;
  timestamp: number;
}

export async function orchestrateMessage(
  normalized: NormalizedMessage,
  requestId: string
): Promise<void> {
  console.log(`[${requestId}] Orchestrating message from ${normalized.from}`);

  try {
    // 1. Persistir mensaje entrante
    const userId = await upsertUserByPhone(normalized.from);
    const conversationId = await getOrCreateConversation(userId);
    await insertInboundMessage(conversationId, normalized);

    // 2. Routing por tipo de mensaje
    let responseText: string;

    if (normalized.type === 'audio') {
      responseText = await handleAudioMessage(conversationId, normalized, requestId);
    } else if (normalized.type === 'document') {
      responseText = await handleDocumentMessage(conversationId, normalized, requestId);
    } else if (normalized.type === 'text' && normalized.content) {
      responseText = await handleTextMessage(conversationId, normalized.content, userId, requestId);
    } else {
      responseText = 'Tipo de mensaje no soportado aún. Por favor envía texto.';
    }

    // 3. Enviar respuesta
    await sendResponse(normalized.from, responseText, requestId);

    // 4. Persistir mensaje saliente
    await insertOutboundMessage(conversationId, responseText);

    console.log(`[${requestId}] Orchestration complete`);

  } catch (error: any) {
    console.error(`[${requestId}] Orchestration failed:`, error);

    // Intento de envío de error al usuario
    try {
      await sendResponse(
        normalized.from,
        'Lo siento, ocurrió un error procesando tu mensaje. Intenta de nuevo.',
        requestId
      );
    } catch (sendError) {
      console.error(`[${requestId}] Failed to send error message:`, sendError);
    }
  }
}

async function handleTextMessage(
  conversationId: string,
  text: string,
  userId: string,
  requestId: string
): Promise<string> {
  // Detectar intención
  const intentResponse = await fetch('/api/ai/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, userId })
  });

  const intent = await intentResponse.json();
  console.log(`[${requestId}] Intent: ${intent.intent}`);

  // Obtener contexto conversacional (últimos 5 mensajes)
  const context = await getConversationContext(conversationId, 5);

  // Generar respuesta
  const answerResponse = await fetch('/api/ai/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      intent: intent.intent,
      context,
      userId
    })
  });

  const answer = await answerResponse.json();
  return answer.text || 'No pude generar una respuesta.';
}

async function handleAudioMessage(
  conversationId: string,
  normalized: NormalizedMessage,
  requestId: string
): Promise<string> {
  // Implementar en Fase 3
  return 'Función de transcripción de audio disponible próximamente.';
}

async function handleDocumentMessage(
  conversationId: string,
  normalized: NormalizedMessage,
  requestId: string
): Promise<string> {
  // Implementar en Fase 4
  return 'Función de análisis de documentos disponible próximamente.';
}

async function sendResponse(
  to: string,
  text: string,
  requestId: string
): Promise<void> {
  const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      type: 'text',
      text: { body: text }
    })
  });

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`);
  }
}

async function getConversationContext(
  conversationId: string,
  limit: number = 5
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('messages')
    .select('direction, content')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.reverse().map(msg => ({
    role: msg.direction === 'inbound' ? 'user' : 'assistant',
    content: msg.content || ''
  }));
}
```

**Nuevo Endpoint**: `POST /api/ai/answer`

```typescript
// api/ai/answer.ts
export const config = { runtime: 'edge' };

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 6000, // 6s timeout
  maxRetries: 1
});

const SYSTEM_PROMPT = `Eres migue.ai, un asistente personal útil y amigable en WhatsApp.

Características:
- Responde de forma concisa (máximo 2-3 párrafos)
- Usa lenguaje natural y amigable en español
- Si no tienes información suficiente, pide aclaración de forma breve
- Cuando detectes que el usuario quiere programar algo, confirma fecha/hora/descripción
- Sé proactivo pero no invasivo

Restricciones:
- NO puedes hacer llamadas telefónicas
- NO puedes acceder a internet en tiempo real (tu conocimiento tiene límite)
- Para transcripciones de audio, el usuario debe enviar el audio primero`;

interface AnswerRequest {
  text: string;
  intent: string;
  context: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = `answer-${Date.now().toString(36)}`;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const { text, intent, context, userId } = await req.json() as AnswerRequest;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Generating answer for user ${userId}, intent: ${intent}`);

    // Construir mensajes con contexto
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Agregar contexto conversacional (max últimos 5 mensajes)
    if (context && context.length > 0) {
      context.slice(-5).forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Agregar mensaje actual
    messages.push({ role: 'user', content: text });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Barato y rápido para conversación
      messages,
      temperature: 0.7, // Balanceado para conversación natural
      max_tokens: 400, // ~300 palabras
      presence_penalty: 0.1, // Evitar repetición
      frequency_penalty: 0.1
    });

    const responseText = completion.choices[0]!.message.content ||
      'No pude generar una respuesta. ¿Puedes reformular tu pregunta?';

    console.log(`[${requestId}] Generated ${responseText.length} chars, ${completion.usage?.total_tokens} tokens`);

    return new Response(JSON.stringify({
      text: responseText,
      intent,
      request_id: requestId,
      tokens: completion.usage?.total_tokens,
      model: 'gpt-4o-mini'
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Answer generation error:`, error);

    return new Response(JSON.stringify({
      text: 'Lo siento, estoy teniendo problemas para responder. Inténtalo de nuevo en unos momentos.',
      error: error.message,
      request_id: requestId,
      fallback: true
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**Integrar en Webhook**:

```typescript
// api/whatsapp/webhook.ts - ACTUALIZAR processMessageAsync

import { orchestrateMessage } from '../../lib/orchestrator';

async function processMessageAsync(body: any, requestId: string) {
  const normalized = extractNormalizedMessage(body);
  const status = extractStatus(body);

  if (status) {
    await updateMessageStatus(status.waMessageId, status.status);
    return;
  }

  if (!normalized) {
    console.log(`[${requestId}] No message to process`);
    return;
  }

  if (isDuplicate(normalized.waMessageId)) {
    console.log(`[${requestId}] Duplicate message ${normalized.waMessageId}`);
    return;
  }

  // ORQUESTAR (nuevo)
  await orchestrateMessage(normalized, requestId);
}
```

---

### Fase 2: Recordatorios con Vercel Cron (2 días)

#### 2.1 Story 2.1: Schema Reminders

**Ya existe en schema.sql**, verificar:

```sql
-- Tabla reminders
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'reminders';

-- Debe incluir:
-- id, user_id, title, description, scheduled_time, status, created_at, updated_at
```

**Agregar campo para locks optimistas**:

```sql
ALTER TABLE reminders
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

-- Índice para cleanup
CREATE INDEX IF NOT EXISTS idx_reminders_processing
ON reminders(status, processing_started_at)
WHERE status = 'processing';
```

#### 2.2 Story 2.2: Cron Job Optimizado

**Actualizar `vercel.json`**:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "*/1 * * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/whatsapp/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ]
}
```

**Mejorar `api/cron/check-reminders.ts`**:

```typescript
// api/cron/check-reminders.ts
export const config = {
  runtime: 'edge',
  maxDuration: 60 // 1 minuto max (Free tier)
};

import { getSupabaseServerClient } from '../../lib/supabase';

async function getDueReminders() {
  const supabase = getSupabaseServerClient();
  const now = new Date().toISOString();

  // Lock optimista: UPDATE ... RETURNING
  // Solo toma reminders pending y los marca como processing
  const { data, error } = await supabase
    .from('reminders')
    .update({
      status: 'processing',
      processing_started_at: now
    })
    .eq('status', 'pending')
    .lte('scheduled_time', now)
    .select('id, user_id, title, description, scheduled_time')
    .limit(20); // Max 20 por ejecución

  if (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }

  return data || [];
}

async function cleanupStaleProcessing() {
  // Liberar locks de procesamiento que llevan > 5 min
  // (probablemente fallaron sin actualizar status)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'pending', processing_started_at: null })
    .eq('status', 'processing')
    .lt('processing_started_at', fiveMinutesAgo)
    .select('id');

  if (data && data.length > 0) {
    console.log(`Released ${data.length} stale processing locks`);
  }
}

async function getUserPhone(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data.phone_number;
}

async function sendReminder(reminder: any): Promise<void> {
  const phone = await getUserPhone(reminder.user_id);

  if (!phone) {
    console.error(`No phone for user ${reminder.user_id}`);
    await markReminderFailed(reminder.id, 'User phone not found');
    return;
  }

  // Formatear mensaje
  const message = `🔔 Recordatorio: ${reminder.title}${reminder.description ? '\n\n' + reminder.description : ''}`;

  try {
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phone,
        type: 'text',
        text: { body: message }
      })
    });

    if (!response.ok) {
      throw new Error(`Send failed: ${response.status}`);
    }

    await markReminderSent(reminder.id);
    console.log(`Reminder ${reminder.id} sent to ${phone}`);

  } catch (error: any) {
    console.error(`Failed to send reminder ${reminder.id}:`, error);
    await markReminderFailed(reminder.id, error.message);
  }
}

async function markReminderSent(reminderId: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase
    .from('reminders')
    .update({
      status: 'sent',
      processing_started_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', reminderId);
}

async function markReminderFailed(reminderId: string, reason: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase
    .from('reminders')
    .update({
      status: 'failed',
      processing_started_at: null,
      updated_at: new Date().toISOString(),
      metadata: { error: reason }
    })
    .eq('id', reminderId);
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = `cron-${Date.now().toString(36)}`;

  try {
    // Validar que es Vercel Cron (header de autenticación)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log(`[${requestId}] Unauthorized cron request`);
      return new Response('Unauthorized', { status: 401 });
    }

    console.log(`[${requestId}] Cron job started`);

    // 1. Cleanup de locks antiguos
    await cleanupStaleProcessing();

    // 2. Obtener reminders vencidos (con lock)
    const reminders = await getDueReminders();

    console.log(`[${requestId}] Found ${reminders.length} due reminders`);

    if (reminders.length === 0) {
      return new Response(JSON.stringify({
        processed: 0,
        request_id: requestId
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    // 3. Procesar reminders en paralelo (con límite)
    // Promise.allSettled no falla si alguno falla
    const results = await Promise.allSettled(
      reminders.map(r => sendReminder(r))
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`[${requestId}] Sent: ${sent}, Failed: ${failed}`);

    return new Response(JSON.stringify({
      processed: reminders.length,
      sent,
      failed,
      request_id: requestId
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Cron error:`, error);

    return new Response(JSON.stringify({
      error: error.message,
      request_id: requestId
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**⚠️ Vercel Cron Best Practices**:
- **Frequency**: Mínimo 1 minuto (no soporta más frecuente)
- **Timeout**: 60s (Free), 300s (Pro)
- **Reliability**: 99.9% uptime pero no garantizado al 100%
- **Timezone**: Siempre UTC (convertir en código si necesario)
- **Idempotencia**: CRÍTICO - puede ejecutarse 2x en caso de falla/retry
- **Authentication**: Usar `CRON_SECRET` env var para validar requests

**Agregar variable en Vercel**:
```bash
CRON_SECRET=<generar-con-openssl-rand-hex-32>
```

#### 2.3 Story 2.3: API Reminders

**Nuevo Endpoint**: `POST /api/reminders/schedule`

```typescript
// api/reminders/schedule.ts
export const config = { runtime: 'edge' };

import { getSupabaseServerClient } from '../../lib/supabase';

interface ScheduleReminderRequest {
  userId: string;
  title: string;
  description?: string;
  scheduledTime: string; // ISO 8601
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const body = await req.json() as ScheduleReminderRequest;

    // Validaciones
    if (!body.userId || !body.title || !body.scheduledTime) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: userId, title, scheduledTime'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Validar formato de fecha
    const scheduledDate = new Date(body.scheduledTime);
    if (isNaN(scheduledDate.getTime())) {
      return new Response(JSON.stringify({
        error: 'Invalid scheduledTime format. Use ISO 8601.'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    // Validar que no sea en el pasado
    if (scheduledDate < new Date()) {
      return new Response(JSON.stringify({
        error: 'scheduledTime cannot be in the past'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase
      .from('reminders')
      .insert({
        user_id: body.userId,
        title: body.title,
        description: body.description || null,
        scheduled_time: scheduledDate.toISOString(),
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reminder:', error);
      return new Response(JSON.stringify({
        error: 'Failed to create reminder',
        detail: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      reminder: data
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**Nuevo Endpoint**: `GET /api/reminders`

```typescript
// api/reminders/index.ts (para GET)
export const config = { runtime: 'edge' };

import { getSupabaseServerClient } from '../../lib/supabase';

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!userId) {
      return new Response(JSON.stringify({
        error: 'Missing userId parameter'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    const supabase = getSupabaseServerClient();

    let query = supabase
      .from('reminders')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching reminders:', error);
      return new Response(JSON.stringify({
        error: 'Failed to fetch reminders',
        detail: error.message
      }), {
        status: 500,
        headers: { 'content-type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      reminders: data || [],
      total: count || 0,
      limit,
      offset
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**Integrar en orquestador**:

```typescript
// lib/orchestrator.ts - AGREGAR

async function handleReminderIntent(
  text: string,
  userId: string,
  requestId: string
): Promise<string> {
  // Usar GPT para extraer fecha/hora/descripción
  const extractionResponse = await fetch('/api/ai/extract-reminder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });

  const extraction = await extractionResponse.json();

  if (!extraction.scheduledTime) {
    return 'No pude entender cuándo quieres el recordatorio. ¿Puedes especificar fecha y hora? Por ejemplo: "mañana a las 3pm"';
  }

  // Crear recordatorio
  const createResponse = await fetch('/api/reminders/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      title: extraction.title || text,
      description: extraction.description,
      scheduledTime: extraction.scheduledTime
    })
  });

  if (!createResponse.ok) {
    return 'Hubo un error creando el recordatorio. Intenta de nuevo.';
  }

  const result = await createResponse.json();
  const formattedTime = new Date(result.reminder.scheduled_time).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return `✅ Recordatorio programado para ${formattedTime}:\n"${result.reminder.title}"`;
}

// Actualizar handleTextMessage para incluir recordatorios
async function handleTextMessage(
  conversationId: string,
  text: string,
  userId: string,
  requestId: string
): Promise<string> {
  const intentResponse = await fetch('/api/ai/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, userId })
  });

  const intent = await intentResponse.json();
  console.log(`[${requestId}] Intent: ${intent.intent}`);

  // Routing por intent
  if (intent.intent === 'recordatorio') {
    return await handleReminderIntent(text, userId, requestId);
  }

  // ... resto del código existente ...
}
```

---

### Fase 3: Audio + Whisper (3 días)

#### 3.1 Story 3.1: Supabase Storage Setup

**Crear bucket en Supabase Dashboard**:
1. Storage → Create bucket → `audio-files`
2. Public: NO (private)
3. RLS policies:

```sql
-- Policy: Users can upload their own audio files
CREATE POLICY "Users can upload audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own audio files
CREATE POLICY "Users can read own audio"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Service role can do everything (para Edge Functions)
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'audio-files')
WITH CHECK (bucket_id = 'audio-files');
```

**Retention policy** (cleanup automático):

```sql
-- Función para limpiar audios antiguos (>30 días)
CREATE OR REPLACE FUNCTION cleanup_old_audio_files()
RETURNS void AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'audio-files'
    AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar via pg_cron (si disponible) o manualmente
-- SELECT cleanup_old_audio_files();
```

#### 3.2 Story 3.2: Transcripción Whisper

**Nuevo Endpoint**: `POST /api/ai/transcribe`

```typescript
// api/ai/transcribe.ts
export const config = {
  runtime: 'edge',
  maxDuration: 30 // Whisper puede tardar 10-20s
};

import OpenAI from 'openai';
import { getSupabaseServerClient } from '../../lib/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 25000 // 25s timeout
});

interface TranscribeRequest {
  audioUrl: string;      // WhatsApp media URL
  waMessageId: string;
  userId: string;
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = `transcribe-${Date.now().toString(36)}`;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const { audioUrl, waMessageId, userId } = await req.json() as TranscribeRequest;

    if (!audioUrl || !waMessageId || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Transcribing audio for message ${waMessageId}`);

    // 1. Descargar audio desde WhatsApp
    const audioResponse = await fetch(audioUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    });

    if (!audioResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to download audio from WhatsApp',
        status: audioResponse.status
      }), {
        status: 502,
        headers: { 'content-type': 'application/json' }
      });
    }

    const audioBlob = await audioResponse.blob();

    // 2. Validar tamaño (Whisper max 25MB)
    if (audioBlob.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({
        error: 'Audio file too large. Maximum 25MB supported.',
        size: audioBlob.size
      }), {
        status: 413,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Audio size: ${(audioBlob.size / 1024).toFixed(2)} KB`);

    // 3. Upload a Supabase Storage (para cache y auditoría)
    const supabase = getSupabaseServerClient();
    const fileName = `${userId}/${waMessageId}-${Date.now()}.ogg`;

    const { error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(fileName, audioBlob, {
        contentType: 'audio/ogg',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error(`[${requestId}] Storage upload error:`, uploadError);
      // No fallar si upload falla, continuar con transcripción
    }

    // 4. Transcribir con Whisper
    const file = new File([audioBlob], fileName, { type: 'audio/ogg' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'es',           // Español prioritario (+20% precisión)
      response_format: 'verbose_json', // Incluye timestamps y confidence
      temperature: 0.2          // Baja para mayor precisión
    });

    console.log(`[${requestId}] Transcription complete: ${transcription.text.length} chars, ${transcription.duration}s`);

    // 5. Guardar transcripción en DB
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        transcription: transcription.text,
        metadata: {
          duration: transcription.duration,
          language: transcription.language,
          storage_path: fileName
        }
      })
      .eq('wa_message_id', waMessageId);

    if (updateError) {
      console.error(`[${requestId}] DB update error:`, updateError);
    }

    return new Response(JSON.stringify({
      text: transcription.text,
      duration: transcription.duration,
      language: transcription.language,
      storage_path: fileName,
      request_id: requestId
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Transcription error:`, error);

    return new Response(JSON.stringify({
      error: 'Transcription failed',
      detail: error.message,
      request_id: requestId
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**⚠️ Whisper API Best Practices**:
- **Formato**: OGG opus (WhatsApp) funciona directamente (no convertir)
- **Tamaño**: Max 25MB (WhatsApp audio típico < 2MB)
- **Language**: Especificar 'es' mejora precisión ~20%
- **Temperature**: 0.0-0.2 para precisión máxima, 0.8 para creatividad
- **Response Format**: `verbose_json` da timestamps y segments
- **Pricing**: $0.006 por minuto de audio (MUY barato)
  - Audio de 2 min = $0.012
  - 1000 audios de 2 min = $12
- **Latency**: ~10-20s para audio de 1-2 minutos

#### 3.3 Story 3.3: Integración en Orquestador

```typescript
// lib/orchestrator.ts - ACTUALIZAR handleAudioMessage

async function handleAudioMessage(
  conversationId: string,
  normalized: NormalizedMessage,
  requestId: string
): Promise<string> {
  if (!normalized.mediaUrl) {
    return 'No pude acceder al audio. Intenta enviarlo de nuevo.';
  }

  // Transcribir
  const transcribeResponse = await fetch('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      audioUrl: normalized.mediaUrl,
      waMessageId: normalized.waMessageId,
      userId: getUserIdFromConversation(conversationId) // helper
    })
  });

  if (!transcribeResponse.ok) {
    const error = await transcribeResponse.json();
    console.error(`[${requestId}] Transcription failed:`, error);
    return 'No pude transcribir el audio. Asegúrate de que sea menor a 2 minutos.';
  }

  const transcription = await transcribeResponse.json();

  // Generar respuesta basada en transcripción
  const answerResponse = await fetch('/api/ai/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: transcription.text,
      intent: 'conversacion',
      context: await getConversationContext(conversationId, 3),
      userId: getUserIdFromConversation(conversationId)
    })
  });

  const answer = await answerResponse.json();

  // Formato: transcripción + respuesta
  return `📝 Transcripción:\n"${transcription.text}"\n\n${answer.text}`;
}
```

---

### Fase 4: RAG con pgvector (4 días)

#### 4.1 Story 4.1: Schema y Storage

**Supabase Storage**:
```sql
-- Crear bucket en Dashboard: documents (private)
```

**RLS Policies**:
```sql
-- Storage policies para documents bucket
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can read own documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Service role full access documents"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');
```

**Tablas**:
```sql
-- Ya debe existir en schema.sql, verificar:
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  vector vector(1536), -- text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, chunk_index)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document ON embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata ON embeddings USING gin(metadata);

-- Índice vector IVFFlat (crear DESPUÉS de tener datos)
-- Esperar hasta tener ~10k embeddings
-- CREATE INDEX idx_embeddings_vector
-- ON embeddings USING ivfflat (vector vector_cosine_ops)
-- WITH (lists = 100); -- sqrt(10000)
```

**Función de búsqueda** (stored procedure):
```sql
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    embeddings.id,
    embeddings.document_id,
    embeddings.chunk_index,
    embeddings.content,
    1 - (embeddings.vector <=> query_embedding) AS similarity,
    embeddings.metadata
  FROM embeddings
  WHERE
    (filter_user_id IS NULL OR embeddings.document_id IN (
      SELECT id FROM documents WHERE user_id = filter_user_id
    ))
    AND 1 - (embeddings.vector <=> query_embedding) > match_threshold
  ORDER BY embeddings.vector <=> query_embedding
  LIMIT match_count;
END;
$$;
```

#### 4.2 Story 4.2: Chunking y Embeddings

**Nuevo helper**: `lib/chunking.ts`

```typescript
// lib/chunking.ts
export interface ChunkOptions {
  chunkSize?: number;      // tokens aprox
  chunkOverlap?: number;   // tokens de overlap
  separator?: string;      // separator entre chunks
}

export interface Chunk {
  index: number;
  content: string;
  start: number;  // char position
  end: number;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {}
): Chunk[] {
  const {
    chunkSize = 800,
    chunkOverlap = 100,
    separator = '\n\n'
  } = options;

  // Estimación: 1 token ≈ 4 caracteres en español
  const chunkChars = chunkSize * 4;
  const overlapChars = chunkOverlap * 4;

  // Split por párrafos primero (mejor que dividir arbitrariamente)
  const paragraphs = text.split(separator);
  const chunks: Chunk[] = [];
  let currentChunk = '';
  let currentStart = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i]!;

    if ((currentChunk.length + para.length) < chunkChars) {
      // Agregar a chunk actual
      currentChunk += (currentChunk ? separator : '') + para;
    } else {
      // Guardar chunk actual
      if (currentChunk) {
        chunks.push({
          index: chunks.length,
          content: currentChunk,
          start: currentStart,
          end: currentStart + currentChunk.length
        });

        // Overlap: tomar últimos N chars del chunk actual
        const overlap = currentChunk.slice(-overlapChars);
        currentChunk = overlap + separator + para;
        currentStart += currentChunk.length - overlap.length - separator.length;
      } else {
        currentChunk = para;
      }
    }
  }

  // Último chunk
  if (currentChunk) {
    chunks.push({
      index: chunks.length,
      content: currentChunk,
      start: currentStart,
      end: currentStart + currentChunk.length
    });
  }

  return chunks;
}

// Estimación de tokens (aproximada)
export function estimateTokens(text: string): number {
  // Regla simple: 1 token ≈ 4 caracteres en español
  // GPT-4 tokenizer es más preciso pero requiere library
  return Math.ceil(text.length / 4);
}
```

**Nuevo Endpoint**: `POST /api/documents/ingest`

```typescript
// api/documents/ingest.ts
export const config = {
  runtime: 'edge',
  maxDuration: 60 // Puede tardar en documentos grandes
};

import OpenAI from 'openai';
import { getSupabaseServerClient } from '../../lib/supabase';
import { chunkText, estimateTokens } from '../../lib/chunking';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000
});

interface IngestRequest {
  documentId: string;
  text: string;
  userId: string;
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = `ingest-${Date.now().toString(36)}`;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }

    const { documentId, text, userId } = await req.json() as IngestRequest;

    if (!documentId || !text || !userId) {
      return new Response(JSON.stringify({
        error: 'Missing required fields'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }

    console.log(`[${requestId}] Ingesting document ${documentId} for user ${userId}`);
    console.log(`[${requestId}] Text length: ${text.length} chars, ~${estimateTokens(text)} tokens`);

    // 1. Chunking
    const chunks = chunkText(text, {
      chunkSize: 800,     // ~800 tokens
      chunkOverlap: 100,  // ~100 tokens overlap
      separator: '\n\n'
    });

    console.log(`[${requestId}] Created ${chunks.length} chunks`);

    // 2. Generar embeddings en batch (OpenAI permite hasta 2048 inputs)
    const batchSize = 100; // Procesar 100 chunks a la vez
    const allEmbeddings: Array<{ index: number; embedding: number[] }> = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      console.log(`[${requestId}] Generating embeddings for batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

      const embeddings = await openai.embeddings.create({
        model: 'text-embedding-3-small', // 1536 dimensions, barato
        input: batch.map(c => c.content),
        encoding_format: 'float'
      });

      embeddings.data.forEach((item, batchIndex) => {
        allEmbeddings.push({
          index: i + batchIndex,
          embedding: item.embedding
        });
      });
    }

    // 3. Insertar embeddings en Supabase
    const supabase = getSupabaseServerClient();

    const records = chunks.map((chunk, i) => ({
      document_id: documentId,
      chunk_index: chunk.index,
      content: chunk.content,
      vector: allEmbeddings[i]!.embedding,
      metadata: {
        start: chunk.start,
        end: chunk.end,
        tokens: estimateTokens(chunk.content)
      }
    }));

    const { error: insertError } = await supabase
      .from('embeddings')
      .insert(records);

    if (insertError) {
      console.error(`[${requestId}] Insert error:`, insertError);
      throw new Error(`Failed to insert embeddings: ${insertError.message}`);
    }

    // 4. Calcular costo
    const totalTokens = chunks.reduce((sum, c) => sum + estimateTokens(c.content), 0);
    const cost = (totalTokens * 0.00002) / 1000; // $0.02 per 1M tokens

    console.log(`[${requestId}] Ingestion complete: ${chunks.length} chunks, ~${totalTokens} tokens, ~$${cost.toFixed(4)} cost`);

    return new Response(JSON.stringify({
      success: true,
      document_id: documentId,
      chunks: chunks.length,
      tokens: totalTokens,
      cost,
      request_id: requestId
    }), {
      status: 201,
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    console.error(`[${requestId}] Ingestion error:`, error);

    return new Response(JSON.stringify({
      error: 'Ingestion failed',
      detail: error.message,
      request_id: requestId
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
```

**⚠️ Embeddings Best Practices**:
- **Model**: `text-embedding-3-small` (1536 dim, $0.02/1M tokens)
  - vs `text-embedding-3-large` (3072 dim, $0.13/1M tokens)
  - `small` es suficiente para mayoría de casos
- **Chunking**: 800-1000 tokens con 100-200 overlap
- **Batch**: OpenAI permite hasta 2048 inputs por request
- **Cost**: ~$0.02 per 1M tokens
  - PDF 50 páginas ≈ 10k tokens ≈ $0.0002
  - 1000 PDFs ≈ $0.20
- **Latency**: ~2-5s para 100 chunks

#### 4.3 Story 4.3: Retrieval y Answer con Contexto

**Actualizar `api/ai/answer.ts` para soportar RAG**:

```typescript
// api/ai/answer.ts - ACTUALIZAR para RAG

async function performRAGRetrieval(
  query: string,
  userId: string,
  requestId: string
): Promise<Array<{ content: string; similarity: number }>> {
  // 1. Generar embedding del query
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  // 2. Vector search en Supabase
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc('match_embeddings', {
    query_embedding: queryEmbedding.data[0]!.embedding,
    match_threshold: 0.7,  // Cosine similarity threshold
    match_count: 10,       // Top 10 candidatos
    filter_user_id: userId
  });

  if (error || !data) {
    console.error(`[${requestId}] RAG retrieval error:`, error);
    return [];
  }

  // 3. Rerank (simple: por similarity)
  const reranked = data
    .sort((a: any, b: any) => b.similarity - a.similarity)
    .slice(0, 5); // Top 5 finales

  return reranked.map((r: any) => ({
    content: r.content,
    similarity: r.similarity
  }));
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = `answer-${Date.now().toString(36)}`;

  try {
    const { text, intent, context, userId, useRAG } = await req.json();

    // ... validaciones ...

    // Construir mensajes
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Si es búsqueda, hacer RAG
    if (intent === 'buscar' && useRAG) {
      const ragResults = await performRAGRetrieval(text, userId, requestId);

      if (ragResults.length > 0) {
        const contextText = ragResults
          .map((r, i) => `[Fragmento ${i + 1}]:\n${r.content}`)
          .join('\n\n---\n\n');

        messages.push({
          role: 'system',
          content: `Usa SOLO el siguiente contexto para responder. Si no hay info suficiente, di "No encontré información sobre eso en tus documentos".\n\nContexto:\n${contextText}`
        });

        console.log(`[${requestId}] RAG: ${ragResults.length} chunks retrieved`);
      } else {
        console.log(`[${requestId}] RAG: no relevant chunks found`);
        messages.push({
          role: 'system',
          content: 'No encontré documentos relevantes. Responde que no tienes esa información.'
        });
      }
    }

    // Agregar contexto conversacional
    if (context && context.length > 0) {
      context.slice(-3).forEach((msg: any) => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
    }

    // Mensaje actual
    messages.push({ role: 'user', content: text });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 400
    });

    const responseText = completion.choices[0]!.message.content || 'No pude generar respuesta.';

    return new Response(JSON.stringify({
      text: responseText,
      intent,
      rag_used: intent === 'buscar' && useRAG,
      request_id: requestId,
      tokens: completion.usage?.total_tokens
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error: any) {
    // ... error handling ...
  }
}
```

**Integrar en orquestador**:

```typescript
// lib/orchestrator.ts - ACTUALIZAR handleTextMessage

async function handleTextMessage(
  conversationId: string,
  text: string,
  userId: string,
  requestId: string
): Promise<string> {
  // Detectar intención
  const intentResponse = await fetch('/api/ai/intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, userId })
  });

  const intent = await intentResponse.json();
  console.log(`[${requestId}] Intent: ${intent.intent}`);

  // Routing por intent
  if (intent.intent === 'recordatorio') {
    return await handleReminderIntent(text, userId, requestId);
  }

  // Obtener contexto conversacional
  const context = await getConversationContext(conversationId, 3);

  // Generar respuesta (con RAG si es búsqueda)
  const answerResponse = await fetch('/api/ai/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      intent: intent.intent,
      context,
      userId,
      useRAG: intent.intent === 'buscar' // Activar RAG para búsquedas
    })
  });

  const answer = await answerResponse.json();
  return answer.text || 'No pude generar una respuesta.';
}
```

**⚠️ RAG Best Practices**:
- **Chunking**: 800-1000 tokens, 100-200 overlap
- **Index**: IVFFlat con lists = sqrt(total_rows)
- **Retrieval**: Top 10 → Rerank → Top 5 para LLM
- **Threshold**: Cosine similarity > 0.7 (ajustar según datos)
- **Reranking**: Simple por similarity o usar modelo cross-encoder
- **Cost**: Query ≈ $0.00002 (embedding) + $0.01-0.02 (GPT answer)
- **Latency**: ~2-3s total (1s embedding + 1s vector search + 1s GPT)

---

### Fase 5: Documentación y Testing (continuo)

#### 5.1 OpenAPI 3.1 Specification

**Crear `docs/openapi.yaml`**:

```yaml
openapi: 3.1.0
info:
  title: migue.ai API
  description: WhatsApp AI Assistant API
  version: 1.0.0
  contact:
    name: migue.ai Support
servers:
  - url: https://migue.app/api
    description: Production
  - url: http://localhost:3000/api
    description: Development

paths:
  /whatsapp/webhook:
    get:
      summary: Webhook verification
      description: WhatsApp verification challenge
      parameters:
        - name: hub.mode
          in: query
          required: true
          schema:
            type: string
            enum: [subscribe]
        - name: hub.verify_token
          in: query
          required: true
          schema:
            type: string
        - name: hub.challenge
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Verification successful
          content:
            text/plain:
              schema:
                type: string

    post:
      summary: Receive WhatsApp messages
      description: Webhook for incoming messages and statuses
      security:
        - whatsappSignature: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/WebhookPayload'
      responses:
        '200':
          description: Message received
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  request_id:
                    type: string

  /whatsapp/send:
    post:
      summary: Send WhatsApp message
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/TextMessage'
                - $ref: '#/components/schemas/TemplateMessage'
                - $ref: '#/components/schemas/InteractiveMessage'
      responses:
        '200':
          description: Message sent
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SendResponse'

  /ai/intent:
    post:
      summary: Classify message intent
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - text
              properties:
                text:
                  type: string
                userId:
                  type: string
                  format: uuid
      responses:
        '200':
          description: Intent classified
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/IntentResponse'

  /ai/answer:
    post:
      summary: Generate answer
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnswerRequest'
      responses:
        '200':
          description: Answer generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnswerResponse'

  /ai/transcribe:
    post:
      summary: Transcribe audio
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - audioUrl
                - waMessageId
                - userId
              properties:
                audioUrl:
                  type: string
                  format: uri
                waMessageId:
                  type: string
                userId:
                  type: string
                  format: uuid
      responses:
        '200':
          description: Audio transcribed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranscriptionResponse'

  /reminders/schedule:
    post:
      summary: Schedule reminder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReminderRequest'
      responses:
        '201':
          description: Reminder created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReminderResponse'

  /reminders:
    get:
      summary: List reminders
      parameters:
        - name: userId
          in: query
          required: true
          schema:
            type: string
            format: uuid
        - name: status
          in: query
          schema:
            type: string
            enum: [all, pending, sent, failed, cancelled]
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: Reminders list
          content:
            application/json:
              schema:
                type: object
                properties:
                  reminders:
                    type: array
                    items:
                      $ref: '#/components/schemas/Reminder'
                  total:
                    type: integer
                  limit:
                    type: integer
                  offset:
                    type: integer

components:
  schemas:
    TextMessage:
      type: object
      required:
        - to
        - type
        - text
      properties:
        to:
          type: string
          description: Phone number (E.164 format)
          example: "521234567890"
        type:
          type: string
          enum: [text]
        text:
          type: object
          required:
            - body
          properties:
            body:
              type: string
              maxLength: 4096

    IntentResponse:
      type: object
      properties:
        intent:
          type: string
          enum: [recordatorio, transcribir, buscar, conversacion, clarificar]
        confidence:
          type: number
          minimum: 0
          maximum: 1
        entities:
          type: object
        request_id:
          type: string

    # ... más schemas ...

  securitySchemes:
    whatsappSignature:
      type: apiKey
      in: header
      name: X-Hub-Signature-256
      description: HMAC SHA-256 signature
```

#### 5.2 Testing Strategy

**Unit Tests (Jest)**:
```typescript
// tests/unit/chunking.test.ts
describe('Text Chunking', () => {
  test('splits text into chunks with overlap', () => {
    const text = 'A'.repeat(10000);
    const chunks = chunkText(text, { chunkSize: 800, chunkOverlap: 100 });
    expect(chunks.length).toBeGreaterThan(1);
  });
});

// tests/unit/webhook-parser.test.ts
describe('WhatsApp Webhook Parser', () => {
  test('extracts text message correctly', () => {
    const payload = { /* ... */ };
    const normalized = extractNormalizedMessage(payload);
    expect(normalized.type).toBe('text');
  });
});
```

**Integration Tests (Supertest)**:
```typescript
// tests/integration/api.test.ts
describe('API Integration', () => {
  test('POST /api/ai/intent returns valid intent', async () => {
    const response = await request(app)
      .post('/api/ai/intent')
      .send({ text: 'recuérdame llamar mañana' });

    expect(response.status).toBe(200);
    expect(response.body.intent).toBe('recordatorio');
  });
});
```

**E2E Tests (Playwright)**:
```typescript
// tests/e2e/conversation-flow.spec.ts
test('complete conversation flow', async ({ page }) => {
  // Simular mensaje entrante
  const webhookPayload = { /* ... */ };

  const response = await page.request.post('/api/whatsapp/webhook', {
    data: webhookPayload,
    headers: { 'X-Hub-Signature-256': 'sha256=...' }
  });

  expect(response.status()).toBe(200);

  // Verificar que se procesó en DB
  // Verificar que se envió respuesta
});
```

---

## 📊 Métricas de Éxito

### Técnicas
- ✅ **Latencia p95 < 2s** (texto)
- ✅ **Disponibilidad > 99.9%** (Edge + Supabase managed)
- ✅ **Error rate < 1%**
- ✅ **Test coverage > 80%** (módulos críticos)

### De Negocio
- ✅ **Costo por usuario < $2/mes**
  - WhatsApp: $0 en CSW, ~$0.50 plantillas
  - OpenAI: ~$0.50 (intent + answer + embeddings)
  - Supabase: ~$0.50 (storage + DB)
  - Vercel: ~$0.50 (functions + bandwidth)
- ✅ **Retención 30 días > 70%**
- ✅ **Satisfacción > 4.5/5**

### De Producto
- ✅ **Precisión intent > 95%**
- ✅ **Entrega de recordatorios > 99%**
- ✅ **Transcripción audio WER < 10%** (word error rate)
- ✅ **RAG relevance > 80%** (chunks relevantes)

---

## ⚠️ Decisiones Pendientes

### CRÍTICAS (responder AHORA)
1. **Next.js UI**: ¿Commitear o revertir?
2. **Cron frecuencia**: ¿Cada minuto o diario?
3. **Prioridad features**: ¿Orden de Epic 1-4?

### IMPORTANTES (responder antes de Fase 1)
4. **Cuentas externas**: ¿WhatsApp, Supabase, OpenAI listas?
5. **BMAD workflow**: ¿Usar agentes o desarrollo directo?
6. **Testing strategy**: ¿TDD o tests al final?

### MENORES (responder durante desarrollo)
7. **Templates WhatsApp**: ¿Usar o solo CSW?
8. **Audio storage**: ¿Guardar o solo transcribir?
9. **RAG scope**: ¿Solo PDFs o también imágenes?

---

## 🚀 Comandos Rápidos

```bash
# Setup inicial
npm install
npm run typecheck
vercel login
vercel link

# Desarrollo
npm run dev              # Next.js dev
npm run dev:vercel       # Vercel dev (Edge simulation)

# Testing
npm run test             # All tests
npm run test:unit        # Jest unit
npm run test:e2e         # Playwright E2E
npm run test:coverage    # Coverage report

# Deployment
git add .
git commit -m "message"
git push origin main     # Auto-deploy

# Vercel manual
vercel --prod

# BMAD workflow
@sm *draft               # Nueva historia
@dev *develop-story 1.1  # Implementar
@qa *review 1.1          # Review + gate
@po *execute-checklist   # Validar coherencia
```

---

## 📚 Recursos

### Documentación Oficial
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI API](https://platform.openai.com/docs)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

### Proyecto Interno
- `docs/VERCEL-DEPLOYMENT-FIX.md` - Edge Functions best practices
- `docs/SUPABASE.md` - Schema y RLS
- `docs/architecture.md` - Arquitectura técnica
- `.bmad-core/` - BMAD Method workflows

---

## 📝 Changelog

- **2025-01-29 v1.0**: Plan inicial completo con mejoras de OpenAI/Vercel/Supabase best practices

---

**Próximo paso**: Responder decisiones críticas y comenzar Fase 0.1