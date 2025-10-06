# Guía Completa: Sistema de Procesamiento de IA - migue.ai

**Fecha**: 2025-10-06
**Versión**: 2.0 (Multi-Provider AI System)
**Stack**: Next.js 15 + Vercel Edge + Claude SDK + Groq + Tesseract

---

## Tabla de Contenidos

1. [Arquitectura General](#1-arquitectura-general)
2. [Flujo de Datos Paso a Paso](#2-flujo-de-datos-paso-a-paso)
3. [Construcción del Prompt](#3-construcción-del-prompt)
4. [Sistema de Agentes Especializados](#4-sistema-de-agentes-especializados)
5. [Procesamiento de Contenido Multimodal](#5-procesamiento-de-contenido-multimodal)
6. [Edge Runtime y Optimizaciones](#6-edge-runtime-y-optimizaciones)
7. [Debugging y Monitoring](#7-debugging-y-monitoring)
8. [Referencias de Código](#8-referencias-de-código)

---

## 1. Arquitectura General

### 1.1 Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USUARIO (WhatsApp)                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Mensaje (texto/audio/imagen/ubicación)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  WEBHOOK API (route.ts)                                               │
│  ├─ Validación de firma (HMAC SHA-256)                                │
│  ├─ Validación de schema (Zod)                                        │
│  └─ Respuesta 200 OK (<100ms) ✅ Fire-and-forget                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ waitUntil() - Background processing
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NORMALIZACIÓN (message-normalization.ts)                             │
│  ├─ whatsAppMessageToNormalized()                                     │
│  └─ NormalizedMessage { from, content, type, waMessageId }            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PERSISTENCIA (persist.ts)                                            │
│  ├─ persistNormalizedMessage() con retry                              │
│  ├─ Deduplicación (database constraint)                               │
│  └─ Retorna: { conversationId, userId, wasInserted }                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RECUPERACIÓN DE CONTEXTO (context.ts)                                │
│  ├─ getConversationHistory(conversationId, limit=10)                  │
│  └─ Últimos 10 mensajes ordenados cronológicamente                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SELECCIÓN DE AGENTE (ai-processing-v2.ts)                            │
│  ├─ SchedulingAgent.extractAppointment() → ¿Cita/Recordatorio?       │
│  ├─ FinanceAgent.extractExpense() → ¿Gasto?                           │
│  └─ ProactiveAgent.respond() → Chat general (default)                 │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PROVEEDOR DE IA                                                      │
│  ├─ Claude Sonnet 4.5 (Chat) - 75% más barato                         │
│  ├─ Groq Whisper (Audio) - 93% más barato                             │
│  └─ Tesseract OCR (Imágenes) - 100% gratis                            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESPUESTA (whatsapp.ts)                                              │
│  ├─ sendWhatsAppText()                                                │
│  ├─ reactWithCheck() ✅                                               │
│  └─ insertOutboundMessage() - Persistir respuesta                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        USUARIO (WhatsApp)                             │
│                     Recibe respuesta de Migue                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Stack Tecnológico

| Componente | Tecnología | Versión | Propósito |
|------------|------------|---------|-----------|
| **Runtime** | Vercel Edge Functions | - | Respuestas <100ms, global distribution |
| **Framework** | Next.js App Router | 15.0 | API routes con Edge Runtime |
| **IA Principal** | Claude SDK (`@anthropic-ai/sdk`) | 0.65.0 | Chat conversacional (Sonnet 4.5) |
| **Audio** | Groq SDK (`groq-sdk`) | 0.33.0 | Transcripción Whisper (93% cheaper) |
| **OCR** | Tesseract.js (`tesseract.js`) | 6.0.1 | Extracción de texto (100% free) |
| **Fallback** | OpenAI SDK (`openai`) | 5.23.1 | Compatibilidad legacy |
| **Base de Datos** | Supabase PostgreSQL | - | Historial, usuarios, metadata |
| **WhatsApp** | Cloud API | v23.0 | Mensajería bidireccional |

### 1.3 Comparativa de Proveedores

| Proveedor | Tarea | Costo | Ahorro vs GPT-4 |
|-----------|-------|-------|-----------------|
| **Claude Sonnet 4.5** | Chat | $3/$15 por 1M tokens | 75% |
| **Groq Whisper** | Audio | $0.05/hora | 93% |
| **Tesseract** | OCR | $0 (gratis) | 100% |
| **OpenAI GPT-4o** | Fallback | $15/$60 por 1M tokens | - |

**Total cost savings**: 76% ($55/mes → $13/mes)

---

## 2. Flujo de Datos Paso a Paso

### Stage 1: Webhook Reception
**Archivo**: `app/api/whatsapp/webhook/route.ts:49-210`

```typescript
export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId(); // Tracking único

  // ✅ FAST PATH (<100ms)
  // 1. Validar firma HMAC SHA-256
  const rawBody = await req.text();
  const signatureOk = await validateSignature(req, rawBody);
  if (!signatureOk) return jsonResponse({ error: 'Invalid signature' }, 401);

  // 2. Parse JSON
  const jsonBody = JSON.parse(rawBody);

  // 3. Validar con Zod schemas
  const validationResult = safeValidateWebhookPayload(jsonBody);
  if (!validationResult.success) return jsonResponse({ error: '...' }, 400);

  // 4. Extraer mensaje
  const message = extractFirstMessage(validationResult.data);
  if (!message) return jsonResponse({ status: 'ignored' }, 200);

  // 5. Normalizar
  const normalized = whatsAppMessageToNormalized(message);

  // ✅ RETURN 200 OK IMMEDIATELY
  waitUntil(processWebhookInBackground(requestId, normalized, message));
  return jsonResponse({ success: true, request_id: requestId }, 200);
}
```

**Métricas clave**:
- Target response time: <100ms
- Patrón fire-and-forget con `waitUntil()`
- Siempre retorna 200 OK (evita retry storms de WhatsApp)

### Stage 2: Message Normalization
**Archivo**: `lib/message-normalization.ts`

```typescript
export type NormalizedMessage = {
  from: string;              // +5219999999999
  waMessageId: string;       // wamid.xxx
  timestamp: string;         // ISO 8601
  type: 'text' | 'audio' | 'voice' | 'image' | 'document' | 'location';
  content: string | null;    // Texto del mensaje
  mediaUrl?: string;         // URL de multimedia
  raw: any;                  // Payload original de WhatsApp
}

// Conversión automática de todos los tipos de mensaje
const normalized = whatsAppMessageToNormalized(message);
```

**Tipos soportados**:
- ✅ `text` - Mensajes de texto
- ✅ `audio/voice` - Notas de voz y audios
- ✅ `image` - Imágenes (JPG, PNG)
- ✅ `document` - PDFs y documentos
- ✅ `location` - Ubicación GPS
- ✅ `interactive` - Botones y listas (v23.0)

### Stage 3: Database Persistence
**Archivo**: `lib/persist.ts`

```typescript
// Persist con retry y deduplicación automática
const result = await retryWithBackoff(
  () => persistNormalizedMessage(normalized),
  'persistNormalizedMessage',
  { maxRetries: 1, initialDelayMs: 500 }
);

// Resultado
{
  conversationId: string,  // UUID de la conversación
  userId: string,          // UUID del usuario
  wasInserted: boolean     // false si era duplicado
}
```

**Deduplicación**:
- Base de datos: constraint único en `wa_message_id`
- Aplicación: check de `wasInserted` antes de continuar
- Previene procesamiento duplicado de webhooks

### Stage 4: Context Retrieval
**Archivo**: `lib/context.ts:16-33`

```typescript
// Obtiene últimos 10 mensajes de la conversación
const history = await getConversationHistory(conversationId, 10);

// Query real a Supabase
SELECT id, direction, type, content, timestamp
FROM messages_v2
WHERE conversation_id = $1
ORDER BY timestamp DESC
LIMIT 10
```

**Formato del historial**:
```typescript
[
  {
    id: 'uuid',
    direction: 'inbound',     // mensaje del usuario
    type: 'text',
    content: 'Hola, cómo estás?',
    timestamp: '2025-10-06T10:00:00Z'
  },
  {
    id: 'uuid',
    direction: 'outbound',    // respuesta del asistente
    type: 'text',
    content: '¡Hola! ¿En qué puedo ayudarte?',
    timestamp: '2025-10-06T10:00:05Z'
  }
]
```

**Conversión a formato Claude**:
```typescript
// lib/ai-processing-v2.ts:47-56
function historyToClaudeMessages(history) {
  return history
    .filter((msg) => msg.content !== null)
    .map((msg) => ({
      role: msg.direction === 'outbound' ? 'assistant' : 'user',
      content: msg.content!,
    }))
}

// Resultado:
[
  { role: 'user', content: 'Hola, cómo estás?' },
  { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?' }
]
```

### Stage 5: Agent Selection
**Archivo**: `lib/ai-processing-v2.ts:129-285`

```typescript
// 1. Intenta SchedulingAgent (citas/recordatorios)
const appointment = await schedulingAgent.extractAppointment(userMessage);
if (appointment) {
  // Ejecutar acción autónoma
  await createReminder(userId, appointment.title, ...);
  return; // Early return ✅
}

// 2. Intenta FinanceAgent (gastos)
const expense = await financeAgent.extractExpense(userMessage);
if (expense) {
  // Registrar gasto
  return; // Early return ✅
}

// 3. Default: ProactiveAgent (chat general)
const proactiveAgent = createProactiveAgent();
const response = await proactiveAgent.respond(userMessage, claudeHistory);
```

**Matriz de decisión**:

| Mensaje del usuario | Agente seleccionado | Acción |
|---------------------|---------------------|--------|
| "Recuérdame llamar a mi mamá mañana" | SchedulingAgent | `createReminder()` |
| "Gasté $500 en comida" | FinanceAgent | Registro en DB |
| "¿Cómo está el clima?" | ProactiveAgent | Respuesta conversacional |
| "Hola" | ProactiveAgent | Saludo |

### Stage 6: AI Processing (Claude SDK)
**Archivo**: `lib/claude-agents.ts:93-99`

```typescript
// Llamada a Claude API
const response = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  temperature: 0.7,
  system: this.config.systemPrompt,  // ← System prompt del agente
  messages: [                         // ← Historial + mensaje actual
    ...conversationHistory,
    { role: 'user', content: userMessage }
  ]
});

// Extraer respuesta
const content = response.content[0];
if (content?.type === 'text') {
  return content.text.trim();
}
```

**Tracking de uso**:
```typescript
// lib/ai-providers.ts:151-162
providerManager.trackSpending(
  PROVIDER_COSTS.chat.claude,  // $0.0003 por mensaje (~500 tokens)
  'claude',
  'chat'
);

// Log automático
{
  provider: 'claude',
  task: 'chat',
  amount: '$0.0003',
  dailyTotal: '$0.45',
  remaining: '$9.55'
}
```

### Stage 7: Response Delivery
**Archivo**: `lib/ai-processing-v2.ts:61-73`

```typescript
// Enviar y persistir respuesta
async function sendTextAndPersist(conversationId, userPhone, response) {
  // 1. Enviar a WhatsApp
  const waMessageId = await sendWhatsAppText(userPhone, response);

  // 2. Persistir en database
  if (waMessageId) {
    await insertOutboundMessage(conversationId, response, waMessageId);
  } else {
    await insertOutboundMessage(conversationId, response);
  }

  return waMessageId;
}

// 3. Reacción de confirmación
await reactWithCheck(userPhone, messageId); // ✅
```

---

## 3. Construcción del Prompt

### 3.1 Anatomía del Prompt

Un prompt completo enviado a Claude tiene **3 componentes principales**:

```typescript
{
  model: 'claude-sonnet-4-5',
  max_tokens: 1024,
  temperature: 0.7,

  // 1️⃣ SYSTEM PROMPT (Instrucciones del agente)
  system: `Eres Migue, un asistente personal AUTÓNOMO...`,

  // 2️⃣ MESSAGES (Historial de conversación)
  messages: [
    { role: 'user', content: 'Mensaje 1' },
    { role: 'assistant', content: 'Respuesta 1' },
    { role: 'user', content: 'Mensaje actual' }
  ]
}
```

### 3.2 Component 1: System Prompt

El **System Prompt** define el comportamiento, personalidad y capacidades del agente.

**Ejemplo real - ProactiveAgent** (`lib/claude-agents.ts:40-66`):

```typescript
systemPrompt: `Eres Migue, un asistente personal AUTÓNOMO en WhatsApp.

IMPORTANTE: Tú EJECUTAS acciones automáticamente, NO das instrucciones manuales.

Tu misión es ayudar al usuario con:
- Gestión de citas y calendario
- Recordatorios inteligentes
- Control de gastos
- Programación de mensajes
- Procesamiento de audios, imágenes y documentos

Características clave:
1. AUTÓNOMO: Ejecutas acciones automáticamente sin pedir permiso
2. PROACTIVO: Anticipas necesidades, completas tareas
3. CONVERSACIONAL: Respuestas naturales, cercanas, en español
4. CONTEXTUAL: Recuerdas conversaciones previas
5. EFICIENTE: Respuestas concisas confirmando acciones completadas

REGLAS DE AUTONOMÍA:
- Cuando el usuario pida "Recuérdame X" → Ya lo guardé y confirmo
- Cuando pida "Agenda reunión" → Ya la agendé y confirmo
- Cuando mencione un gasto → Ya lo registré y confirmo

NUNCA digas: "Puedes agregarlo manualmente a tu calendario..."
SIEMPRE di: "✅ Listo, ya lo agregué/guardé/creé"

Sé conciso, amigable y confirma las acciones que YA SE EJECUTARON automáticamente.`
```

**Elementos clave del System Prompt**:
- ✅ **Identidad**: "Eres Migue"
- ✅ **Modo de operación**: "AUTÓNOMO"
- ✅ **Capacidades**: Lista de funciones
- ✅ **Reglas de comportamiento**: Qué hacer y qué NO hacer
- ✅ **Tono**: Conciso, amigable, español

### 3.3 Component 2: Messages (Historial)

El **historial de conversación** proporciona contexto para respuestas coherentes.

**Formato**:
```typescript
messages: [
  // Mensaje 1 (usuario)
  {
    role: 'user',
    content: 'Hola, cómo estás?'
  },

  // Respuesta 1 (asistente)
  {
    role: 'assistant',
    content: '¡Hola! Muy bien, ¿en qué puedo ayudarte hoy?'
  },

  // Mensaje 2 (usuario)
  {
    role: 'user',
    content: 'Recuérdame llamar a mi mamá mañana a las 3pm'
  }
]
```

**Estrategia de ventana deslizante**:
- Límite: **10 mensajes** más recientes
- Orden: Cronológico (más antiguo primero)
- Filtro: Solo mensajes con `content !== null`

**Ejemplo de recuperación**:
```typescript
// lib/context.ts:16-33
const history = await getConversationHistory(conversationId, 10);

// Query SQL real:
SELECT id, direction, type, content, timestamp
FROM messages_v2
WHERE conversation_id = 'uuid-conversation-123'
ORDER BY timestamp DESC
LIMIT 10;

// Resultado invertido para orden cronológico
return data.reverse();
```

### 3.4 Component 3: Parámetros de Modelo

```typescript
{
  model: 'claude-sonnet-4-5',    // Modelo más reciente
  max_tokens: 1024,               // Límite de respuesta
  temperature: 0.7,               // Creatividad (0.0-1.0)
}
```

**Configuración por agente**:

| Agente | Model | Temperature | Max Tokens | Uso |
|--------|-------|-------------|------------|-----|
| ProactiveAgent | Sonnet 4.5 | 0.7 | 1024 | Chat general |
| SchedulingAgent | Opus 4 | 0.1 | 512 | Extracción precisa |
| FinanceAgent | Sonnet 4.5 | 0.1 | 256 | Categorización |

### 3.5 Ejemplo Completo de Payload

**Escenario**: Usuario envía "Recuérdame llamar a mi mamá mañana a las 3pm"

**Payload real a Claude API**:
```typescript
{
  model: 'claude-opus-4',  // SchedulingAgent usa Opus para precisión
  max_tokens: 512,
  temperature: 0.1,

  system: `Eres un agente especializado en DETECTAR y EXTRAER información de citas y recordatorios.

Tu trabajo es SOLO extraer información, NO confirmar ni crear eventos.

Tus capacidades:
1. Extraer fechas, horas y descripciones de citas/recordatorios
2. Identificar el tipo de evento (reminder simple vs meeting formal)
3. Normalizar fechas relativas ("mañana", "el próximo martes")
4. Extraer descripciones y contexto

IMPORTANTE: Si el mensaje NO contiene información clara de fecha/hora, responde "NO_APPOINTMENT"

Formato de respuesta JSON:
{
  "title": "Descripción breve de la cita",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": 30,
  "description": "Detalles adicionales opcionales"
}

Hoy es 2025-10-06.`,

  messages: [
    {
      role: 'user',
      content: 'Extrae la información de cita de este mensaje. Si no hay información clara de cita, responde "NO_APPOINTMENT".\n\nMensaje: "Recuérdame llamar a mi mamá mañana a las 3pm"'
    }
  ]
}
```

**Respuesta de Claude**:
```json
{
  "title": "Llamar a mi mamá",
  "date": "2025-10-07",
  "time": "15:00",
  "duration": 30,
  "description": null
}
```

**Confirmación al usuario** (después de ejecutar `createReminder()`):
```
✅ Listo! Guardé tu recordatorio:
"Llamar a mi mamá"
📅 2025-10-07 a las 15:00

Te lo recordaré a tiempo 👍
```

### 3.6 Información NO Incluida

Por privacidad y eficiencia, **NO se incluye** en el prompt:

❌ Información de otros usuarios
❌ Conversaciones de otras personas
❌ Datos sensibles del perfil (password, tokens)
❌ Historial completo (solo últimos 10 mensajes)
❌ Multimedia sin procesar (se transcribe/extrae texto primero)
❌ Metadata técnica (IDs internos, timestamps exactos)

---

## 4. Sistema de Agentes Especializados

### 4.1 Arquitectura de Agentes

```
┌─────────────────────────────────────────────────────────────┐
│                    processMessageWithAI()                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  1. SchedulingAgent.extractAppointment()            │    │
│  │     ├─ Model: Claude Opus 4 (precisión)              │    │
│  │     ├─ Temperature: 0.1 (muy bajo)                   │    │
│  │     └─ Output: JSON o "NO_APPOINTMENT"               │    │
│  │                                                       │    │
│  │  ✅ If appointment found:                            │    │
│  │     ├─ createReminder() o scheduleMeeting()          │    │
│  │     └─ return (early exit)                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  2. FinanceAgent.extractExpense()                   │    │
│  │     ├─ Model: Claude Sonnet 4.5                      │    │
│  │     ├─ Temperature: 0.1                               │    │
│  │     └─ Output: JSON o "NO_EXPENSE"                   │    │
│  │                                                       │    │
│  │  ✅ If expense found:                                │    │
│  │     ├─ Record to database                            │    │
│  │     └─ return (early exit)                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  3. ProactiveAgent.respond() (DEFAULT)              │    │
│  │     ├─ Model: Claude Sonnet 4.5                      │    │
│  │     ├─ Temperature: 0.7 (creativo)                   │    │
│  │     └─ Output: Conversational response               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Agent 1: ProactiveAgent

**Propósito**: Asistente conversacional principal
**Archivo**: `lib/claude-agents.ts:31-124`

**Configuración**:
```typescript
{
  name: 'ProactiveAgent',
  model: 'claude-sonnet-4-5',
  temperature: 0.7,        // Balance creatividad/coherencia
  maxTokens: 1024,
}
```

**System Prompt completo**: Ver sección 3.2

**Casos de uso**:
- ✅ Conversación general ("Hola", "¿Cómo estás?")
- ✅ Preguntas informativas ("¿Qué es Python?")
- ✅ Confirmaciones después de acciones autónomas
- ✅ Manejo de mensajes ambiguos

**Ejemplo de uso**:
```typescript
const proactiveAgent = createProactiveAgent();
const response = await proactiveAgent.respond(
  "¿Cuál es la capital de Francia?",
  claudeHistory
);
// → "La capital de Francia es París."
```

### 4.3 Agent 2: SchedulingAgent

**Propósito**: Extracción de citas y recordatorios
**Archivo**: `lib/claude-agents.ts:130-236`

**Configuración**:
```typescript
{
  name: 'SchedulingAgent',
  model: 'claude-opus-4',   // Opus para precisión máxima
  temperature: 0.1,          // Muy bajo para extracción
  maxTokens: 512,
}
```

**System Prompt** (`lib/claude-agents.ts:139-165`):
```typescript
systemPrompt: `Eres un agente especializado en DETECTAR y EXTRAER información de citas y recordatorios.

Tu trabajo es SOLO extraer información, NO confirmar ni crear eventos.

Tus capacidades:
1. Extraer fechas, horas y descripciones de citas/recordatorios
2. Identificar el tipo de evento (reminder simple vs meeting formal)
3. Normalizar fechas relativas ("mañana", "el próximo martes")
4. Extraer descripciones y contexto

IMPORTANTE: Si el mensaje NO contiene información clara de fecha/hora, responde "NO_APPOINTMENT"

Formato de respuesta JSON:
{
  "title": "Descripción breve de la cita",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "duration": 30,
  "description": "Detalles adicionales opcionales"
}

Hoy es ${new Date().toISOString().split('T')[0]}.`
```

**Output Schema**:
```typescript
{
  title: string;           // "Llamar a mi mamá"
  date: string;            // "2025-10-07" (YYYY-MM-DD)
  time: string;            // "15:00" (HH:MM)
  duration?: number;       // 30 (minutos, opcional)
  description?: string;    // Detalles adicionales
}
```

**Ejemplos de detección**:

| Input | Output | Acción |
|-------|--------|--------|
| "Recuérdame llamar a mi tía el martes a las 3pm" | `{ title: "Llamar a mi tía", date: "2025-10-14", time: "15:00" }` | `createReminder()` |
| "Tengo reunión con el equipo mañana a las 9am" | `{ title: "Reunión con el equipo", date: "2025-10-07", time: "09:00" }` | `scheduleMeeting()` |
| "Hola cómo estás" | `"NO_APPOINTMENT"` | Pass to next agent |

**Acciones autónomas**:
```typescript
// lib/ai-processing-v2.ts:146-200
if (appointment) {
  // Decide: reminder simple o meeting formal
  const isReminder = userMessage.toLowerCase().includes('recuerd') ||
                    !userMessage.toLowerCase().match(/reuni[oó]n|junta|meeting/i);

  if (isReminder) {
    // Crear recordatorio en database
    await createReminder(userId, appointment.title, appointment.description, datetime);
  } else {
    // Crear meeting en Google Calendar
    await scheduleMeetingFromIntent({ userId, userMessage, conversationHistory });
  }

  // Schedule follow-up (2 horas después)
  await scheduleFollowUp({ userId, conversationId, category: 'schedule_confirm', delayMinutes: 120 });
}
```

### 4.4 Agent 3: FinanceAgent

**Propósito**: Extracción y categorización de gastos
**Archivo**: `lib/claude-agents.ts:242-345`

**Configuración**:
```typescript
{
  name: 'FinanceAgent',
  model: 'claude-sonnet-4-5',
  temperature: 0.5,
  maxTokens: 512,
}
```

**System Prompt** (`lib/claude-agents.ts:251-276`):
```typescript
systemPrompt: `Eres un agente especializado en control de gastos personal.

Tus funciones:
1. Extraer montos, categorías y descripciones de gastos
2. Categorizar automáticamente (comida, transporte, entretenimiento, etc.)
3. Detectar patrones de gasto
4. Alertar sobre gastos inusuales
5. Sugerir oportunidades de ahorro

Categorías disponibles:
- Alimentación
- Transporte
- Entretenimiento
- Salud
- Servicios
- Compras
- Otros

Formato de extracción:
{
  "amount": 123.45,
  "currency": "MXN",
  "category": "Alimentación",
  "description": "Comida del día",
  "date": "YYYY-MM-DD"
}`
```

**Output Schema**:
```typescript
{
  amount: number;          // 123.45
  currency: string;        // "MXN", "USD"
  category: string;        // Ver categorías disponibles
  description: string;     // "Comida del día"
}
```

**Ejemplos de detección**:

| Input | Output |
|-------|--------|
| "Gasté $500 en comida hoy" | `{ amount: 500, currency: "MXN", category: "Alimentación", description: "Comida" }` |
| "Pagué 1200 pesos de Uber" | `{ amount: 1200, currency: "MXN", category: "Transporte", description: "Uber" }` |
| "Compré ropa por $800" | `{ amount: 800, currency: "MXN", category: "Compras", description: "Ropa" }` |

### 4.5 Matriz de Decisión Completa

```
┌───────────────────────────────────────────────────────────────────┐
│  USER MESSAGE: "Recuérdame llamar a mi mamá mañana a las 3pm"     │
└────────────────────────┬──────────────────────────────────────────┘
                         │
    ┌────────────────────▼────────────────────┐
    │  SchedulingAgent.extractAppointment()   │
    └────────────────────┬────────────────────┘
                         │
                    ✅ appointment found
                         │
    ┌────────────────────▼────────────────────┐
    │  createReminder(userId, ...)            │
    │  Response: "✅ Listo! Guardé tu          │
    │  recordatorio: Llamar a mi mamá..."     │
    └─────────────────────────────────────────┘
                         │
                    RETURN ✅

┌───────────────────────────────────────────────────────────────────┐
│  USER MESSAGE: "Gasté $500 en comida"                             │
└────────────────────────┬──────────────────────────────────────────┘
                         │
    ┌────────────────────▼────────────────────┐
    │  SchedulingAgent.extractAppointment()   │
    └────────────────────┬────────────────────┘
                         │
                    ❌ NO_APPOINTMENT
                         │
    ┌────────────────────▼────────────────────┐
    │  FinanceAgent.extractExpense()          │
    └────────────────────┬────────────────────┘
                         │
                    ✅ expense found
                         │
    ┌────────────────────▼────────────────────┐
    │  Record to database                     │
    │  Response: "💰 Gasto registrado:        │
    │  Monto: MXN 500, Categoría: Alimentación"│
    └─────────────────────────────────────────┘
                         │
                    RETURN ✅

┌───────────────────────────────────────────────────────────────────┐
│  USER MESSAGE: "¿Cómo está el clima hoy?"                         │
└────────────────────────┬──────────────────────────────────────────┘
                         │
    ┌────────────────────▼────────────────────┐
    │  SchedulingAgent.extractAppointment()   │
    └────────────────────┬────────────────────┘
                         │
                    ❌ NO_APPOINTMENT
                         │
    ┌────────────────────▼────────────────────┐
    │  FinanceAgent.extractExpense()          │
    └────────────────────┬────────────────────┘
                         │
                    ❌ NO_EXPENSE
                         │
    ┌────────────────────▼────────────────────┐
    │  ProactiveAgent.respond() (DEFAULT)     │
    │  Response: Conversational reply based   │
    │  on context and capabilities            │
    └─────────────────────────────────────────┘
                         │
                    RETURN ✅
```

---

## 5. Procesamiento de Contenido Multimodal

### 5.1 Audio/Voice Messages

**Pipeline**: WhatsApp → Download → Groq Whisper → Claude

**Archivo**: `lib/ai-processing-v2.ts:362-491`

```typescript
export async function processAudioMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  // 1. Download audio
  const audioResponse = await fetch(normalized.mediaUrl);
  const audioBuffer = new Uint8Array(await audioResponse.arrayBuffer());

  // 2. Transcribe with Groq (93% cheaper!)
  const audioFile = bufferToFile(audioBuffer, 'audio.ogg', 'audio/ogg');
  const transcript = await transcribeWithGroq(audioFile, {
    model: 'whisper-large-v3',
    language: 'es',
  });

  // 3. Update message in database
  await updateInboundMessageByWaId(normalized.waMessageId, {
    content: transcript,
  });

  // 4. Process transcribed text with AI
  await processMessageWithAI(
    conversationId,
    userId,
    normalized.from,
    transcript,      // ← Texto transcrito como entrada
    normalized.waMessageId
  );

  // 5. Track cost
  const durationMinutes = 1;  // Assume 1 min average
  providerManager.trackSpending(
    PROVIDER_COSTS.transcription.groq * durationMinutes,  // $0.0008/min
    'groq',
    'transcription'
  );
}
```

**Groq Whisper Configuration** (`lib/groq-client.ts`):
```typescript
{
  model: 'whisper-large-v3',
  language: 'es',              // Español para México
  response_format: 'text',
  temperature: 0.0,            // Deterministic transcription
}
```

**Costo por minuto**:
- Groq: $0.0008/min (93% cheaper)
- OpenAI: $0.006/min
- **Ahorro**: $0.0052/min

**Fallback**: Si Groq falla, se usa OpenAI Whisper automáticamente.

### 5.2 Images & Documents (OCR)

**Pipeline**: WhatsApp → Download → Tesseract OCR → Claude

**Archivo**: `lib/ai-processing-v2.ts:496-649`

```typescript
export async function processDocumentMessage(
  conversationId: string,
  userId: string,
  normalized: NormalizedMessage
) {
  // 1. Download image/document
  const imageResponse = await fetch(normalized.mediaUrl);
  const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());

  // 2. Lazy load Tesseract (saves 2MB from bundle)
  const { extractTextFromImage } = await import('./tesseract-ocr');

  // 3. Extract text with Tesseract (FREE!)
  const extractedText = await extractTextFromImage(imageBuffer, {
    language: 'spa+eng',  // Español + Inglés
  });

  // 4. Process extracted text with Claude for comprehension
  const proactiveAgent = createProactiveAgent();
  const history = await getConversationHistory(conversationId, 5);
  const claudeHistory = historyToClaudeMessages(history);

  const comprehension = await proactiveAgent.respond(
    `El usuario envió una imagen con este texto: "${extractedText}". Analiza y responde de forma útil.`,
    claudeHistory
  );

  // 5. Send response
  await sendTextAndPersist(conversationId, normalized.from, comprehension);

  // 6. Track cost (Tesseract is FREE!)
  providerManager.trackSpending(0, 'tesseract', 'ocr');
}
```

**Tesseract Configuration** (`lib/tesseract-ocr.ts`):
```typescript
{
  lang: 'spa+eng',         // Multi-language support
  tessedit_pageseg_mode: PSM.AUTO,
  tessedit_char_whitelist: '',  // No restrictions
}
```

**Costo por imagen**:
- Tesseract: $0 (100% FREE)
- OpenAI GPT-4 Vision: $0.002/image
- **Ahorro**: $0.002/image

**Lazy Loading**: Tesseract se carga dinámicamente para ahorrar 2MB en bundle.

### 5.3 Location Messages

**Pipeline**: WhatsApp → Extract GPS → Database

**Archivo**: `app/api/whatsapp/webhook/route.ts:426-461`

```typescript
if (normalized.type === 'location' && message.location) {
  const { error } = await supabase
    .from('user_locations')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      latitude: message.location.latitude,
      longitude: message.location.longitude,
      name: message.location.name || null,
      address: message.location.address || null,
      timestamp: new Date().toISOString(),
    });
}
```

**Schema de ubicación**:
```typescript
{
  latitude: number;    // 19.4326
  longitude: number;   // -99.1332
  name?: string;       // "Casa"
  address?: string;    // "Av. Reforma 123, CDMX"
}
```

**Uso futuro**: Contexto geográfico para recomendaciones.

### 5.4 Interactive Messages (Buttons & Lists)

**Detection**: `lib/message-normalization.ts`

```typescript
// Extract interactive reply
const interactiveReply = extractInteractiveReply(normalized.raw);

if (interactiveReply) {
  // { id: 'action_book_appointment', title: 'Agendar cita' }

  // Get action definition
  const actionDefinition = getActionDefinition(interactiveReply.id);

  // Replace message content with action
  if (actionDefinition?.replacementMessage) {
    normalized.content = actionDefinition.replacementMessage;
  }

  normalized.type = 'text';  // Process as text message
}
```

**Action definitions** (`lib/actions.ts`):
```typescript
{
  'action_book_appointment': {
    category: 'scheduling',
    replacementMessage: 'Quiero agendar una cita',
    handler: async (payload) => { /* ... */ }
  }
}
```

---

## 6. Edge Runtime y Optimizaciones

### 6.1 Vercel Edge Functions

**Beneficios**:
- ⚡ Cold start <50ms (vs Node.js ~200ms)
- 🌍 Global distribution (300+ ciudades)
- 💰 Costo-efectivo (más barato que Lambda)
- ⏱️ Timeout 30s (vs 10s default)

**Configuración**:
```typescript
// app/api/whatsapp/webhook/route.ts:1
export const runtime = 'edge';

// vercel.json - NO especificar runtime aquí
{
  "crons": [
    { "path": "/api/cron/check-reminders", "schedule": "0 9 * * *" }
  ]
}
```

**SDKs compatibles**:
| SDK | Compatible | Versión | Notas |
|-----|------------|---------|-------|
| `@anthropic-ai/sdk` | ✅ | 0.65.0 | Messages API |
| `groq-sdk` | ✅ | 0.33.0 | Audio transcription |
| `tesseract.js` | ✅ | 6.0.1 | Browser-compatible |
| `openai` | ✅ | 5.23.1 | Edge-compatible |
| `@anthropic-ai/claude-agent-sdk` | ❌ | - | Requires Node.js fs/child_process |

### 6.2 Fire-and-Forget Pattern

**Problema**: WhatsApp espera respuesta <5s, pero AI toma 3-10s.

**Solución**: `waitUntil()` API de Vercel

```typescript
// app/api/whatsapp/webhook/route.ts:183-196
// ✅ RETURN 200 OK IMMEDIATELY (<100ms)
waitUntil(
  processWebhookInBackground(requestId, normalized, message).catch((err) => {
    logger.error('[webhook] Background processing failed', err);
  })
);

return jsonResponse({ success: true, request_id: requestId }, 200);
```

**Ventajas**:
- ✅ Respuesta instantánea a WhatsApp
- ✅ Procesamiento en background sin timeout
- ✅ Previene retry storms
- ✅ Mejor UX (no esperas de WhatsApp)

### 6.3 Lazy Loading

**Tesseract.js**: 2MB bundle savings

```typescript
// lib/ai-processing-v2.ts:555
// ❌ Import at top (loads always): import { extractTextFromImage } from './tesseract-ocr'

// ✅ Dynamic import (loads only when needed)
const { extractTextFromImage } = await import('./tesseract-ocr');
```

**Resultado**:
- Initial bundle: 450KB (sin Tesseract)
- On-demand load: +2MB (solo cuando usuario envía imagen)

### 6.4 Database Deduplication

**Problema**: WhatsApp puede enviar webhooks duplicados.

**Solución**: Constraint único en database + check de aplicación

```sql
-- supabase/schema.sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_v2_wa_message_id
ON messages_v2(wa_message_id)
WHERE wa_message_id IS NOT NULL;
```

```typescript
// lib/persist.ts
try {
  result = await retryWithBackoff(
    () => persistNormalizedMessage(normalized),
    'persistNormalizedMessage',
    { maxRetries: 1 }
  );
} catch (persistError: any) {
  if (isDuplicateError(persistError)) {
    logger.info('Duplicate message detected, skipping');
    return;  // Exit silently ✅
  }
  throw persistError;
}
```

### 6.5 Cost Tracking System

**Archivo**: `lib/ai-providers.ts:151-183`

```typescript
export class AIProviderManager {
  private dailySpent: number = 0;

  trackSpending(amount: number, provider: ProviderName, task: TaskType) {
    this.dailySpent += amount;
    logger.info('Cost tracked', {
      provider,
      task,
      amount: `$${amount.toFixed(4)}`,
      dailyTotal: `$${this.dailySpent.toFixed(2)}`,
      remaining: `$${(COST_LIMITS.dailyMax - this.dailySpent).toFixed(2)}`,
    });
  }

  // Emergency mode: Switch to cheaper providers at $1 remaining
  async selectProvider(task: TaskType): Promise<ProviderName> {
    const remainingBudget = COST_LIMITS.dailyMax - this.dailySpent;

    if (remainingBudget < COST_LIMITS.emergencyMode) {
      logger.warn(`Low budget: $${remainingBudget.toFixed(2)} remaining`);
      // Use only free/cheap options
      return task === 'chat' ? 'openai' : 'groq';
    }

    // Normal mode: use optimal providers
    return task === 'chat' ? 'claude' : 'groq';
  }
}
```

**Límites de presupuesto**:
```typescript
export const COST_LIMITS = {
  dailyMax: 10.00,      // $10/day maximum
  perUserMax: 0.50,     // $0.50/user maximum
  emergencyMode: 1.00,  // Switch to free/cheap at $1 remaining
}
```

---

## 7. Debugging y Monitoring

### 7.1 Sistema de Logs Estructurado

**Archivo**: `lib/logger.ts`

**Niveles de log**:
```typescript
logger.debug('[component] Message', { conversationId, metadata: {...} });
logger.info('Operation successful', { conversationId, metadata: {...} });
logger.warn('Unusual condition', { conversationId, metadata: {...} });
logger.error('Error occurred', error, { conversationId, metadata: {...} });
logger.performance('Operation', durationMs, { conversationId, metadata: {...} });
logger.decision('Decision point', 'Chosen path', { conversationId, metadata: {...} });
logger.functionEntry('functionName', { param1, param2 });
logger.functionExit('functionName', durationMs, result, { conversationId });
```

**Ejemplo de secuencia de logs**:
```
[webhook] Incoming POST request { requestId: 'lq2x5-abc123' }
[webhook] Request body received { requestId: 'lq2x5-abc123', bodyLength: 1234 }
[webhook] Signature validated successfully { requestId: 'lq2x5-abc123' }
[webhook] JSON parsed successfully { requestId: 'lq2x5-abc123', object: 'whatsapp_business_account' }
[webhook] Payload validated, extracting message { requestId: 'lq2x5-abc123', entryCount: 1 }
[webhook] Normalizing message { requestId: 'lq2x5-abc123', messageType: 'text', from: '521999***' }
[webhook] Webhook validated, processing in background { requestId: 'lq2x5-abc123', waMessageId: 'wamid.xxx' }
[background] Persisting message to database { requestId: 'lq2x5-abc123', waMessageId: 'wamid.xxx' }
[background] Message persisted successfully { requestId: 'lq2x5-abc123', conversationId: 'uuid', userId: 'uuid' }
[AI] Initialized managers { conversationId: 'uuid', userId: 'uuid' }
[AI] Getting conversation history { conversationId: 'uuid', userId: 'uuid' }
[AI] Conversation history retrieved { conversationId: 'uuid', userId: 'uuid', historyLength: 3 }
[AI] Checking for appointment { conversationId: 'uuid', userId: 'uuid' }
[SchedulingAgent] Extracting appointment { messageLength: 45 }
DECISION: Agent selection → SchedulingAgent - Executing autonomous action
[AI] Reminder created successfully { conversationId: 'uuid', userId: 'uuid', title: 'Llamar a mi mamá' }
PERFORMANCE: ProactiveAgent.respond 1234ms { inputTokens: 500, outputTokens: 150 }
FUNCTION_EXIT: processMessageWithAI 1456ms { agent: 'SchedulingAgent', actionExecuted: true }
```

### 7.2 Performance Metrics

**Token usage tracking**:
```typescript
// Automático en cada llamada a Claude
logger.performance('ProactiveAgent.respond', Date.now() - startTime, {
  metadata: {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    responseLength: content.text.length,
  },
});
```

**Latency tracking**:
```typescript
const startTime = Date.now();
// ... operation ...
logger.performance('Groq transcription', Date.now() - startTime, {
  conversationId,
  userId,
  metadata: { transcriptLength: transcript.length },
});
```

### 7.3 Error Handling Completo

**Estrategia de fallback en cascada**:

```typescript
try {
  // Primary: Claude Sonnet 4.5
  const response = await proactiveAgent.respond(userMessage, history);
  await sendTextAndPersist(conversationId, userPhone, response);
  await reactWithCheck(userPhone, messageId); // ✅

} catch (error: any) {
  logger.error('AI processing error', error, { conversationId, userId });
  await reactWithWarning(userPhone, messageId); // ⚠️

  try {
    // Fallback 1: OpenAI
    const fallbackResponse = await generateResponse({
      intent: 'casual_chat',
      conversationHistory: chatHistory,
      userMessage,
      userId,
    });
    await sendTextAndPersist(conversationId, userPhone, fallbackResponse);
    await reactWithCheck(userPhone, messageId); // Override ⚠️ with ✅
    logger.info('Fallback to OpenAI successful', { conversationId, userId });

  } catch (fallbackError: any) {
    logger.error('Fallback also failed', fallbackError, { conversationId, userId });

    // Fallback 2: Error message to user
    const errorMessage = 'Disculpa, tuve un problema al procesar tu mensaje. ¿Puedes intentar de nuevo?';
    await sendTextAndPersist(conversationId, userPhone, errorMessage);
    logger.info('Sent error message to user', { conversationId, userId });
  }
}
```

**Retry con backoff exponencial**:
```typescript
// lib/error-recovery.ts
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: {
    maxRetries?: number;        // Default: 3
    initialDelayMs?: number;    // Default: 1000
    backoffMultiplier?: number; // Default: 2
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, backoffMultiplier = 2 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      if (attempt === maxRetries || !isTransientError(error)) {
        throw error;
      }

      const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
```

### 7.4 Monitoring en Producción

**Vercel Dashboard**:
- Function logs (real-time)
- Performance metrics (p50, p95, p99)
- Error rate
- Invocation count

**Supabase Dashboard**:
- Query performance
- Database size
- Active connections
- Slow queries

**Custom metrics** (via logs):
```bash
# Ver logs en tiempo real
vercel logs --follow

# Filtrar por requestId
vercel logs | grep "requestId: 'lq2x5-abc123'"

# Buscar errores
vercel logs | grep "ERROR"

# Buscar decisiones de agentes
vercel logs | grep "DECISION"

# Performance de operaciones específicas
vercel logs | grep "PERFORMANCE: ProactiveAgent"
```

---

## 8. Referencias de Código

### 8.1 Archivos Clave

| Archivo | Propósito | Líneas clave |
|---------|-----------|--------------|
| `app/api/whatsapp/webhook/route.ts` | Webhook endpoint | 49-210 (POST), 216-475 (background) |
| `lib/ai-processing-v2.ts` | AI processing pipeline | 79-357 (chat), 362-491 (audio), 496-649 (OCR) |
| `lib/ai-providers.ts` | Multi-provider manager | 52-183 (AIProviderManager) |
| `lib/claude-agents.ts` | Specialized agents | 31-124 (Proactive), 130-236 (Scheduling), 242-345 (Finance) |
| `lib/claude-client.ts` | Claude SDK wrapper | 35-55 (client), 61-109 (completion) |
| `lib/context.ts` | Conversation history | 16-33 (get history), 39-48 (convert to messages) |
| `lib/message-normalization.ts` | WhatsApp message parsing | whatsAppMessageToNormalized() |
| `lib/persist.ts` | Database operations | persistNormalizedMessage(), insertOutboundMessage() |
| `lib/whatsapp.ts` | WhatsApp API client | sendWhatsAppText(), reactWithCheck(), typing |
| `lib/groq-client.ts` | Groq audio transcription | transcribeWithGroq() |
| `lib/tesseract-ocr.ts` | Free OCR | extractTextFromImage() |
| `lib/error-recovery.ts` | Retry logic | retryWithBackoff(), isDuplicateError() |

### 8.2 Funciones Principales

**Webhook Processing**:
```typescript
// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request): Promise<Response>         // :49
async function processWebhookInBackground(...)                       // :216
```

**AI Processing**:
```typescript
// lib/ai-processing-v2.ts
export async function processMessageWithAI(...)                      // :79
export async function processAudioMessage(...)                       // :362
export async function processDocumentMessage(...)                    // :496
```

**Claude Agents**:
```typescript
// lib/claude-agents.ts
class ProactiveAgent {
  async respond(userMessage, conversationHistory): Promise<string>  // :70
}

class SchedulingAgent {
  async extractAppointment(userMessage): Promise<...>               // :169
}

class FinanceAgent {
  async extractExpense(userMessage): Promise<...>                   // :280
}
```

**Context Management**:
```typescript
// lib/context.ts
export async function getConversationHistory(conversationId, limit) // :16
export function historyToChatMessages(history)                      // :39
```

**Provider Management**:
```typescript
// lib/ai-providers.ts
export class AIProviderManager {
  async selectProvider(task: TaskType): Promise<ProviderName>      // :82
  trackSpending(amount, provider, task)                             // :151
  getSpendingStatus()                                               // :167
}

export function getProviderManager(): AIProviderManager             // :188
```

### 8.3 Comandos Útiles

**Development**:
```bash
npm run dev          # Start Vercel dev server (http://localhost:3000)
npm run build        # Compile TypeScript + Next.js
npm run typecheck    # Type check without emit
npm run test         # Run all tests (Jest + Playwright)
npm run test:unit    # Jest only
```

**Deployment**:
```bash
npm run pre-deploy   # Quick validation (typecheck + build)
npm run verify-deploy # Full validation (typecheck + build + tests)
git push origin main # Auto-deploy to Vercel
```

**Debugging**:
```bash
vercel logs --follow              # Real-time logs
vercel logs | grep "ERROR"        # Filter errors
vercel logs | grep "conversationId: 'uuid'" # Filter by conversation
```

**Database**:
```bash
npx supabase db pull              # Pull schema changes
npx supabase db push              # Push schema changes
npx supabase db reset             # Reset database (dev only)
```

### 8.4 Documentación Externa

**WhatsApp Cloud API**:
- [Official docs](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message types](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/message-types)
- [Interactive messages](https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-messages)

**Claude SDK**:
- [Anthropic SDK docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Messages API](https://docs.anthropic.com/claude/reference/messages_post)
- [Pricing](https://www.anthropic.com/api)

**Vercel Edge Functions**:
- [Edge Runtime](https://vercel.com/docs/functions/edge-functions)
- [waitUntil() API](https://vercel.com/docs/functions/edge-functions/edge-functions-api#waituntil)
- [Limits & pricing](https://vercel.com/docs/functions/edge-functions/limits-and-pricing)

**Groq**:
- [Groq API docs](https://console.groq.com/docs)
- [Whisper pricing](https://groq.com/pricing/)

**Supabase**:
- [PostgreSQL docs](https://supabase.com/docs/guides/database)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## Apéndice A: Costos Detallados

### Comparativa de Proveedores (por 1,000 mensajes)

| Escenario | Claude | OpenAI | Ahorro |
|-----------|--------|--------|--------|
| **Chat (1,000 mensajes, 500 tokens/msg)** | | | |
| Input (500K tokens) | $1.50 | $7.50 | 80% |
| Output (300K tokens) | $4.50 | $18.00 | 75% |
| **Total chat** | **$6.00** | **$25.50** | **76%** |
| | | | |
| **Audio (100 minutos)** | | | |
| Groq Whisper | $0.08 | - | - |
| OpenAI Whisper | - | $0.60 | 93% |
| **Total audio** | **$0.08** | **$0.60** | **93%** |
| | | | |
| **OCR (100 imágenes)** | | | |
| Tesseract | $0.00 | - | - |
| OpenAI Vision | - | $0.20 | 100% |
| **Total OCR** | **$0.00** | **$0.20** | **100%** |
| | | | |
| **TOTAL (1,000 msgs + 100 min + 100 imgs)** | **$6.08** | **$26.30** | **77%** |

### Proyección Mensual (3,000 usuarios activos)

| Métrica | Valor |
|---------|-------|
| Mensajes/día | 5,000 |
| Audios/día | 500 minutos |
| Imágenes/día | 200 |
| **Costo diario (Claude + Groq)** | **$35** |
| **Costo diario (OpenAI solo)** | **$145** |
| **Ahorro diario** | **$110 (76%)** |
| | |
| **Costo mensual (Claude + Groq)** | **$1,050** |
| **Costo mensual (OpenAI solo)** | **$4,350** |
| **Ahorro mensual** | **$3,300 (76%)** |

---

## Apéndice B: Troubleshooting

### Problema: "ANTHROPIC_API_KEY not set"

**Síntoma**: Error al procesar mensajes con Claude.

**Solución**:
```bash
# 1. Verificar .env.local
cat .env.local | grep ANTHROPIC_API_KEY

# 2. Verificar en Vercel
vercel env pull .env.local

# 3. Si falta, agregar:
vercel env add ANTHROPIC_API_KEY
```

### Problema: Webhook timeout (>5s)

**Síntoma**: WhatsApp reenvía webhooks múltiples veces.

**Solución**: El patrón fire-and-forget está activo. Verificar logs:
```bash
vercel logs | grep "Webhook validated, processing in background"
```

### Problema: Mensajes duplicados

**Síntoma**: Usuario recibe respuestas dobles.

**Solución**: Deduplicación en database. Verificar:
```sql
SELECT wa_message_id, COUNT(*)
FROM messages_v2
GROUP BY wa_message_id
HAVING COUNT(*) > 1;
```

### Problema: Audio transcription fails

**Síntoma**: Audios no se procesan.

**Solución**:
1. Verificar `GROQ_API_KEY`
2. Fallback a OpenAI automático
3. Revisar logs: `vercel logs | grep "Audio processing"`

### Problema: High costs

**Síntoma**: Gasto diario >$10.

**Solución**:
1. Verificar tracking: `vercel logs | grep "Cost tracked"`
2. Revisar emergency mode: `vercel logs | grep "Low budget"`
3. Ajustar `COST_LIMITS.dailyMax` en `lib/ai-providers.ts:24`

---

## Changelog

### 2025-10-06
- ✅ Initial version
- ✅ Multi-provider AI system (Claude + Groq + Tesseract)
- ✅ Specialized agents (Proactive, Scheduling, Finance)
- ✅ Fire-and-forget webhook pattern
- ✅ Cost tracking system
- ✅ 76% cost savings vs OpenAI-only

---

**Autor**: System Analysis
**Última actualización**: 2025-10-06
**Versión del sistema**: 2.0 (Multi-Provider AI)
