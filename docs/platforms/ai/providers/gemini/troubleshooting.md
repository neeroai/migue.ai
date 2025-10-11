# Gemini Troubleshooting Guide

Complete troubleshooting guide for Gemini 2.5 Flash integration issues in migue.ai.

---

## Table of Contents

- [Common Errors](#common-errors)
- [API Key Issues](#api-key-issues)
- [Free Tier Limits](#free-tier-limits)
- [Function Calling Problems](#function-calling-problems)
- [Cache Not Working](#cache-not-working)
- [Fallback Chain Issues](#fallback-chain-issues)
- [Performance Problems](#performance-problems)
- [Testing Strategies](#testing-strategies)

---

## Common Errors

### Error: "GOOGLE_AI_API_KEY not set"

**Symptom:**

```
Error: GOOGLE_AI_API_KEY not set
at getGeminiClient (lib/gemini-client.ts:28)
```

**Cause:** Missing or misconfigured API key

**Solutions:**

**1. Local Development:**

```bash
# Check if .env.local exists
cat .env.local | grep GOOGLE_AI_API_KEY

# If missing, add it
echo "GOOGLE_AI_API_KEY=your_key_here" >> .env.local

# Restart dev server
npm run dev
```

**2. Production (Vercel):**

```bash
# Check if variable exists
vercel env ls

# If missing, add it
vercel env add GOOGLE_AI_API_KEY production

# Redeploy
vercel --prod
```

**3. Verify in Code:**

```typescript
// Add diagnostic check
const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey) {
  logger.error('[gemini-client] API key not configured');
  throw new Error('GOOGLE_AI_API_KEY not set');
}
logger.info('[gemini-client] API key found', {
  metadata: { keyLength: apiKey.length }
});
```

**Prevention:**

Add to pre-deployment checklist:

```bash
# scripts/check-env.sh
#!/bin/bash
if [ -z "$GOOGLE_AI_API_KEY" ]; then
  echo "❌ ERROR: GOOGLE_AI_API_KEY not set"
  exit 1
fi
echo "✅ GOOGLE_AI_API_KEY configured"
```

---

### Error: "Daily free tier limit reached"

**Symptom:**

```
Error: Daily free tier limit reached, use fallback
at generateContent (lib/gemini-client.ts:209)
```

**Cause:** Exceeded 1,500 requests/day

**Immediate Solution:**

System **automatically falls back** to GPT-4o-mini - no action needed!

```typescript
// lib/ai-providers.ts:91-102
if (!canUseFreeTier()) {
  logger.info('[AIProviderManager] Gemini limit reached, using OpenAI');
  return 'openai'; // Automatic fallback
}
```

**Monitoring:**

```typescript
// Check current usage
import { getGeminiMetrics } from '@/lib/gemini-client';

const metrics = getGeminiMetrics();
console.log(`Usage: ${metrics.dailyRequests}/1500 (${metrics.percentUsed}%)`);
```

**Long-term Solutions:**

1. **Optimize request volume:**
   - Batch non-urgent requests
   - Cache more aggressively
   - Reduce proactive messages

2. **Upgrade to paid tier (if needed):**
   ```bash
   # Enable Cloud Billing in Google Cloud Console
   # Tier 1: 10,000 requests/day
   # Cost: $0.30/$2.50 per 1M tokens
   ```

3. **Fix usage tracking** (see [Free Tier Tracking Issues](#free-tier-tracking-issues))

---

### Error: "Rate limit exceeded"

**Symptom:**

```
Error: 429 Too Many Requests
Resource has been exhausted (e.g. check quota)
```

**Causes:**

1. **RPM limit** (15 requests/minute)
2. **TPM limit** (1M tokens/minute)
3. **Concurrent requests** (3 max)

**Solutions:**

**1. Add Retry with Exponential Backoff:**

```typescript
async function generateWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateContent(prompt);
    } catch (error) {
      if (error.message.includes('429') && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        logger.warn(`[gemini-client] Rate limited, retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
}
```

**2. Implement Rate Limiting:**

```typescript
// Simple rate limiter (15 req/min)
let requestTimestamps: number[] = [];

function checkRateLimit(): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  // Remove old timestamps
  requestTimestamps = requestTimestamps.filter(t => t > oneMinuteAgo);

  // Check if under limit
  if (requestTimestamps.length >= 15) {
    return false; // Rate limited
  }

  // Add current timestamp
  requestTimestamps.push(now);
  return true;
}

// Usage
if (!checkRateLimit()) {
  logger.warn('[gemini-client] Rate limit reached, waiting...');
  await new Promise(r => setTimeout(r, 5000)); // Wait 5s
}
```

**3. Reduce Concurrent Requests:**

```typescript
// Queue requests to limit concurrency
const queue: Array<() => Promise<unknown>> = [];
let activeRequests = 0;
const MAX_CONCURRENT = 2; // Below limit of 3

async function queuedGenerate(prompt: string) {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        activeRequests++;
        const result = await generateContent(prompt);
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        activeRequests--;
        processQueue();
      }
    });

    processQueue();
  });
}

function processQueue() {
  if (queue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const next = queue.shift();
    next?.();
  }
}
```

---

### Error: "Invalid model name"

**Symptom:**

```
Error: Model 'gemini-2.0-flash' not found
```

**Cause:** Using wrong or outdated model name

**Solution:**

**Valid Model Names:**

```typescript
// ✅ Correct names
'gemini-2.5-flash'         // Stable, paid tier
'gemini-2.5-flash-lite'    // FREE tier (our default)
'gemini-2.5-pro'           // High quality

// ❌ Wrong names
'gemini-2.0-flash'         // Old version
'gemini-flash-2.5'         // Wrong format
'gemini'                   // Too generic
```

**Update Code:**

```typescript
// lib/gemini-client.ts:15
export type GeminiModelName =
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.5-pro';

// Always use type-safe names
const model = getGeminiModel('gemini-2.5-flash-lite'); // ✅
```

---

## API Key Issues

### Issue: Invalid API Key

**Symptom:**

```
Error: 401 Unauthorized
Invalid API key
```

**Causes:**
1. Typo in API key
2. Key expired or revoked
3. Key not enabled for Gemini API

**Solutions:**

**1. Regenerate API Key:**

Visit [Google AI Studio](https://aistudio.google.com/) → Get API Key → Create new key

**2. Verify Key Format:**

```typescript
// Valid format: AIza...
const apiKey = process.env.GOOGLE_AI_API_KEY;
if (!apiKey.startsWith('AIza')) {
  logger.error('[gemini-client] Invalid API key format');
}
```

**3. Test Key:**

```bash
# Test with curl
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=YOUR_API_KEY"
```

### Issue: API Key Not Found in Tests

**Symptom:**

```bash
$ npm test
FAIL tests/gemini/01-basic-connection.test.ts
Error: GOOGLE_AI_API_KEY not set
```

**Cause:** Environment variable not loaded in test environment

**Solution:**

**1. Create Test Environment File:**

```bash
# .env.test
GOOGLE_AI_API_KEY=your_test_key_here
```

**2. Update Jest Config:**

```javascript
// jest.config.js
module.exports = {
  testEnvironment: '@edge-runtime/jest-environment',
  setupFiles: ['<rootDir>/tests/setup.ts']
};
```

**3. Load Env in Setup:**

```typescript
// tests/setup.ts
import dotenv from 'dotenv';
import path from 'path';

// Load .env.test
dotenv.config({
  path: path.resolve(__dirname, '../.env.test')
});

// Verify API key loaded
if (!process.env.GOOGLE_AI_API_KEY) {
  throw new Error('GOOGLE_AI_API_KEY not set in test environment');
}
```

**4. Run Tests:**

```bash
npm test -- tests/gemini
# All tests should now pass
```

---

## Free Tier Limits

### Free Tier Tracking Issues

**Symptom:**

Usage counter resets randomly, may exceed 1,500 req/day without detection

**Cause:**

In-memory tracking resets on Edge Function cold starts (see [GEMINI-COST-OPTIMIZATION.md](./GEMINI-COST-OPTIMIZATION.md#persistent-usage-tracking))

**Current Broken Implementation:**

```typescript
// lib/gemini-client.ts:128-145
let usageTracker: GeminiUsageTracker = {
  dailyRequests: 0, // ❌ Resets on cold start!
  dailyTokens: 0,
  lastReset: new Date()
};
```

**Fix: Migrate to Supabase**

**1. Create Table:**

```sql
-- supabase/migrations/004_gemini_usage_tracking.sql
CREATE TABLE gemini_usage (
  date DATE PRIMARY KEY,
  requests INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  cost DECIMAL(10, 4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**2. Update Implementation:**

```typescript
// lib/gemini-client.ts (updated)
export async function canUseFreeTier(): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('gemini_usage')
    .select('requests')
    .eq('date', today)
    .single();

  const currentRequests = data?.requests || 0;
  return currentRequests < 1400; // 100 buffer
}

export async function trackGeminiUsage(tokens: number) {
  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0];

  await supabase.rpc('increment_gemini_usage', {
    usage_date: today,
    token_count: tokens
  });
}
```

**3. Deploy Fix:**

```bash
# Apply migration
npm run db:migrate

# Deploy updated code
git add . && git commit -m "fix: persistent Gemini usage tracking"
git push origin main
```

**Verification:**

```sql
-- Check usage in Supabase Dashboard
SELECT * FROM gemini_usage ORDER BY date DESC LIMIT 7;
```

---

## Function Calling Problems

### Issue: Tools Not Being Called

**Symptom:**

User requests action but bot responds with text instead of executing tool

```
User: "Recuérdame comprar leche mañana"
Bot: "Claro, te puedo recordar..." ❌ (No tool called)
```

**Causes:**

1. **Unclear tool description**
2. **System prompt doesn't encourage tools**
3. **Model temperature too high**

**Solutions:**

**1. Improve Tool Descriptions:**

```typescript
// ❌ Bad: Vague description
description: 'Create reminder'

// ✅ Good: Explicit and detailed
description: 'Crea un recordatorio para el usuario con fecha, hora específica y notas opcionales. Detecta intenciones como "recuérdame", "avísame", "no olvides". Usa zona horaria America/Bogota.'
```

**2. Check System Prompt:**

```typescript
// Ensure system prompt encourages tool usage
const SYSTEM_PROMPT = `...
INSTRUCCIONES:
- SIEMPRE usa las herramientas cuando el usuario lo solicite
- Detecta intenciones aunque no sean explícitas
- Confirma acciones con "✅ Listo!" cuando uses herramientas
...`;
```

**3. Lower Temperature:**

```typescript
// For more deterministic tool calling
const model = getGeminiModel('gemini-2.5-flash-lite');
model.generationConfig.temperature = 0.3; // Lower = more consistent
```

**4. Debug Tool Calls:**

```typescript
const response = await generateContent(prompt, { tools });

logger.info('[gemini-agent] Response analysis', {
  metadata: {
    text: response.text,
    functionCalls: response.functionCalls,
    toolsProvided: tools.length
  }
});

if (!response.functionCalls) {
  logger.warn('[gemini-agent] No tools called despite intent');
}
```

### Issue: Invalid Tool Arguments

**Symptom:**

Tool called but execution fails due to invalid arguments

```
Error: Invalid datetime format: "mañana"
at executeToolCall (lib/gemini-agents.ts:156)
```

**Causes:**

1. Gemini didn't parse date correctly
2. Parameter validation failing
3. Type mismatch

**Solutions:**

**1. Add Validation in Tool Execution:**

```typescript
case 'create_reminder': {
  // Validate title
  const title = args.title as string;
  if (!title || title.trim() === '') {
    return 'El título del recordatorio no puede estar vacío.';
  }

  // Validate datetime
  const datetime = args.datetime as string;
  try {
    const date = new Date(datetime);
    if (isNaN(date.getTime())) {
      return 'La fecha no es válida. ¿Podrías especificarla de otra forma? Ejemplo: "mañana a las 9am"';
    }
  } catch {
    return 'No pude entender la fecha.';
  }

  // Execute
  await createReminder(userId, title, null, datetime);
  return `✅ Listo! Guardé tu recordatorio...`;
}
```

**2. Improve Parameter Descriptions:**

```typescript
datetime: {
  type: SchemaType.STRING,
  description: 'Fecha y hora en formato ISO 8601 (ej: 2025-10-12T09:00:00-05:00). Zona horaria: America/Bogota (UTC-5). Ejemplos: "mañana a las 9am" → "2025-10-12T09:00:00-05:00", "el viernes a las 3pm" → "2025-10-15T15:00:00-05:00"'
}
```

**3. Add Fallback Parsing:**

```typescript
// If Gemini fails to parse, try manual parsing
if (!args.datetime || typeof args.datetime !== 'string') {
  logger.warn('[gemini-agent] Invalid datetime from tool call', { args });

  // Extract relative time from original message
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  args.datetime = tomorrow.toISOString();
  logger.info('[gemini-agent] Applied fallback datetime', { datetime: args.datetime });
}
```

### Issue: Infinite Tool Loop

**Symptom:**

Same tool called repeatedly, hitting max iterations

```
[gemini-agent] Max iterations reached
[gemini-agent] Tool create_reminder called 5 times
```

**Cause:**

Tool execution returns unclear result, model keeps retrying

**Solution:**

**1. Return Clear Confirmations:**

```typescript
// ❌ Bad: Unclear confirmation
return 'Reminder created';

// ✅ Good: Explicit success message
return `✅ Listo! Guardé tu recordatorio "${args.title}" para ${new Date(args.datetime).toLocaleString('es-CO')}`;
```

**2. Add Deduplication:**

```typescript
const executedTools = new Set<string>();

for (const call of functionCalls) {
  const toolKey = `${call.name}:${JSON.stringify(call.args)}`;

  // Skip if already executed
  if (executedTools.has(toolKey)) {
    logger.warn('[gemini-agent] Duplicate tool call detected', { call });
    continue;
  }

  executedTools.add(toolKey);
  const result = await executeToolCall(call.name, call.args, userId);
  // ...
}
```

**3. Increase Max Iterations (if needed):**

```typescript
// lib/gemini-agents.ts:218
private maxIterations = 10; // Was 5, increase if legitimate multi-tool scenarios
```

---

## Cache Not Working

### Issue: Zero Cache Hit Rate

**Symptom:**

Cache metrics show 0% hit rate despite caching implementation

```typescript
const metrics = getCacheMetrics();
console.log(metrics.hitRate); // 0%
```

**Cause:**

In-memory cache doesn't persist across Edge Function invocations (see [GEMINI-CONTEXT-CACHING.md](./GEMINI-CONTEXT-CACHING.md#current-implementation-issues))

**Solution:**

Migrate to persistent storage (Vercel Edge Config or Upstash Redis)

**Quick Fix for Testing:**

```typescript
// Force cache to work in single instance (testing only)
export const runtime = 'nodejs'; // Temporarily use Node.js runtime

// In production, use Edge Config:
import { createClient } from '@vercel/edge-config';
const edgeConfig = createClient(process.env.EDGE_CONFIG);

export async function getCachedContext(key: string) {
  return await edgeConfig.get<Content[]>(key);
}
```

### Issue: Cache TTL Too Short

**Symptom:**

Frequent cache misses due to expiration

**Solution:**

**1. Adjust TTL Per Content Type:**

```typescript
const CACHE_TTL = {
  systemPrompt: 86400000,      // 24 hours (rarely changes)
  conversationHistory: 3600000, // 1 hour (frequent updates)
  userProfile: 21600000         // 6 hours (occasional updates)
};

export function setCachedContext(
  key: string,
  content: Content[],
  ttl?: number
) {
  const expiresAt = Date.now() + (ttl || CACHE_TTL.conversationHistory);
  // Store with custom TTL
}
```

**2. Monitor Cache Effectiveness:**

```typescript
// Log cache metrics
setInterval(() => {
  const metrics = getCacheMetrics();
  logger.info('[cache] Metrics', {
    metadata: {
      hitRate: metrics.hitRate,
      avgLatency: metrics.avgLatency,
      size: cache.size
    }
  });
}, 3600000); // Every hour
```

---

## Fallback Chain Issues

### Issue: Fallback Not Triggering

**Symptom:**

Gemini fails but system doesn't fall back to GPT-4o-mini

**Cause:**

Error not caught or fallback logic broken

**Solution:**

**1. Wrap in Try-Catch:**

```typescript
// lib/ai-processing-v2.ts
try {
  if (provider === 'gemini') {
    const agent = createGeminiProactiveAgent();
    response = await agent.respond(userMessage, userId, chatHistory);
  }
} catch (error) {
  logger.error('[ai-processing] Gemini failed, trying fallback', error);

  // Retry with OpenAI
  const openaiAgent = createOpenAIAgent();
  response = await openaiAgent.respond(userMessage, userId, chatHistory);
}
```

**2. Verify Provider Selection:**

```typescript
const provider = selectProvider();
logger.info('[ai-processing] Provider selected', { metadata: { provider } });

if (provider !== 'gemini') {
  logger.warn('[ai-processing] Not using Gemini', {
    metadata: {
      reason: canUseFreeTier() ? 'API key missing' : 'Free tier exhausted'
    }
  });
}
```

### Issue: All Providers Failing

**Symptom:**

Gemini, OpenAI, and Claude all fail

**Cause:**

Network issue, API outages, or misconfiguration

**Solution:**

**1. Return Graceful Error:**

```typescript
try {
  // Try Gemini
  return await geminiGenerate(prompt);
} catch {
  try {
    // Try OpenAI
    return await openaiGenerate(prompt);
  } catch {
    try {
      // Try Claude
      return await claudeGenerate(prompt);
    } catch {
      // All failed - return friendly error
      return 'Disculpa, estoy teniendo problemas técnicos. ¿Podrías intentar de nuevo en unos minutos?';
    }
  }
}
```

**2. Add Health Check Endpoint:**

```typescript
// app/api/health/route.ts
export const runtime = 'edge';

export async function GET(): Promise<Response> {
  const health = {
    gemini: await checkGeminiHealth(),
    openai: await checkOpenAIHealth(),
    claude: await checkClaudeHealth()
  };

  return new Response(JSON.stringify(health), {
    status: health.gemini || health.openai ? 200 : 503
  });
}

async function checkGeminiHealth(): Promise<boolean> {
  try {
    const response = await generateContent('test');
    return true;
  } catch {
    return false;
  }
}
```

---

## Performance Problems

### Issue: Slow Response Times

**Symptom:**

Responses take >3 seconds (target: <2s)

**Diagnosis:**

```typescript
// Add timing logs
const startTime = Date.now();

// Generate content
const response = await generateContent(prompt);

const latency = Date.now() - startTime;
logger.info('[gemini-client] Latency', {
  metadata: {
    latency,
    promptLength: prompt.length,
    responseLength: response.text.length,
    exceeded: latency > 2000
  }
});
```

**Solutions:**

**1. Reduce Context Size:**

```typescript
// ❌ Bad: Send entire history (100 messages)
const history = conversationHistory; // Too large!

// ✅ Good: Limit to recent messages
const history = conversationHistory.slice(-10); // Last 10 only
```

**2. Use Context Caching:**

```typescript
// Cache system prompt + history
const cachedContext = getCachedContext(key);
// Saves ~500ms on cache hit
```

**3. Parallel Processing:**

```typescript
// ❌ Bad: Sequential
const user = await getUser(id);
const history = await getHistory(user.id);

// ✅ Good: Parallel
const [user, history] = await Promise.all([
  getUser(id),
  getHistory(id)
]);
```

### Issue: High Token Usage

**Symptom:**

Using >1M tokens in conversations (approaching TPM limit)

**Solution:**

**1. Truncate Conversation History:**

```typescript
// Limit context to last N messages
const MAX_HISTORY = 10;
const recentHistory = conversationHistory.slice(-MAX_HISTORY);
```

**2. Summarize Old Messages:**

```typescript
// If history > 20 messages, summarize older ones
if (conversationHistory.length > 20) {
  const oldMessages = conversationHistory.slice(0, -10);
  const summary = await generateSummary(oldMessages);

  // Use summary + recent messages
  const context = [
    { role: 'system', content: `Context summary: ${summary}` },
    ...conversationHistory.slice(-10)
  ];
}
```

---

## Testing Strategies

### Unit Testing

**Test Gemini Client:**

```typescript
// tests/gemini/01-basic-connection.test.ts
import { getGeminiClient, generateContent } from '@/lib/gemini-client';

describe('Gemini Client', () => {
  test('should initialize client', () => {
    const client = getGeminiClient();
    expect(client).toBeDefined();
  });

  test('should generate content', async () => {
    const response = await generateContent('Hola');
    expect(response.text).toBeTruthy();
    expect(response.cost).toBe(0); // Free tier
  });
});
```

### Integration Testing

**Test Webhook Flow:**

```typescript
// tests/integration/webhook-gemini.test.ts
import { POST } from '@/app/api/whatsapp/webhook/route';

describe('WhatsApp Webhook with Gemini', () => {
  test('should process text message', async () => {
    const request = new Request('http://localhost/api/whatsapp/webhook', {
      method: 'POST',
      body: JSON.stringify(mockWebhookPayload)
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
  });
});
```

### Load Testing

**Simulate High Volume:**

```bash
# Install artillery
npm install -g artillery

# Create load test config
cat > load-test.yml <<EOF
config:
  target: 'https://your-app.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests/second
scenarios:
  - name: 'Gemini Chat'
    flow:
      - post:
          url: '/api/whatsapp/webhook'
          json:
            message: 'Hola'
EOF

# Run load test
artillery run load-test.yml
```

**Monitor:**
- Response times (P50, P95, P99)
- Error rate
- Free tier usage
- Fallback triggers

---

## See Also

- [Gemini Integration Guide](./GEMINI-INTEGRATION.md)
- [Gemini API Reference](../03-api-reference/GEMINI-API.md)
- [Cost Optimization](./GEMINI-COST-OPTIMIZATION.md)
- [Edge Runtime Guide](../05-deployment/GEMINI-EDGE-RUNTIME.md)

---

**Last Updated:** 2025-10-11
**Common Issues:** 8 categories, 20+ solutions
**Status:** Production-ready troubleshooting guide
