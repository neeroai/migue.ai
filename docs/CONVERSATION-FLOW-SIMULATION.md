# Simulación de Conversación WhatsApp - Reporte Detallado Paso a Paso

**Fecha**: 2025-10-05
**Sistema**: migue.ai - WhatsApp AI Assistant
**Stack**: Next.js 15 + Vercel Edge + Supabase + Multi-Provider AI

---

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Escenario 1: Mensaje de Texto "Hola"](#escenario-1-mensaje-de-texto-hola)
4. [Escenario 2: Mensaje de Audio/Voz](#escenario-2-mensaje-de-audiovoz)
5. [Escenario 3: Mensaje de Imagen/Documento](#escenario-3-mensaje-de-imagendocumento)
6. [Escenario 4: Botones Interactivos](#escenario-4-botones-interactivos)
7. [Escenario 5: Extracción de Citas](#escenario-5-extracción-de-citas)
8. [Escenario 6: Extracción de Gastos](#escenario-6-extracción-de-gastos)
9. [Escenario 7: Ubicación](#escenario-7-ubicación)
10. [Costos y Optimizaciones](#costos-y-optimizaciones)
11. [Manejo de Errores](#manejo-de-errores)

---

## Introducción

Este documento simula una conversación completa desde que un usuario envía "Hola" en WhatsApp hasta que recibe una respuesta del sistema, documentando cada paso del código que se ejecuta.

### Objetivo
Proporcionar visibilidad completa del flujo de procesamiento de mensajes, incluyendo:
- Referencias exactas a archivos y líneas de código
- Flujo de base de datos (Supabase)
- Selección de proveedores AI (Claude Sonnet 4.5, Groq Whisper, Tesseract OCR)
- Indicadores visuales (typing, reactions)
- Costos estimados por operación

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO GENERAL                                │
└─────────────────────────────────────────────────────────────────────┘

Usuario envía mensaje
        │
        ▼
WhatsApp Business API (v23.0)
        │
        ▼
Webhook POST → app/api/whatsapp/webhook/route.ts
        │
        ├─► Validación de firma (SHA-256)
        ├─► Parsing y validación Zod
        ├─► Deduplicación (60s window)
        ├─► Normalización de mensaje
        └─► Persistencia en Supabase
               │
               ▼
        Procesamiento AI (background)
               │
               ├─► Claude Sonnet 4.5 (chat)
               ├─► Groq Whisper (audio)
               └─► Tesseract OCR (imágenes)
                      │
                      ▼
               Respuesta enviada
                      │
                      ▼
               WhatsApp Business API
                      │
                      ▼
               Usuario recibe mensaje
```

---

## Escenario 1: Mensaje de Texto "Hola"

### 1.1 Usuario envía "Hola" desde WhatsApp

**Timestamp**: `2025-10-05T14:30:00.000Z`
**Número**: `+521234567890`
**Mensaje**: `"Hola"`

---

### 1.2 WhatsApp Business API envía Webhook

**URL**: `POST https://migue.app/api/whatsapp/webhook`
**Headers**:
```http
Content-Type: application/json
X-Hub-Signature-256: sha256=abc123...
```

**Payload**:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "12345",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": {
          "display_phone_number": "521234567890",
          "phone_number_id": "123456789012345"
        },
        "contacts": [{
          "profile": { "name": "Juan Pérez" },
          "wa_id": "+521234567890"
        }],
        "messages": [{
          "id": "wamid.ABC123XYZ",
          "from": "+521234567890",
          "timestamp": "1728138600",
          "type": "text",
          "text": { "body": "Hola" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

---

### 1.3 Recepción del Webhook

**Archivo**: `app/api/whatsapp/webhook/route.ts:78`
**Función**: `POST(req: Request)`

#### Paso 1.3.1: Generar Request ID
```typescript
// route.ts:79
const requestId = getRequestId()
// Resultado: "lk3j2h4-5g7h9k2l"
```

#### Paso 1.3.2: Validar Firma SHA-256
```typescript
// route.ts:83-86
const rawBody = await req.text()
const signatureOk = await validateSignature(req, rawBody)
if (!signatureOk) {
  return jsonResponse({ error: 'Invalid signature' }, 401)
}
```

**Referencias**:
- `lib/webhook-validation.ts:15` - `validateSignature()`
- Verifica header `X-Hub-Signature-256`
- Usa `WHATSAPP_APP_SECRET` de env

#### Paso 1.3.3: Parsear JSON
```typescript
// route.ts:90-95
let jsonBody: unknown
try {
  jsonBody = JSON.parse(rawBody)
} catch {
  return jsonResponse({ error: 'Invalid JSON body' }, 400)
}
```

#### Paso 1.3.4: Validar con Zod Schema
```typescript
// route.ts:98-112
const validationResult = safeValidateWebhookPayload(jsonBody)
if (!validationResult.success) {
  logger.warn('[webhook] Validation failed', {
    requestId,
    metadata: { issues: validationResult.error.issues.slice(0, 3) }
  })
  return jsonResponse({
    error: 'Invalid webhook payload',
    request_id: requestId,
    issues: validationResult.error.issues.slice(0, 3)
  }, 400)
}
```

**Referencias**:
- `types/schemas.ts:251` - `safeValidateWebhookPayload()`
- `types/schemas.ts:218` - `WebhookPayloadSchema`
- Valida estructura completa del payload

#### Paso 1.3.5: Extraer Mensaje
```typescript
// route.ts:115-119
const payload = validationResult.data
const message = extractFirstMessage(payload)
if (!message) {
  return jsonResponse({ status: 'ignored', reason: 'no message' }, 200)
}
```

**Referencias**:
- `types/schemas.ts:267` - `extractFirstMessage()`
- Extrae primer mensaje del array `messages`

**Resultado**:
```typescript
message = {
  id: "wamid.ABC123XYZ",
  from: "+521234567890",
  timestamp: "1728138600",
  type: "text",
  text: { body: "Hola" }
}
```

---

### 1.4 Deduplicación

#### Paso 1.4.1: Verificar Duplicados
```typescript
// route.ts:122-131
if (isDuplicateWebhook(message.id)) {
  logger.info('[webhook] Duplicate webhook detected', {
    requestId,
    metadata: { messageId: message.id }
  })
  return jsonResponse({ status: 'duplicate', message_id: message.id }, 200)
}
```

**Referencias**:
- `route.ts:44` - `isDuplicateWebhook()`
- `route.ts:38` - Cache `processedWebhooks` (Map)
- Ventana de 60 segundos (1 minuto)

**Lógica**:
```typescript
// route.ts:44-66
const now = Date.now()
const second = Math.floor(now / 1000)

if (processedWebhooks.has(messageId)) {
  const processedAt = processedWebhooks.get(messageId)!
  if (now - processedAt < DEDUP_WINDOW_MS) { // 60000ms
    return true // Es duplicado
  }
}

// Marcar como procesado
processedWebhooks.set(messageId, now)

// Limpieza automática
for (const [id, timestamp] of processedWebhooks) {
  if (now - timestamp > DEDUP_WINDOW_MS) {
    processedWebhooks.delete(id)
  }
}
```

---

### 1.5 Normalización del Mensaje

#### Paso 1.5.1: Convertir a Formato Normalizado
```typescript
// route.ts:134
const normalized = whatsAppMessageToNormalized(message)
```

**Referencias**:
- `lib/message-normalization.ts:34` - `whatsAppMessageToNormalized()`

**Proceso**:
```typescript
// message-normalization.ts:34-80
export function whatsAppMessageToNormalized(message: WhatsAppMessage): NormalizedMessage {
  const type = message.type           // "text"
  const from = message.from           // "+521234567890"
  const timestamp = Number(message.timestamp) * 1000  // 1728138600000
  let content: string | null = null
  let mediaUrl: string | null = null

  // Extraer contenido según tipo
  if (type === 'text' && message.text) {
    content = message.text.body       // "Hola"
  }

  return {
    from,
    type,
    content,
    mediaUrl,
    waMessageId: message.id,          // "wamid.ABC123XYZ"
    conversationId: undefined,         // Se asigna luego
    timestamp,
    raw: message
  }
}
```

**Resultado**:
```typescript
normalized = {
  from: "+521234567890",
  type: "text",
  content: "Hola",
  mediaUrl: null,
  waMessageId: "wamid.ABC123XYZ",
  conversationId: undefined,
  timestamp: 1728138600000,
  raw: { /* objeto completo */ }
}
```

---

### 1.6 Persistencia en Base de Datos (Supabase)

#### Paso 1.6.1: Persistir Mensaje Normalizado
```typescript
// route.ts:139-154
let conversationId: string
let userId: string
try {
  const result = await persistNormalizedMessage(normalized)
  if (!result) {
    return jsonResponse({ status: 'ignored', reason: 'persist failed' }, 200)
  }
  conversationId = result.conversationId
  userId = result.userId
} catch (persistErr: any) {
  return jsonResponse({ error: 'DB error', detail: persistErr?.message }, 500)
}
```

**Referencias**:
- `lib/message-normalization.ts:113` - `persistNormalizedMessage()`

#### Paso 1.6.2: Upsert Usuario
```typescript
// lib/persist.ts:4-13
export async function upsertUserByPhone(phoneNumber: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('users')
    .upsert({ phone_number: phoneNumber }, { onConflict: 'phone_number' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string  // "uuid-user-123"
}
```

**SQL ejecutado**:
```sql
INSERT INTO users (phone_number)
VALUES ('+521234567890')
ON CONFLICT (phone_number) DO UPDATE SET phone_number = EXCLUDED.phone_number
RETURNING id;
```

**Resultado**: `userId = "550e8400-e29b-41d4-a716-446655440000"`

#### Paso 1.6.3: Obtener o Crear Conversación
```typescript
// lib/persist.ts:15-48
export async function getOrCreateConversation(userId: string, waConversationId?: string) {
  const supabase = getSupabaseServerClient()

  // 1. Buscar por WA conversation ID (si existe)
  if (waConversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('wa_conversation_id', waConversationId)
      .limit(1)
      .maybeSingle()
    if (data?.id) return data.id as string
  }

  // 2. Buscar conversación activa del usuario
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  if (existingConv?.id) return existingConv.id as string

  // 3. Crear nueva conversación
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, wa_conversation_id: waConversationId ?? null, status: 'active' })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}
```

**SQL ejecutado** (si es nueva):
```sql
INSERT INTO conversations (user_id, wa_conversation_id, status)
VALUES ('550e8400-e29b-41d4-a716-446655440000', NULL, 'active')
RETURNING id;
```

**Resultado**: `conversationId = "660e8400-e29b-41d4-a716-446655440001"`

#### Paso 1.6.4: Insertar Mensaje Inbound
```typescript
// lib/persist.ts:50-63
export async function insertInboundMessage(conversationId: string, msg: NormalizedMessage) {
  const supabase = getSupabaseServerClient()
  const payload = {
    conversation_id: conversationId,
    direction: 'inbound' as const,
    type: (msg.type ?? 'text') as 'text' | 'image' | 'audio' | ...,
    content: msg.content,
    media_url: msg.mediaUrl,
    wa_message_id: msg.waMessageId ?? null,
    timestamp: new Date(msg.timestamp).toISOString()
  }
  const { error } = await supabase.from('messages_v2').insert(payload)
  if (error) throw error
}
```

**SQL ejecutado**:
```sql
INSERT INTO messages_v2 (
  conversation_id,
  direction,
  type,
  content,
  media_url,
  wa_message_id,
  timestamp
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'inbound',
  'text',
  'Hola',
  NULL,
  'wamid.ABC123XYZ',
  '2025-10-05T14:30:00.000Z'
);
```

**Tablas afectadas**:
```
users
  ├─ id: 550e8400-e29b-41d4-a716-446655440000
  ├─ phone_number: +521234567890
  └─ created_at: 2025-10-05T14:30:00.000Z

conversations
  ├─ id: 660e8400-e29b-41d4-a716-446655440001
  ├─ user_id: 550e8400-e29b-41d4-a716-446655440000
  ├─ wa_conversation_id: NULL
  ├─ status: active
  └─ created_at: 2025-10-05T14:30:00.000Z

messages_v2
  ├─ id: 770e8400-e29b-41d4-a716-446655440002
  ├─ conversation_id: 660e8400-e29b-41d4-a716-446655440001
  ├─ direction: inbound
  ├─ type: text
  ├─ content: Hola
  ├─ media_url: NULL
  ├─ wa_message_id: wamid.ABC123XYZ
  └─ timestamp: 2025-10-05T14:30:00.000Z
```

---

### 1.7 Procesamiento AI (Background - Fire and Forget)

#### Paso 1.7.1: Lanzar Procesamiento Asíncrono
```typescript
// route.ts:194-208
if (normalized.content && normalized.from) {
  processMessageWithAI(
    conversationId,
    userId,
    normalized.from,
    normalized.content,
    normalized.waMessageId
  ).catch((err) => {
    logger.error('Background AI processing failed', err, {
      requestId,
      conversationId,
      userId
    })
  })
}
```

**Referencias**:
- `lib/ai-processing-v2.ts:73` - `processMessageWithAI()`
- Ejecuta en background (no bloquea respuesta del webhook)
- Webhook retorna `200 OK` inmediatamente

#### Paso 1.7.2: Retornar Respuesta al Webhook
```typescript
// route.ts:282
return jsonResponse({ success: true, request_id: requestId })
```

**Respuesta HTTP**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "request_id": "lk3j2h4-5g7h9k2l"
}
```

**Tiempo total hasta aquí**: ~150-300ms

---

### 1.8 Procesamiento AI con Claude (Background)

#### Paso 1.8.1: Iniciar Typing Manager
```typescript
// ai-processing-v2.ts:80-89
const typingManager = createTypingManager(userPhone, messageId)
const providerManager = getProviderManager()

try {
  // Marcar como leído
  await markAsRead(messageId)

  // Reacción "pensando"
  await reactWithThinking(userPhone, messageId)

  // Iniciar typing
  await typingManager.start()
```

**Referencias**:
- `lib/whatsapp.ts:551` - `createTypingManager()`
- `lib/whatsapp.ts:602` - `markAsRead()`
- `lib/whatsapp.ts:662` - `reactWithThinking()`

**API Calls WhatsApp**:

**1. Mark as Read**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.ABC123XYZ"
}
```

**2. React with Thinking**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages
{
  "messaging_product": "whatsapp",
  "to": "+521234567890",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.ABC123XYZ",
    "emoji": "🤔"
  }
}
```

**3. Start Typing**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages
{
  "messaging_product": "whatsapp",
  "status": "read",
  "message_id": "wamid.ABC123XYZ",
  "typing_indicator": {
    "type": "text"
  }
}
```

**Efecto en WhatsApp**:
- Mensaje marcado como leído ✓✓
- Emoji 🤔 aparece en el mensaje del usuario
- Indicador "escribiendo..." visible por 25 segundos (o hasta enviar mensaje)

#### Paso 1.8.2: Obtener Historial de Conversación
```typescript
// ai-processing-v2.ts:92-93
const history = await getConversationHistory(conversationId, 10)
const claudeHistory = historyToClaudeMessages(history)
```

**Referencias**:
- `lib/context.ts:16` - `getConversationHistory()`
- `lib/ai-processing-v2.ts:41` - `historyToClaudeMessages()`

**SQL ejecutado**:
```sql
SELECT id, direction, type, content, timestamp
FROM messages_v2
WHERE conversation_id = '660e8400-e29b-41d4-a716-446655440001'
ORDER BY timestamp DESC
LIMIT 10;
```

**Resultado** (primera conversación):
```typescript
history = []  // Array vacío (nuevo usuario)

claudeHistory = []  // Array vacío convertido a formato Claude
```

#### Paso 1.8.3: Intentar Agentes Especializados

**Referencias**:
- `lib/claude-agents.ts:31` - `ProactiveAgent`
- `lib/claude-agents.ts:103` - `SchedulingAgent`
- `lib/claude-agents.ts:196` - `FinanceAgent`

**1. SchedulingAgent - Extraer Cita**:
```typescript
// ai-processing-v2.ts:96-100
const schedulingAgent = createSchedulingAgent()
const financeAgent = createFinanceAgent()

// Intentar extraer cita
const appointment = await schedulingAgent.extractAppointment(userMessage)
```

**Proceso interno** (`claude-agents.ts:138-189`):
```typescript
const client = getClaudeClient()  // Anthropic SDK

const response = await client.messages.create({
  model: 'claude-opus-4',      // Modelo más preciso para extracción
  max_tokens: 512,
  temperature: 0.1,            // Baja temperatura para precisión
  system: `Eres un agente especializado en gestión de citas...`,
  messages: [{
    role: 'user',
    content: `Extrae la información de cita de este mensaje. Si no hay información clara de cita, responde "NO_APPOINTMENT".

Mensaje: "Hola"`
  }]
})
```

**API Call a Claude**:
```http
POST https://api.anthropic.com/v1/messages
Content-Type: application/json
x-api-key: sk-ant-api03-xxx

{
  "model": "claude-opus-4",
  "max_tokens": 512,
  "temperature": 0.1,
  "system": "Eres un agente especializado en gestión de citas...",
  "messages": [
    {
      "role": "user",
      "content": "Extrae la información de cita de este mensaje. Si no hay información clara de cita, responde \"NO_APPOINTMENT\".\n\nMensaje: \"Hola\""
    }
  ]
}
```

**Respuesta de Claude**:
```json
{
  "id": "msg_01ABC123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "NO_APPOINTMENT"
    }
  ],
  "model": "claude-opus-4",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 145,
    "output_tokens": 3
  }
}
```

**Resultado**:
```typescript
appointment = null  // No hay cita en "Hola"
```

**2. FinanceAgent - Extraer Gasto**:
```typescript
// ai-processing-v2.ts:121-122
const expense = await financeAgent.extractExpense(userMessage)
```

**Proceso similar a SchedulingAgent**:
```typescript
// claude-agents.ts:234-284
const response = await client.messages.create({
  model: 'claude-sonnet-4-5',  // Modelo más económico
  max_tokens: 256,
  temperature: 0.1,
  system: `Eres un agente especializado en control de gastos...`,
  messages: [{
    role: 'user',
    content: `Extrae información de gasto de este mensaje. Si no hay información de gasto, responde "NO_EXPENSE".

Mensaje: "Hola"`
  }]
})
```

**Respuesta de Claude**:
```
NO_EXPENSE
```

**Resultado**:
```typescript
expense = null  // No hay gasto en "Hola"
```

#### Paso 1.8.4: Usar ProactiveAgent (Default)
```typescript
// ai-processing-v2.ts:143-147
const proactiveAgent = createProactiveAgent()
const response = await proactiveAgent.respond(userMessage, claudeHistory)

await sendTextAndPersist(conversationId, userPhone, response)
await reactWithCheck(userPhone, messageId)
```

**Referencias**:
- `lib/claude-agents.ts:61` - `ProactiveAgent.respond()`

**Proceso interno**:
```typescript
// claude-agents.ts:61-96
async respond(userMessage: string, conversationHistory: ClaudeMessage[]): Promise<string> {
  const client = getClaudeClient()

  const messages: ClaudeMessage[] = [
    ...conversationHistory,  // [] (vacío en primera conversación)
    {
      role: 'user',
      content: userMessage   // "Hola"
    }
  ]

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',  // 75% más barato que GPT-4o
    max_tokens: 1024,
    temperature: 0.7,            // Más creativo para conversación
    system: `Eres Migue, un asistente personal proactivo en WhatsApp.

Tu misión es ayudar al usuario con:
- Gestión de citas y calendario
- Recordatorios inteligentes
- Control de gastos
- Programación de mensajes
- Procesamiento de audios, imágenes y documentos

Características clave:
1. PROACTIVO: Anticipa necesidades, sugiere optimizaciones
2. CONVERSACIONAL: Respuestas naturales, cercanas, en español
3. CONTEXTUAL: Recuerda conversaciones previas
4. EFICIENTE: Respuestas concisas y accionables`,
    messages
  })

  const content = response.content[0]
  if (content?.type === 'text') {
    return content.text.trim()
  }
}
```

**API Call a Claude**:
```http
POST https://api.anthropic.com/v1/messages
Content-Type: application/json
x-api-key: sk-ant-api03-xxx

{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1024,
  "temperature": 0.7,
  "system": "Eres Migue, un asistente personal proactivo en WhatsApp...",
  "messages": [
    {
      "role": "user",
      "content": "Hola"
    }
  ]
}
```

**Respuesta de Claude**:
```json
{
  "id": "msg_01XYZ789",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "¡Hola! 👋 Soy Migue, tu asistente personal.\n\n¿En qué puedo ayudarte hoy? Puedo:\n\n✅ Agendar citas y recordatorios\n💰 Registrar y analizar gastos\n📝 Programar mensajes\n🎙️ Transcribir audios\n📄 Analizar documentos e imágenes\n\n¿Qué necesitas?"
    }
  ],
  "model": "claude-sonnet-4-5",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 248,
    "output_tokens": 95
  }
}
```

**Resultado**:
```typescript
response = "¡Hola! 👋 Soy Migue, tu asistente personal.\n\n¿En qué puedo ayudarte hoy? Puedo:\n\n✅ Agendar citas y recordatorios\n💰 Registrar y analizar gastos\n📝 Programar mensajes\n🎙️ Transcribir audios\n📄 Analizar documentos e imágenes\n\n¿Qué necesitas?"
```

#### Paso 1.8.5: Enviar Respuesta y Persistir
```typescript
// ai-processing-v2.ts:54-67
async function sendTextAndPersist(
  conversationId: string,
  userPhone: string,
  response: string
) {
  const waMessageId = await sendWhatsAppText(userPhone, response)
  if (waMessageId) {
    await insertOutboundMessage(conversationId, response, waMessageId)
  } else {
    await insertOutboundMessage(conversationId, response)
  }
  return waMessageId
}
```

**API Call WhatsApp**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages
{
  "messaging_product": "whatsapp",
  "to": "+521234567890",
  "type": "text",
  "text": {
    "body": "¡Hola! 👋 Soy Migue, tu asistente personal.\n\n¿En qué puedo ayudarte hoy? Puedo:\n\n✅ Agendar citas y recordatorios\n💰 Registrar y analizar gastos\n📝 Programar mensajes\n🎙️ Transcribir audios\n📄 Analizar documentos e imágenes\n\n¿Qué necesitas?"
  }
}
```

**Respuesta WhatsApp API**:
```json
{
  "messaging_product": "whatsapp",
  "contacts": [{
    "input": "+521234567890",
    "wa_id": "521234567890"
  }],
  "messages": [{
    "id": "wamid.XYZ789ABC"
  }]
}
```

**Resultado**:
```typescript
waMessageId = "wamid.XYZ789ABC"
```

**SQL ejecutado**:
```sql
INSERT INTO messages_v2 (
  conversation_id,
  direction,
  type,
  content,
  media_url,
  wa_message_id,
  timestamp
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  'outbound',
  'text',
  '¡Hola! 👋 Soy Migue...',
  NULL,
  'wamid.XYZ789ABC',
  '2025-10-05T14:30:02.450Z'
);
```

#### Paso 1.8.6: React with Check
```typescript
// ai-processing-v2.ts:147
await reactWithCheck(userPhone, messageId)
```

**API Call WhatsApp**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages
{
  "messaging_product": "whatsapp",
  "to": "+521234567890",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.ABC123XYZ",
    "emoji": "✅"
  }
}
```

**Efecto**: Emoji 🤔 cambia a ✅

#### Paso 1.8.7: Tracking de Costos
```typescript
// ai-processing-v2.ts:149-154
providerManager.trackSpending(
  PROVIDER_COSTS.chat.claude,  // $0.0003
  'claude',
  'chat'
)
```

**Referencias**:
- `lib/ai-providers.ts:141` - `trackSpending()`
- `lib/ai-providers.ts:33` - `PROVIDER_COSTS`

**Log generado**:
```typescript
logger.info('Cost tracked', {
  metadata: {
    provider: 'claude',
    task: 'chat',
    amount: '$0.0003',
    dailyTotal: '$0.0003',
    remaining: '$9.9997'
  }
})
```

#### Paso 1.8.8: Detener Typing
```typescript
// ai-processing-v2.ts:183
finally {
  await typingManager.stop()
}
```

**Efecto**: Indicador "escribiendo..." desaparece (automáticamente al enviar mensaje)

---

### 1.9 Usuario Recibe Respuesta

**Tiempo total de procesamiento**: ~2-3 segundos

**Timeline visual**:
```
t=0ms       Usuario envía "Hola"
t=150ms     Webhook procesado, mensaje guardado en DB
t=200ms     Typing indicator inicia 🤔
t=500ms     Claude API llamada
t=2500ms    Claude responde
t=2600ms    Mensaje enviado a WhatsApp
t=2650ms    Usuario recibe: "¡Hola! 👋 Soy Migue..."
t=2700ms    ✅ reaction actualizada
```

**Estado final en base de datos**:
```
messages_v2:
  ├─ [1] Inbound:  "Hola" (14:30:00.000)
  └─ [2] Outbound: "¡Hola! 👋 Soy Migue..." (14:30:02.450)
```

---

## Escenario 2: Mensaje de Audio/Voz

### 2.1 Usuario envía audio de voz

**Tipo**: `audio` o `voice`
**Duración**: 15 segundos
**Formato**: OGG Opus

**Webhook payload**:
```json
{
  "messages": [{
    "id": "wamid.AUDIO123",
    "from": "+521234567890",
    "timestamp": "1728138650",
    "type": "audio",
    "audio": {
      "id": "media_abc123",
      "mime_type": "audio/ogg; codecs=opus",
      "sha256": "abc123hash"
    }
  }]
}
```

---

### 2.2 Procesamiento (route.ts:211-223)

```typescript
// route.ts:211-223
if (
  (normalized.type === 'audio' || normalized.type === 'voice') &&
  normalized.mediaUrl &&
  normalized.from
) {
  processAudioMessage(conversationId, userId, normalized).catch((err) => {
    logger.error('Background audio processing failed', err)
  })
}
```

---

### 2.3 Descarga y Transcripción con Groq

**Referencias**: `lib/ai-processing-v2.ts:190`

#### Paso 2.3.1: Download Media
```typescript
// ai-processing-v2.ts:211-212
const audioResponse = await fetch(normalized.mediaUrl)
const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())
```

**Flujo interno**:
1. `normalized.mediaUrl` es el `media_id` de WhatsApp
2. Se resuelve a URL real via WhatsApp Media API:

```typescript
// lib/whatsapp.ts:716-723
export async function resolveMediaUrl(mediaId: string, token: string) {
  const res = await fetchGraphResource(mediaId, token)
  const body = await res.json() as { url?: string; mime_type?: string }
  return { url: body.url, mimeType: body.mime_type }
}
```

**API Calls**:
```http
GET https://graph.facebook.com/v23.0/media_abc123
Authorization: Bearer <WHATSAPP_TOKEN>

Response:
{
  "url": "https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...",
  "mime_type": "audio/ogg; codecs=opus",
  "sha256": "abc123hash",
  "file_size": 23456
}
```

```http
GET https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=...
Authorization: Bearer <WHATSAPP_TOKEN>

Response: [binary audio data]
```

#### Paso 2.3.2: Transcribe with Groq (93% cheaper!)
```typescript
// ai-processing-v2.ts:215-219
const audioFile = bufferToFile(audioBuffer, 'audio.ogg', 'audio/ogg')
const transcript = await transcribeWithGroq(audioFile, {
  model: 'whisper-large-v3',
  language: 'es'
})
```

**Referencias**:
- `lib/groq-client.ts:22` - `transcribeWithGroq()`
- `lib/groq-client.ts:40` - `bufferToFile()`

**Proceso interno**:
```typescript
// groq-client.ts:22-38
export async function transcribeWithGroq(
  audioFile: File,
  options: TranscriptionOptions = {}
): Promise<string> {
  const groq = getGroqClient()

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: options.model || 'whisper-large-v3',
    language: options.language || 'es',
    response_format: 'json',
    temperature: options.temperature || 0.0
  })

  return transcription.text
}
```

**API Call a Groq**:
```http
POST https://api.groq.com/openai/v1/audio/transcriptions
Authorization: Bearer <GROQ_API_KEY>
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="audio.ogg"
Content-Type: audio/ogg

[binary audio data]
--boundary
Content-Disposition: form-data; name="model"

whisper-large-v3
--boundary
Content-Disposition: form-data; name="language"

es
--boundary
Content-Disposition: form-data; name="response_format"

json
--boundary--
```

**Respuesta de Groq**:
```json
{
  "text": "Hola, quiero agendar una cita para el doctor mañana a las 3 de la tarde"
}
```

**Resultado**:
```typescript
transcript = "Hola, quiero agendar una cita para el doctor mañana a las 3 de la tarde"
```

#### Paso 2.3.3: Update Message with Transcript
```typescript
// ai-processing-v2.ts:222-224
await updateInboundMessageByWaId(normalized.waMessageId, {
  content: transcript
})
```

**SQL ejecutado**:
```sql
UPDATE messages_v2
SET content = 'Hola, quiero agendar una cita para el doctor mañana a las 3 de la tarde'
WHERE wa_message_id = 'wamid.AUDIO123';
```

#### Paso 2.3.4: Process Transcribed Text
```typescript
// ai-processing-v2.ts:226-233
await processMessageWithAI(
  conversationId,
  userId,
  normalized.from,
  transcript,
  normalized.waMessageId
)
```

**Flujo**: Continúa igual que Escenario 1 (paso 1.8) pero con el texto transcrito

**Agente detectado**: `SchedulingAgent`

**Extraction result**:
```json
{
  "title": "Cita con el doctor",
  "date": "2025-10-06",
  "time": "15:00",
  "duration": 60
}
```

**Respuesta enviada**:
```
✅ Cita agendada: "Cita con el doctor"
📅 Fecha: 2025-10-06
⏰ Hora: 15:00

Te enviaré recordatorios 1 día antes y 1 hora antes.
```

#### Paso 2.3.5: Track Cost (Groq savings!)
```typescript
// ai-processing-v2.ts:236-247
const durationMinutes = 1  // Assume 1 min average
providerManager.trackSpending(
  PROVIDER_COSTS.transcription.groq * durationMinutes,  // $0.0008
  'groq',
  'transcription'
)

logger.info('Audio processed with Groq', {
  metadata: {
    transcript: transcript.slice(0, 100),
    savings: `$${(PROVIDER_COSTS.transcription.openai - PROVIDER_COSTS.transcription.groq).toFixed(4)}`
  }
})
```

**Log**:
```json
{
  "message": "Audio processed with Groq",
  "metadata": {
    "transcript": "Hola, quiero agendar una cita para el doctor mañana a las 3 de la tarde",
    "savings": "$0.0052"
  }
}
```

**Costo total**:
- Groq Whisper: $0.0008 (15 seg ≈ 0.25 min)
- Claude Opus (extraction): $0.0003
- **Total**: $0.0011 vs OpenAI ($0.0067) = **84% savings!**

---

## Escenario 3: Mensaje de Imagen/Documento

### 3.1 Usuario envía imagen con texto

**Tipo**: `image`
**Contenido**: Foto de un recibo con texto

**Webhook payload**:
```json
{
  "messages": [{
    "id": "wamid.IMAGE123",
    "from": "+521234567890",
    "timestamp": "1728138700",
    "type": "image",
    "image": {
      "id": "media_img456",
      "mime_type": "image/jpeg",
      "sha256": "img789hash",
      "caption": "Mi recibo de la comida"
    }
  }]
}
```

---

### 3.2 Procesamiento (route.ts:226-238)

```typescript
// route.ts:226-238
if (
  (normalized.type === 'document' || normalized.type === 'image') &&
  normalized.mediaUrl &&
  normalized.from
) {
  processDocumentMessage(conversationId, userId, normalized).catch((err) => {
    logger.error('Background document processing failed', err)
  })
}
```

---

### 3.3 OCR con Tesseract (100% FREE!)

**Referencias**: `lib/ai-processing-v2.ts:283`

#### Paso 3.3.1: Download Image
```typescript
// ai-processing-v2.ts:304-305
const imageResponse = await fetch(normalized.mediaUrl)
const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())
```

Similar al flujo de audio (paso 2.3.1)

#### Paso 3.3.2: Extract Text with Tesseract
```typescript
// ai-processing-v2.ts:307-313
// Lazy load Tesseract (saves 2MB from bundle)
const { extractTextFromImage } = await import('./tesseract-ocr')

const extractedText = await extractTextFromImage(imageBuffer, {
  language: 'spa+eng'
})
```

**Referencias**: `lib/tesseract-ocr.ts:15`

**Proceso interno**:
```typescript
// tesseract-ocr.ts:15-35
import Tesseract from 'tesseract.js'

export async function extractTextFromImage(
  imageBuffer: Buffer,
  options: OCROptions = {}
): Promise<string> {
  const { data: { text } } = await Tesseract.recognize(
    imageBuffer,
    options.language || 'eng',
    {
      logger: (info) => {
        if (info.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.floor(info.progress * 100)}%`)
        }
      }
    }
  )

  return text.trim()
}
```

**Resultado** (ejemplo de recibo):
```typescript
extractedText = `RESTAURANTE LA CASA
Av. Reforma 123
Ciudad de México

MESA: 5
MESERO: Juan

1x Hamburguesa      $150.00
1x Refresco         $35.00
1x Papas            $45.00
              ___________
SUBTOTAL:           $230.00
PROPINA (10%):      $23.00
              ___________
TOTAL:              $253.00

GRACIAS POR SU VISITA`
```

#### Paso 3.3.3: Comprehension with Claude
```typescript
// ai-processing-v2.ts:316-323
const proactiveAgent = createProactiveAgent()
const history = await getConversationHistory(conversationId, 5)
const claudeHistory = historyToClaudeMessages(history)

const comprehension = await proactiveAgent.respond(
  `El usuario envió una imagen con este texto: "${extractedText}". Analiza y responde de forma útil.`,
  claudeHistory
)
```

**API Call a Claude**:
```http
POST https://api.anthropic.com/v1/messages

{
  "model": "claude-sonnet-4-5",
  "max_tokens": 1024,
  "temperature": 0.7,
  "system": "Eres Migue, un asistente personal proactivo...",
  "messages": [
    {
      "role": "user",
      "content": "El usuario envió una imagen con este texto: \"RESTAURANTE LA CASA...\". Analiza y responde de forma útil."
    }
  ]
}
```

**Respuesta de Claude**:
```
Veo que enviaste un recibo de RESTAURANTE LA CASA 🍔

Total: $253.00 MXN
- Hamburguesa: $150
- Refresco: $35
- Papas: $45
- Propina: $23

¿Quieres que registre este gasto? Puedo categorizarlo como "Alimentación" y guardarlo en tu historial de gastos.
```

#### Paso 3.3.4: Send Response
```typescript
// ai-processing-v2.ts:326-327
await sendTextAndPersist(conversationId, normalized.from, comprehension)
await reactWithCheck(normalized.from, normalized.waMessageId)
```

#### Paso 3.3.5: Update Message
```typescript
// ai-processing-v2.ts:330-332
await updateInboundMessageByWaId(normalized.waMessageId, {
  content: extractedText.slice(0, 5000)
})
```

**SQL ejecutado**:
```sql
UPDATE messages_v2
SET content = 'RESTAURANTE LA CASA\nAv. Reforma 123...'
WHERE wa_message_id = 'wamid.IMAGE123';
```

#### Paso 3.3.6: Track Cost (FREE!)
```typescript
// ai-processing-v2.ts:335-342
providerManager.trackSpending(0, 'tesseract', 'ocr')

logger.info('Document processed with Tesseract + Claude', {
  metadata: {
    textLength: extractedText.length,
    savings: '$0.002 (100% free OCR)'
  }
})
```

**Costo total**:
- Tesseract OCR: $0.00 (FREE!)
- Claude Sonnet (comprehension): $0.0003
- **Total**: $0.0003 vs OpenAI Vision ($0.002) = **85% savings!**

---

## Escenario 4: Botones Interactivos

### 4.1 Sistema envía botones

**Contexto**: Usuario pregunta "¿Qué puedes hacer?"

**Respuesta con botones**:
```typescript
await sendInteractiveButtons(
  userPhone,
  '¿En qué te puedo ayudar?',
  [
    { id: 'help_appointments', title: '📅 Citas' },
    { id: 'help_expenses', title: '💰 Gastos' },
    { id: 'help_reminders', title: '⏰ Recordatorios' }
  ],
  {
    header: 'Migue AI Assistant',
    footer: 'Selecciona una opción'
  }
)
```

**Referencias**: `lib/whatsapp.ts:183`

**API Call WhatsApp**:
```http
POST https://graph.facebook.com/v23.0/123456789012345/messages

{
  "messaging_product": "whatsapp",
  "to": "+521234567890",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "header": {
      "type": "text",
      "text": "Migue AI Assistant"
    },
    "body": {
      "text": "¿En qué te puedo ayudar?"
    },
    "footer": {
      "text": "Selecciona una opción"
    },
    "action": {
      "buttons": [
        {
          "type": "reply",
          "reply": {
            "id": "help_appointments",
            "title": "📅 Citas"
          }
        },
        {
          "type": "reply",
          "reply": {
            "id": "help_expenses",
            "title": "💰 Gastos"
          }
        },
        {
          "type": "reply",
          "reply": {
            "id": "help_reminders",
            "title": "⏰ Recordatorios"
          }
        }
      ]
    }
  }
}
```

---

### 4.2 Usuario presiona botón

**Acción**: Usuario toca "📅 Citas"

**Webhook recibido**:
```json
{
  "messages": [{
    "id": "wamid.BUTTON123",
    "from": "+521234567890",
    "timestamp": "1728138750",
    "type": "interactive",
    "interactive": {
      "type": "button_reply",
      "button_reply": {
        "id": "help_appointments",
        "title": "📅 Citas"
      }
    }
  }]
}
```

---

### 4.3 Procesamiento de Interactive Reply

#### Paso 4.3.1: Extract Interactive Reply
```typescript
// route.ts:157-191
const interactiveReply = extractInteractiveReply(normalized.raw)
let actionDefinition = null

if (interactiveReply) {
  actionDefinition = getActionDefinition(interactiveReply.id)

  // Log conversation action
  await recordConversationAction({
    conversationId,
    userId,
    actionId: interactiveReply.id,
    actionType: actionDefinition?.category ?? 'interactive',
    payload: {
      title: interactiveReply.title,
      description: interactiveReply.description
    }
  })

  // Replace message content
  if (actionDefinition?.replacementMessage) {
    normalized.content = actionDefinition.replacementMessage
  } else if (!actionDefinition && interactiveReply.title) {
    normalized.content = interactiveReply.title
  }

  if (!normalized.content) {
    normalized.content = interactiveReply.id
  }

  normalized.type = 'text'
}
```

**Referencias**:
- `lib/message-normalization.ts:85` - `extractInteractiveReply()`
- `lib/actions.ts:20` - `getActionDefinition()`
- `lib/conversation-actions.ts:10` - `recordConversationAction()`

**Resultado**:
```typescript
interactiveReply = {
  id: 'help_appointments',
  title: '📅 Citas',
  description: undefined
}

actionDefinition = {
  id: 'help_appointments',
  category: 'help',
  replacementMessage: 'Quiero información sobre citas',
  handler: async (context) => { /* ... */ }
}

normalized.content = 'Quiero información sobre citas'
normalized.type = 'text'
```

#### Paso 4.3.2: Record Action in Database
```typescript
// conversation-actions.ts:10-29
const supabase = getSupabaseServerClient()
await supabase.from('conversation_actions').insert({
  conversation_id: conversationId,
  user_id: userId,
  action_type: 'help',
  payload: {
    action_id: 'help_appointments',
    title: '📅 Citas',
    description: undefined
  }
})
```

**SQL ejecutado**:
```sql
INSERT INTO conversation_actions (
  conversation_id,
  user_id,
  action_type,
  payload
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  'help',
  '{
    "action_id": "help_appointments",
    "title": "📅 Citas"
  }'
);
```

#### Paso 4.3.3: Process as Text Message
```typescript
// route.ts:194-208
if (normalized.content && normalized.from) {
  processMessageWithAI(
    conversationId,
    userId,
    normalized.from,
    'Quiero información sobre citas',  // replaced content
    normalized.waMessageId
  ).catch((err) => { /* ... */ })
}
```

**Respuesta del ProactiveAgent**:
```
¡Claro! Te ayudo con las citas 📅

Puedo ayudarte a:

✅ Agendar nuevas citas
📝 Ver tus próximas citas
🔄 Reprogramar o cancelar
⏰ Configurar recordatorios

Para agendar una cita, solo dime:
- ¿Qué tipo de cita? (doctor, reunión, etc.)
- ¿Qué día?
- ¿A qué hora?

Por ejemplo: "Agendar cita con el dentista el viernes a las 10am"
```

---

## Escenario 5: Extracción de Citas

### 5.1 Usuario envía mensaje con cita

**Mensaje**: "Necesito agendar una cita con el dentista el próximo viernes 10 de octubre a las 10 de la mañana"

---

### 5.2 SchedulingAgent Extraction

**Referencias**: `lib/ai-processing-v2.ts:96-118`

#### Paso 5.2.1: Extract Appointment
```typescript
// ai-processing-v2.ts:100
const appointment = await schedulingAgent.extractAppointment(userMessage)
```

**API Call a Claude Opus**:
```http
POST https://api.anthropic.com/v1/messages

{
  "model": "claude-opus-4",
  "max_tokens": 512,
  "temperature": 0.1,
  "system": "Eres un agente especializado en gestión de citas...",
  "messages": [{
    "role": "user",
    "content": "Extrae la información de cita de este mensaje. Si no hay información clara de cita, responde \"NO_APPOINTMENT\".\n\nMensaje: \"Necesito agendar una cita con el dentista el próximo viernes 10 de octubre a las 10 de la mañana\""
  }]
}
```

**Respuesta de Claude**:
```json
{
  "title": "Cita con el dentista",
  "date": "2025-10-10",
  "time": "10:00",
  "duration": 60,
  "reminders": ["-1day", "-1hour"]
}
```

#### Paso 5.2.2: Send Confirmation
```typescript
// ai-processing-v2.ts:102-117
if (appointment) {
  const response = `✅ Cita agendada: "${appointment.title}"
📅 Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}

Te enviaré recordatorios 1 día antes y 1 hora antes.`

  await sendTextAndPersist(conversationId, userPhone, response)
  await reactWithCheck(userPhone, messageId)

  // Track cost
  providerManager.trackSpending(
    PROVIDER_COSTS.chat.claude,
    'claude',
    'chat'
  )
  return
}
```

**Costo**:
- Claude Opus (extraction): $0.0004 (más tokens por usar Opus)
- Total: $0.0004

---

## Escenario 6: Extracción de Gastos

### 6.1 Usuario envía mensaje con gasto

**Mensaje**: "Gasté 250 pesos en la comida del restaurante"

---

### 6.2 FinanceAgent Extraction

**Referencias**: `lib/ai-processing-v2.ts:121-140`

#### Paso 6.2.1: Extract Expense
```typescript
// ai-processing-v2.ts:122
const expense = await financeAgent.extractExpense(userMessage)
```

**API Call a Claude Sonnet**:
```http
POST https://api.anthropic.com/v1/messages

{
  "model": "claude-sonnet-4-5",
  "max_tokens": 256,
  "temperature": 0.1,
  "system": "Eres un agente especializado en control de gastos...",
  "messages": [{
    "role": "user",
    "content": "Extrae información de gasto de este mensaje. Si no hay información de gasto, responde \"NO_EXPENSE\".\n\nMensaje: \"Gasté 250 pesos en la comida del restaurante\""
  }]
}
```

**Respuesta de Claude**:
```json
{
  "amount": 250,
  "currency": "MXN",
  "category": "Alimentación",
  "description": "Comida del restaurante",
  "date": "2025-10-05"
}
```

#### Paso 6.2.2: Send Confirmation
```typescript
// ai-processing-v2.ts:123-139
if (expense) {
  const response = `💰 Gasto registrado:
Monto: ${expense.currency} ${expense.amount}
Categoría: ${expense.category}
Descripción: ${expense.description}

¿Quieres ver un resumen de tus gastos?`

  await sendTextAndPersist(conversationId, userPhone, response)
  await reactWithCheck(userPhone, messageId)

  providerManager.trackSpending(
    PROVIDER_COSTS.chat.claude,
    'claude',
    'chat'
  )
  return
}
```

**Costo**:
- Claude Sonnet (extraction): $0.0003
- Total: $0.0003

---

## Escenario 7: Ubicación

### 7.1 Usuario envía ubicación

**Tipo**: `location`

**Webhook payload**:
```json
{
  "messages": [{
    "id": "wamid.LOC123",
    "from": "+521234567890",
    "timestamp": "1728138800",
    "type": "location",
    "location": {
      "latitude": 19.432608,
      "longitude": -99.133209,
      "name": "Monumento a la Revolución",
      "address": "Plaza de la República, Cuauhtémoc, CDMX"
    }
  }]
}
```

---

### 7.2 Procesamiento (route.ts:241-280)

```typescript
// route.ts:241-280
if (normalized.type === 'location' && message.location) {
  // Fire and forget - save location asynchronously
  (async () => {
    try {
      const supabase = getSupabaseServerClient()
      const { error } = await supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          conversation_id: conversationId,
          latitude: message.location!.latitude,
          longitude: message.location!.longitude,
          name: message.location!.name || null,
          address: message.location!.address || null,
          timestamp: new Date().toISOString()
        })

      if (error) {
        logger.error('Failed to save location', error)
      } else {
        logger.info('[webhook] Location saved')
      }
    } catch (err: any) {
      logger.error('Failed to save location', err)
    }
  })()
}
```

**SQL ejecutado**:
```sql
INSERT INTO user_locations (
  user_id,
  conversation_id,
  latitude,
  longitude,
  name,
  address,
  timestamp
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '660e8400-e29b-41d4-a716-446655440001',
  19.432608,
  -99.133209,
  'Monumento a la Revolución',
  'Plaza de la República, Cuauhtémoc, CDMX',
  '2025-10-05T14:35:00.000Z'
);
```

**Nota**: Las ubicaciones se guardan pero NO se procesa con AI automáticamente (puede agregarse en futuro)

---

## Costos y Optimizaciones

### Comparación de Costos por Escenario

| Escenario | Proveedor Usado | Costo | OpenAI Equivalente | Ahorro |
|-----------|----------------|-------|-------------------|--------|
| Mensaje de texto | Claude Sonnet 4.5 | $0.0003 | $0.0015 (GPT-4o) | **80%** |
| Audio (15 seg) | Groq Whisper + Claude | $0.0011 | $0.0067 (OpenAI) | **84%** |
| Imagen OCR | Tesseract + Claude | $0.0003 | $0.002 (GPT-4 Vision) | **85%** |
| Extracción de cita | Claude Opus | $0.0004 | $0.002 (GPT-4o) | **80%** |
| Extracción de gasto | Claude Sonnet | $0.0003 | $0.0015 (GPT-4o) | **80%** |

### Presupuesto Diario

**Límites configurados** (`lib/ai-providers.ts:23`):
```typescript
export const COST_LIMITS = {
  dailyMax: 10.00,      // $10/día máximo
  perUserMax: 0.50,     // $0.50/usuario máximo
  emergencyMode: 1.00,  // Cambiar a proveedores gratuitos con $1 restante
}
```

### Proyección de Uso

**Escenario típico**: 100 usuarios/día

| Tipo de Mensaje | Cantidad/día | Costo Unitario | Costo Total |
|----------------|--------------|----------------|-------------|
| Texto | 300 msgs | $0.0003 | $0.09 |
| Audio | 50 msgs | $0.0011 | $0.055 |
| Imagen | 20 msgs | $0.0003 | $0.006 |
| **TOTAL** | **370 msgs** | **-** | **$0.151/día** |

**Costo mensual estimado**: $4.53
**vs OpenAI**: $18.90
**Ahorro mensual**: $14.37 (76%)

---

## Manejo de Errores

### Fallback Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    FALLBACK CASCADE                          │
└─────────────────────────────────────────────────────────────┘

Primary: Claude Sonnet 4.5
   │
   ├─► ✅ Success → Response sent
   │
   └─► ❌ Error → Fallback to OpenAI GPT-4o
          │
          ├─► ✅ Success → Response sent
          │
          └─► ❌ Error → Generic error message
```

### Error Handling Code

**Referencias**: `lib/ai-processing-v2.ts:155-184`

```typescript
// ai-processing-v2.ts:155-184
} catch (error: any) {
  logger.error('AI processing error', error)
  await reactWithWarning(userPhone, messageId)

  // Try fallback to OpenAI if Claude fails
  try {
    const { generateResponse } = await import('./response')
    const history = await getConversationHistory(conversationId, 10)
    const { historyToChatMessages } = await import('./context')
    const chatHistory = historyToChatMessages(history)

    const fallbackResponse = await generateResponse({
      intent: 'casual_chat',
      conversationHistory: chatHistory,
      userMessage,
      userId
    })

    await sendTextAndPersist(conversationId, userPhone, fallbackResponse)
    logger.info('Fallback to OpenAI successful')

  } catch (fallbackError: any) {
    logger.error('Fallback also failed', fallbackError)
    await sendTextAndPersist(
      conversationId,
      userPhone,
      'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?'
    )
  }
}
```

### Error Reactions

**Visual indicators**:
```typescript
// Durante procesamiento
await reactWithThinking(userPhone, messageId)  // 🤔

// En éxito
await reactWithCheck(userPhone, messageId)     // ✅

// En error
await reactWithWarning(userPhone, messageId)   // ⚠️
```

---

## Resumen de Referencias de Código

### Archivos Principales

| Archivo | Propósito | Líneas Clave |
|---------|-----------|--------------|
| `app/api/whatsapp/webhook/route.ts` | Entry point webhook | 78-289 |
| `lib/ai-processing-v2.ts` | Procesamiento AI multi-proveedor | 73-392 |
| `lib/claude-agents.ts` | Agentes especializados Claude | 31-301 |
| `lib/whatsapp.ts` | Cliente WhatsApp API v23.0 | 68-745 |
| `lib/ai-providers.ts` | Gestión de proveedores AI | 52-183 |
| `lib/message-normalization.ts` | Normalización de mensajes | 34-122 |
| `lib/persist.ts` | Persistencia Supabase | 4-108 |
| `lib/context.ts` | Historial de conversación | 16-48 |
| `lib/groq-client.ts` | Cliente Groq Whisper | 22-58 |
| `lib/tesseract-ocr.ts` | OCR gratuito | 15-35 |
| `types/schemas.ts` | Validación Zod | 1-331 |

---

## Conclusiones

### Flujo Completo Simplificado

```
1. WhatsApp webhook POST
   ↓
2. Validación (firma, schema, deduplicación)
   ↓
3. Normalización mensaje
   ↓
4. Persistencia DB (user, conversation, message)
   ↓
5. Response 200 OK (webhook completo)
   ↓
6. [BACKGROUND] Procesamiento AI
   ↓
7. Indicadores visuales (typing, reactions)
   ↓
8. Selección de proveedor (Claude/Groq/Tesseract)
   ↓
9. Procesamiento específico por tipo
   ↓
10. Respuesta enviada a WhatsApp
    ↓
11. Tracking de costos
```

### Características Técnicas

✅ **Edge Runtime** - Latencia <100ms
✅ **Multi-Provider AI** - 76% ahorro de costos
✅ **Type Safety** - Zod schemas + TypeScript strict
✅ **Deduplicación** - Ventana 60s
✅ **Rate Limiting** - 250 msg/sec (WhatsApp limit)
✅ **Fallback Strategy** - Claude → OpenAI → Generic
✅ **Cost Tracking** - Budget diario $10
✅ **Background Processing** - Fire and forget
✅ **Specialized Agents** - Citas, gastos, conversación

### Métricas de Rendimiento

| Métrica | Valor | Target |
|---------|-------|--------|
| Webhook response | 150-300ms | <500ms |
| AI processing | 2-3s | <5s |
| Audio transcription | 1-2s | <3s |
| OCR extraction | 2-4s | <5s |
| Costo por mensaje | $0.0003-0.0011 | <$0.01 |

---

**Última actualización**: 2025-10-05
**Versión**: 2.0
**Stack**: Next.js 15 + Vercel Edge + Supabase + Claude SDK
