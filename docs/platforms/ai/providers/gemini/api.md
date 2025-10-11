# Gemini API Reference

Complete API reference for Gemini 2.5 Flash integration in migue.ai WhatsApp Assistant.

---

## Table of Contents

- [Model Specifications](#model-specifications)
- [Rate Limits & Quotas](#rate-limits--quotas)
- [Core Functions](#core-functions)
- [Type Definitions](#type-definitions)
- [Error Codes](#error-codes)
- [Code Examples](#code-examples)

---

## Model Specifications

### Gemini 2.5 Flash (Stable)

**Model ID:** `gemini-2.5-flash`

| Property | Value |
|----------|-------|
| **Input Types** | Text, images, video, audio |
| **Output Types** | Text |
| **Context Window** | 1,048,576 tokens (1M) |
| **Output Limit** | 65,536 tokens (65K) |
| **Knowledge Cutoff** | January 2025 |
| **Last Update** | June 2025 |

**Key Capabilities:**
- ✅ Batch API support
- ✅ Context caching (75% cost savings)
- ✅ Code execution
- ✅ Function calling
- ✅ Search grounding
- ✅ Structured outputs (JSON mode)
- ✅ Thinking mode

**Pricing (Paid Tier):**
- Input: $0.30 per 1M tokens (text/image/video), $1.00 (audio)
- Output: $2.50 per 1M tokens
- Context caching: $0.03 per 1M tokens (text/image/video), $0.10 (audio)

### Gemini 2.5 Flash-Lite (FREE Tier)

**Model ID:** `gemini-2.5-flash-lite`

| Property | Value |
|----------|-------|
| **Input Types** | Text, images |
| **Output Types** | Text |
| **Context Window** | 1,048,576 tokens (1M) |
| **Output Limit** | 8,192 tokens (8K) |
| **Free Tier** | 1,500 requests/day |

**Key Capabilities:**
- ✅ Function calling
- ✅ Context caching (implicit only)
- ✅ Structured outputs
- ⚠️ No audio/video (text + images only)

**Pricing:**
- **FREE** within 1,500 requests/day
- Exceeding limit: Falls back to paid tier pricing

**🎯 migue.ai Default:** We use `gemini-2.5-flash-lite` to maximize free tier usage.

---

## Rate Limits & Quotas

### Free Tier Limits

| Limit Type | Value | Reset Period |
|------------|-------|--------------|
| **Requests per day (RPD)** | 1,500 | Midnight Pacific |
| **Requests per minute (RPM)** | 15 | Rolling window |
| **Tokens per minute (TPM)** | 1,000,000 | Rolling window |
| **Concurrent requests** | 3 | Real-time |

**Buffer Strategy:** We use 1,400 as soft limit (100-request buffer) to avoid hitting hard limit.

### Paid Tier Limits (Tier 1)

| Limit Type | Value |
|------------|-------|
| **Requests per day** | 10,000 |
| **Requests per minute** | 150 |
| **Tokens per minute** | 2,000,000 |
| **Batch enqueued tokens** | 5,000,000 |

**Upgrade Process:**
1. Enable Cloud Billing in Google Cloud project
2. Spend >$250 to reach Tier 2 (higher limits)
3. Spend >$1,000 for Tier 3 (enterprise limits)

### migue.ai Usage Tracking

**Current Implementation** (`lib/gemini-client.ts:122-187`):

```typescript
interface GeminiUsageTracker {
  dailyRequests: number;
  dailyTokens: number;
  lastReset: Date;
}

// Check if within free tier
export function canUseFreeTier(): boolean {
  const now = new Date();

  // Reset daily counters at midnight
  if (now.getDate() !== usageTracker.lastReset.getDate()) {
    usageTracker = {
      dailyRequests: 0,
      dailyTokens: 0,
      lastReset: now
    };
  }

  // 1,400 request soft limit (100 buffer)
  return usageTracker.dailyRequests < 1400;
}

// Track usage after each request
export function trackGeminiUsage(tokens: number) {
  usageTracker.dailyRequests++;
  usageTracker.dailyTokens += tokens;

  // Warn at 80% capacity
  if (usageTracker.dailyRequests > 1200) {
    logger.warn('[gemini-client] Approaching daily limit', {
      metadata: {
        used: usageTracker.dailyRequests,
        limit: 1500,
        remaining: 1500 - usageTracker.dailyRequests
      }
    });
  }
}
```

⚠️ **Known Issue:** In-memory tracking resets on Edge Function cold starts. See [troubleshooting](../04-features/GEMINI-TROUBLESHOOTING.md#free-tier-tracking-issues).

---

## Core Functions

### getGeminiClient()

Get or create Gemini client instance (lazy initialization).

**Signature:**
```typescript
function getGeminiClient(): GoogleGenerativeAI
```

**Returns:** Cached `GoogleGenerativeAI` instance

**Example:**
```typescript
import { getGeminiClient } from '@/lib/gemini-client';

const client = getGeminiClient();
// Client is cached - subsequent calls return same instance
```

**Error Handling:**
```typescript
try {
  const client = getGeminiClient();
} catch (error) {
  // Error: "GOOGLE_AI_API_KEY not set"
  logger.error('Gemini client initialization failed', error);
}
```

**Performance:** First call ~50ms, subsequent calls <1ms (cached)

---

### getGeminiModel()

Get or create Gemini model instance with optional system instruction.

**Signature:**
```typescript
function getGeminiModel(
  modelName: GeminiModelName = 'gemini-2.5-flash-lite',
  systemInstruction?: string
): GenerativeModel
```

**Parameters:**
- `modelName` - Model to use (default: `gemini-2.5-flash-lite`)
- `systemInstruction` - Optional system prompt

**Returns:** Cached `GenerativeModel` instance

**Example:**
```typescript
import { getGeminiModel } from '@/lib/gemini-client';

// Basic usage
const model = getGeminiModel();

// With system instruction (Colombian Spanish)
const model = getGeminiModel(
  'gemini-2.5-flash-lite',
  'Eres Migue, un asistente colombiano amigable...'
);
```

**Model Configuration:**
```typescript
{
  model: 'gemini-2.5-flash-lite',
  generationConfig: {
    temperature: 0.7,      // Creativity (0.0-1.0)
    topK: 40,              // Sampling diversity
    topP: 0.95,            // Nucleus sampling
    maxOutputTokens: 2048  // Max response length
  },
  systemInstruction: '...' // Optional
}
```

---

### generateContent()

Generate content with automatic fallback and tool support.

**Signature:**
```typescript
async function generateContent(
  prompt: string,
  options?: {
    systemInstruction?: string;
    tools?: FunctionDeclaration[];
    history?: Content[];
    modelName?: GeminiModelName;
  }
): Promise<{
  text: string;
  functionCalls: GeminiFunctionResult[] | null;
  model: string;
  cost: number;
}>
```

**Parameters:**
- `prompt` - User message/query
- `options.systemInstruction` - Override default system prompt
- `options.tools` - Function declarations for tool calling
- `options.history` - Conversation history (Gemini format)
- `options.modelName` - Override default model

**Returns:**
- `text` - Generated response text
- `functionCalls` - Extracted function calls (if any)
- `model` - Model name used
- `cost` - Cost in USD (0 for free tier)

**Example:**
```typescript
import { generateContent } from '@/lib/gemini-client';

// Basic chat
const response = await generateContent('¿Cómo estás?');
console.log(response.text); // "¡Muy bien! ¿Y tú?"

// With conversation history
const response = await generateContent('¿Y el clima?', {
  history: [
    { role: 'user', parts: [{ text: 'Hola' }] },
    { role: 'model', parts: [{ text: '¡Hola! ¿Cómo estás?' }] }
  ]
});

// With function calling
const response = await generateContent('Recuérdame comprar leche mañana', {
  tools: [createReminderTool]
});

if (response.functionCalls) {
  // Execute tools...
}
```

**Error Handling:**
```typescript
try {
  const response = await generateContent(prompt);
} catch (error) {
  if (error.message.includes('free tier limit')) {
    // Fallback to GPT-4o-mini
    logger.info('Switching to paid provider');
  } else {
    // Unexpected error
    logger.error('Generation failed', error);
  }
}
```

---

### streamContent()

Stream content generation for long responses (async generator).

**Signature:**
```typescript
async function* streamContent(
  prompt: string,
  options?: {
    systemInstruction?: string;
    history?: Content[];
    modelName?: GeminiModelName;
  }
): AsyncGenerator<string>
```

**Parameters:** Same as `generateContent` (no tools support in streaming)

**Yields:** String chunks as they're generated

**Example:**
```typescript
import { streamContent } from '@/lib/gemini-client';

const stream = streamContent('Explica la teoría de la relatividad');

for await (const chunk of stream) {
  process.stdout.write(chunk); // Print as received
}
```

**Use Cases:**
- Long-form content (blog posts, summaries)
- Real-time UI updates
- Reducing perceived latency

⚠️ **Note:** Not currently integrated in webhook flow (future feature).

---

### analyzeImageWithGemini()

Analyze images using Gemini Vision API (multi-modal).

**Signature:**
```typescript
async function analyzeImageWithGemini(
  imageBuffer: Uint8Array,
  prompt: string,
  options?: {
    mimeType?: string;
    modelName?: GeminiModelName;
  }
): Promise<{
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}>
```

**Parameters:**
- `imageBuffer` - Image data (Uint8Array from WhatsApp)
- `prompt` - Analysis instructions
- `options.mimeType` - Image MIME type (default: `image/jpeg`)
- `options.modelName` - Model to use (default: `gemini-2.5-flash-lite`)

**Returns:**
- `text` - Analysis result
- `usage` - Token consumption details

**Example:**
```typescript
import { analyzeImageWithGemini } from '@/lib/gemini-client';

// OCR for expense tracking
const result = await analyzeImageWithGemini(
  imageBuffer,
  'Extrae el monto total y los items de este recibo'
);

console.log(result.text);
// "Total: $45,000 COP
//  Items:
//  - Café: $8,000
//  - Arepa: $12,000
//  - ..."
```

**Use Cases:**
- Expense tracking (receipts, invoices)
- Document OCR (better than Tesseract for structured data)
- Product recognition
- Scene understanding

**Cost:** $0 within free tier (~38 images/day at 40K tokens/image)

---

### convertToGeminiMessages()

Convert OpenAI/Claude chat format to Gemini format.

**Signature:**
```typescript
function convertToGeminiMessages(messages: ChatMessage[]): Content[]
```

**Parameters:**
- `messages` - Array of `ChatMessage` (migue.ai format)

**Returns:** Array of `Content` (Gemini format)

**Example:**
```typescript
import { convertToGeminiMessages } from '@/lib/gemini-client';

const history = [
  { role: 'user', content: 'Hola' },
  { role: 'assistant', content: '¡Hola! ¿Cómo estás?' }
];

const geminiHistory = convertToGeminiMessages(history);
// [
//   { role: 'user', parts: [{ text: 'Hola' }] },
//   { role: 'model', parts: [{ text: '¡Hola! ¿Cómo estás?' }] }
// ]
```

**Note:** Gemini uses `'model'` instead of `'assistant'` for AI responses.

---

### parseGeminiResponse()

Extract text, function calls, and usage from Gemini response.

**Signature:**
```typescript
function parseGeminiResponse(result: GenerateContentResult): {
  text: string;
  functionCalls: GeminiFunctionResult[] | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } | null;
}
```

**Parameters:**
- `result` - Raw Gemini API response

**Returns:**
- `text` - Generated text content
- `functionCalls` - Parsed function calls (or null)
- `usage` - Token consumption metadata

**Example:**
```typescript
import { parseGeminiResponse } from '@/lib/gemini-client';

const result = await chat.sendMessage('Recuérdame...');
const parsed = parseGeminiResponse(result);

if (parsed.functionCalls) {
  // Handle tool calls
  for (const call of parsed.functionCalls) {
    console.log(call.name);  // 'create_reminder'
    console.log(call.args);  // { title: '...', datetime: '...' }
  }
}

// Track token usage
trackGeminiUsage(parsed.usage.totalTokens);
```

---

## Type Definitions

### GeminiModelName

```typescript
type GeminiModelName =
  | 'gemini-2.5-flash'       // Stable, paid tier
  | 'gemini-2.5-flash-lite'  // FREE tier (our default)
  | 'gemini-2.5-pro';        // High quality, expensive
```

### GeminiFunctionResult

```typescript
interface GeminiFunctionResult {
  name: string;                    // Function name
  args: Record<string, unknown>;   // Function arguments
}
```

### GeminiUsageTracker

```typescript
interface GeminiUsageTracker {
  dailyRequests: number;  // Requests today
  dailyTokens: number;    // Tokens consumed today
  lastReset: Date;        // Last reset timestamp
}
```

### Content (Gemini Format)

```typescript
interface Content {
  role: 'user' | 'model';  // Message sender
  parts: Part[];           // Message parts
}

interface Part {
  text?: string;           // Text content
  inlineData?: {           // Image/file content
    data: string;          // Base64 encoded
    mimeType: string;      // MIME type
  };
}
```

---

## Error Codes

### Common Errors

| Error Message | Cause | Solution |
|--------------|-------|----------|
| `GOOGLE_AI_API_KEY not set` | Missing environment variable | Add `GOOGLE_AI_API_KEY` to `.env.local` |
| `Daily free tier limit reached` | Exceeded 1,500 requests/day | Wait until midnight PT or use fallback |
| `Rate limit exceeded` | >15 requests/minute | Add retry with exponential backoff |
| `Invalid model name` | Wrong model ID | Use `gemini-2.5-flash-lite` or `gemini-2.5-flash` |
| `Context too large` | >1M tokens | Truncate conversation history |
| `Invalid API key` | Wrong/expired key | Regenerate API key in Google AI Studio |

### Error Handling Pattern

```typescript
import { generateContent } from '@/lib/gemini-client';
import { logger } from '@/lib/logger';

async function safeGenerate(prompt: string) {
  try {
    return await generateContent(prompt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Free tier exhausted - expected
    if (message.includes('free tier limit')) {
      logger.info('Gemini free tier exhausted, using fallback');
      return await openaiGenerate(prompt); // Fallback
    }

    // Rate limit - retry
    if (message.includes('Rate limit')) {
      logger.warn('Gemini rate limit hit, retrying in 4s');
      await new Promise(r => setTimeout(r, 4000));
      return await generateContent(prompt);
    }

    // Unexpected error - escalate
    logger.error('Gemini generation failed', error);
    throw error;
  }
}
```

---

## Code Examples

### Basic Chat

```typescript
import { getGeminiModel } from '@/lib/gemini-client';

async function chat(message: string) {
  const model = getGeminiModel('gemini-2.5-flash-lite');
  const chat = model.startChat();

  const result = await chat.sendMessage(message);
  return result.response.text();
}

// Usage
const response = await chat('¿Qué hora es en Bogotá?');
console.log(response);
```

### Chat with History

```typescript
import { getGeminiModel, convertToGeminiMessages } from '@/lib/gemini-client';

async function chatWithHistory(message: string, history: ChatMessage[]) {
  const model = getGeminiModel('gemini-2.5-flash-lite');

  // Convert history to Gemini format
  const geminiHistory = convertToGeminiMessages(history);

  // Start chat with history
  const chat = model.startChat({ history: geminiHistory });

  // Send new message
  const result = await chat.sendMessage(message);
  return result.response.text();
}
```

### Function Calling (Tool Use)

```typescript
import { generateContent } from '@/lib/gemini-client';
import { SchemaType } from '@google/generative-ai';

// Define tool
const createReminderTool = {
  name: 'create_reminder',
  description: 'Crea un recordatorio para el usuario',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      title: { type: SchemaType.STRING },
      datetime: { type: SchemaType.STRING }
    },
    required: ['title', 'datetime']
  }
};

// Generate with tool support
const response = await generateContent(
  'Recuérdame comprar leche mañana a las 9am',
  { tools: [createReminderTool] }
);

// Handle function calls
if (response.functionCalls) {
  for (const call of response.functionCalls) {
    if (call.name === 'create_reminder') {
      await createReminder(
        userId,
        call.args.title as string,
        null,
        call.args.datetime as string
      );
    }
  }
}
```

### Image Analysis

```typescript
import { analyzeImageWithGemini } from '@/lib/gemini-client';

async function analyzeReceipt(imageBuffer: Uint8Array) {
  const result = await analyzeImageWithGemini(
    imageBuffer,
    `Analiza este recibo y extrae:
    1. Monto total
    2. Lista de items con precios
    3. Fecha y hora
    4. Establecimiento

    Responde en formato JSON.`
  );

  return JSON.parse(result.text);
}

// Usage
const data = await analyzeReceipt(receiptImage);
console.log(data);
// {
//   total: 45000,
//   items: [
//     { name: "Café", price: 8000 },
//     { name: "Arepa", price: 12000 }
//   ],
//   date: "2025-10-11",
//   merchant: "Restaurante El Buen Sabor"
// }
```

### Context Caching

```typescript
import { getCachedContext, setCachedContext, getGeminiModel } from '@/lib/gemini-client';

async function chatWithCaching(userId: string, message: string) {
  const cacheKey = `user_${userId}_history`;

  // Try to get cached history
  let history = getCachedContext(cacheKey);

  if (!history) {
    // Load from database
    const dbHistory = await getConversationHistory(userId);
    history = convertToGeminiMessages(dbHistory.slice(-10));

    // Cache for future requests
    setCachedContext(cacheKey, history);
  }

  // Use cached history
  const model = getGeminiModel('gemini-2.5-flash-lite');
  const chat = model.startChat({ history });

  const result = await chat.sendMessage(message);
  return result.response.text();
}
```

---

## Performance Tips

### 1. Lazy Loading

```typescript
// ❌ Bad: Initialize client at module level
const client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// ✅ Good: Lazy initialization
let cachedClient: GoogleGenerativeAI | null = null;

export function getGeminiClient() {
  if (!cachedClient) {
    cachedClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  }
  return cachedClient;
}
```

**Benefit:** Reduces cold start time by ~50ms

### 2. Model Caching

```typescript
// ❌ Bad: Create new model each time
async function chat(message: string) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  // ...
}

// ✅ Good: Cache model instances
const cachedModels = new Map<string, GenerativeModel>();

export function getGeminiModel(modelName: string) {
  if (!cachedModels.has(modelName)) {
    const client = getGeminiClient();
    cachedModels.set(modelName, client.getGenerativeModel({ model: modelName }));
  }
  return cachedModels.get(modelName)!;
}
```

**Benefit:** Reduces latency by ~100ms per request

### 3. Context Truncation

```typescript
// Limit conversation history to last 10 messages
const recentHistory = conversationHistory.slice(-10);
const geminiHistory = convertToGeminiMessages(recentHistory);
```

**Benefit:** Reduces token usage by 50-70%

---

## Monitoring & Observability

### Logging Usage

```typescript
import { trackGeminiUsage } from '@/lib/gemini-client';
import { logger } from '@/lib/logger';

const response = await generateContent(prompt);

// Log usage
logger.info('[gemini-api] Request completed', {
  metadata: {
    promptLength: prompt.length,
    responseLength: response.text.length,
    tokensUsed: response.usage?.totalTokens || 0,
    cost: '$0.00 (free tier)',
    model: response.model
  }
});
```

### Daily Usage Report

```typescript
import { usageTracker } from '@/lib/gemini-client';

function getDailyUsageReport() {
  return {
    requests: usageTracker.dailyRequests,
    tokens: usageTracker.dailyTokens,
    limit: 1500,
    remaining: 1500 - usageTracker.dailyRequests,
    percentUsed: (usageTracker.dailyRequests / 1500) * 100,
    resetAt: 'Midnight Pacific Time'
  };
}

// Log every hour
setInterval(() => {
  logger.info('[gemini-api] Daily usage', {
    metadata: getDailyUsageReport()
  });
}, 3600000); // 1 hour
```

---

## See Also

- [Gemini Integration Guide](../04-features/GEMINI-INTEGRATION.md)
- [Function Calling](../04-features/GEMINI-FUNCTION-CALLING.md)
- [Cost Optimization](../04-features/GEMINI-COST-OPTIMIZATION.md)
- [Troubleshooting](../04-features/GEMINI-TROUBLESHOOTING.md)

---

**Last Updated:** 2025-10-11
**API Version:** Gemini 2.5 (January 2025 knowledge cutoff)
**SDK Version:** @google/generative-ai v0.21.0
