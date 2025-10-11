# Edge Runtime API Reference

**Complete API reference for Vercel Edge Functions and Web APIs**

---

## Table of Contents

- [Overview](#overview)
- [Supported Web APIs](#supported-web-apis)
- [Unsupported Node.js APIs](#unsupported-nodejs-apis)
- [Edge-Compatible Libraries](#edge-compatible-libraries)
- [Third-Party Library Compatibility](#third-party-library-compatibility)
- [Environment Variables](#environment-variables)
- [Migration Guide](#migration-guide)

---

## Overview

Vercel Edge Functions run on the **Edge Runtime**, a lightweight JavaScript runtime based on V8 isolates. It supports:

✅ **Web Standard APIs** (fetch, Request, Response, Headers, URL, etc.)
✅ **Web Crypto API** (crypto.subtle for HMAC, encryption)
✅ **Text encoding** (TextEncoder, TextDecoder)
✅ **Streams** (ReadableStream, WritableStream, TransformStream)
✅ **Timers** (setTimeout, setInterval, setImmediate)

❌ **Node.js-specific APIs** (fs, path, process, Buffer, etc.)
❌ **Dynamic imports** (`await import()` - use static imports)
❌ **Native modules** (C++ addons)

---

## Supported Web APIs

### Fetch API

**Standard HTTP client (replaces `http`/`https` from Node.js):**

```typescript
// Basic GET request
const res = await fetch('https://api.example.com/data');
const data = await res.json();

// POST with JSON body
const res = await fetch('https://api.example.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({ key: 'value' }),
});

// With timeout (using AbortController)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
  return await res.json();
} catch (error: any) {
  if (error.name === 'AbortError') {
    throw new Error('Request timeout');
  }
  throw error;
}
```

From [lib/whatsapp.ts:95-104](../../lib/whatsapp.ts)

### Request/Response API

**Web standard request/response objects:**

```typescript
// Create a Response
export async function GET(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ message: 'Hello' }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, s-maxage=3600',
    },
  });
}

// Read request body
export async function POST(req: Request): Promise<Response> {
  // Text body
  const rawBody = await req.text();

  // JSON body
  const jsonBody = await req.json();

  // FormData
  const formData = await req.formData();

  // ArrayBuffer (for binary data)
  const buffer = await req.arrayBuffer();

  return new Response('OK');
}

// Access request properties
const url = new URL(req.url);
const method = req.method;
const headers = req.headers;
```

**Helper for JSON responses:**

```typescript
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
```

From [app/api/whatsapp/webhook/route.ts:19-24](../../app/api/whatsapp/webhook/route.ts)

### Web Crypto API

**Edge-compatible cryptography (replaces Node.js `crypto`):**

```typescript
/**
 * Generate HMAC-SHA256 signature using Web Crypto API
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  // Import secret as HMAC key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Generate signature
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );

  // Convert ArrayBuffer to hex string
  return hex(sig);
}

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

From [lib/webhook-validation.ts:9-33](../../lib/webhook-validation.ts)

**Supported algorithms:**
- HMAC (SHA-1, SHA-256, SHA-384, SHA-512)
- ECDSA
- RSA-PSS
- AES-GCM, AES-CTR, AES-CBC

### TextEncoder/TextDecoder

**Convert between strings and bytes:**

```typescript
// Encode string to Uint8Array
const encoder = new TextEncoder();
const bytes = encoder.encode('Hello, world!');

// Decode Uint8Array to string
const decoder = new TextDecoder();
const str = decoder.decode(bytes);

// With encoding (default: utf-8)
const decoder = new TextDecoder('utf-8');
```

### URL API

**Parse and manipulate URLs:**

```typescript
const url = new URL(req.url);

// Access URL components
const pathname = url.pathname; // '/api/whatsapp/webhook'
const search = url.search; // '?hub.mode=subscribe'
const searchParams = url.searchParams;

// Read query parameters
const mode = searchParams.get('hub.mode');
const token = searchParams.get('hub.verify_token');
const challenge = searchParams.get('hub.challenge');

// Modify URL
url.searchParams.set('key', 'value');
url.searchParams.delete('key');

// Validate URL
try {
  new URL(userProvidedUrl);
} catch {
  throw new Error('Invalid URL');
}
```

From [lib/webhook-validation.ts:107-110](../../lib/webhook-validation.ts)

### Headers API

**Read and set HTTP headers:**

```typescript
// Read headers (case-insensitive)
const signature = req.headers.get('x-hub-signature-256');
const contentType = req.headers.get('Content-Type');

// Set response headers
const headers = new Headers();
headers.set('content-type', 'application/json');
headers.set('cache-control', 'public, s-maxage=3600');
headers.append('set-cookie', 'key=value');

// Create Response with headers
return new Response(body, { headers });
```

### Streams API

**Process data streams:**

```typescript
// ReadableStream (e.g., OpenAI streaming)
export async function streamChatCompletion(
  messages: ChatMessage[]
): Promise<string> {
  const stream = await client.chat.completions.create({
    model: 'gpt-4o',
    messages,
    stream: true,
  });

  let fullText = '';
  for await (const chunk of stream) {
    const choice = chunk.choices?.[0];
    if (choice?.delta?.content) {
      fullText += choice.delta.content;
    }
  }

  return fullText;
}
```

From [lib/openai.ts:55-90](../../lib/openai.ts)

**Transform streams:**

```typescript
// Transform stream data
const transformStream = new TransformStream({
  transform(chunk, controller) {
    // Modify chunk
    const transformed = chunk.toUpperCase();
    controller.enqueue(transformed);
  },
});

const readable = await res.body;
const transformed = readable.pipeThrough(transformStream);
```

### Timers API

**Schedule code execution:**

```typescript
// setTimeout
const timeoutId = setTimeout(() => {
  console.log('Delayed execution');
}, 1000);
clearTimeout(timeoutId);

// setInterval
const intervalId = setInterval(() => {
  console.log('Repeated execution');
}, 5000);
clearInterval(intervalId);

// setImmediate (Edge Runtime specific)
setImmediate(() => {
  console.log('Next tick');
});
```

**Processing notification with timeout:**

```typescript
function createProcessingNotifier(conversationId: string, userPhone: string) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    start() {
      if (timer) return;
      timer = setTimeout(() => {
        (async () => {
          await sendTextAndPersist(conversationId, userPhone, 'Sigo procesando...');
        })();
      }, 30000); // 30 seconds
    },
    stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
```

From [lib/ai-processing.ts:91-119](../../lib/ai-processing.ts)

---

## Unsupported Node.js APIs

### File System (`fs`)

❌ **Not available in Edge Runtime**

```typescript
// ❌ Will fail in Edge Runtime
import fs from 'fs';
const data = fs.readFileSync('file.txt');

// ✅ Use fetch for external resources
const res = await fetch('https://example.com/file.txt');
const data = await res.text();

// ✅ Or read from database
const { data } = await supabase.storage
  .from('bucket')
  .download('file.txt');
```

### Path (`path`)

❌ **Not available in Edge Runtime**

```typescript
// ❌ Will fail
import path from 'path';
const filePath = path.join(__dirname, 'file.txt');

// ✅ Use URL or string manipulation
const fileName = 'file.txt';
const url = `https://example.com/${fileName}`;
```

### Process (`process`)

⚠️ **Partially available** (environment variables only)

```typescript
// ✅ Environment variables work
const apiKey = process.env.OPENAI_API_KEY;

// ❌ Other process APIs don't work
// process.cwd()
// process.uptime()
// process.memoryUsage()
```

### Buffer

❌ **Not available in Edge Runtime**

```typescript
// ❌ Will fail
const buffer = Buffer.from('hello');

// ✅ Use Uint8Array or ArrayBuffer
const encoder = new TextEncoder();
const bytes = encoder.encode('hello');

// ✅ Or use File API
const file = new File([bytes], 'file.txt', { type: 'text/plain' });
```

### Streams (Node.js)

❌ **Not available (use Web Streams instead)**

```typescript
// ❌ Node.js streams don't work
import { Readable } from 'stream';

// ✅ Use Web Streams
const readable = new ReadableStream({
  start(controller) {
    controller.enqueue('data');
    controller.close();
  },
});
```

---

## Edge-Compatible Libraries

### OpenAI SDK

**✅ Fully compatible (v4.0+):**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000,
  maxRetries: 2,
});

// Standard completion
const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
});

// Streaming (Edge-compatible)
const stream = await client.chat.completions.create({
  model: 'gpt-4o',
  messages,
  stream: true,
});

for await (const chunk of stream) {
  // Process chunks
}
```

From [lib/openai.ts:1-90](../../lib/openai.ts)

### Supabase Client

**✅ Fully compatible:**

```typescript
import { createClient } from '@supabase/supabase-js';

export function getSupabaseServerClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!,
    {
      auth: {
        persistSession: false, // Required for Edge Runtime
      },
    }
  );
}

// Usage
const supabase = getSupabaseServerClient();
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('user_id', userId);
```

### Zod (Validation)

**✅ Fully compatible:**

```typescript
import { z } from 'zod';

const MessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  text: z.object({
    body: z.string(),
  }),
});

export function safeValidateWebhookPayload(data: unknown) {
  return WhatsAppWebhookPayloadSchema.safeParse(data);
}
```

---

## Third-Party Library Compatibility

### Compatible Libraries

| Library | Status | Notes |
|---------|--------|-------|
| **OpenAI** | ✅ | v4.0+ (uses fetch) |
| **Supabase** | ✅ | Edge-compatible client |
| **Zod** | ✅ | Pure TypeScript |
| **date-fns** | ✅ | No Node.js dependencies |
| **jose** | ✅ | JWT for Edge Runtime |
| **@vercel/analytics** | ✅ | Native Edge support |

### Incompatible Libraries

| Library | Status | Alternative |
|---------|--------|-------------|
| **axios** | ❌ | Use native `fetch` |
| **node-fetch** | ❌ | Use native `fetch` |
| **fs-extra** | ❌ | Use Supabase Storage |
| **jsonwebtoken** | ❌ | Use `jose` library |
| **bcrypt** | ❌ | Use Web Crypto API |
| **sharp** | ❌ | Use external API |

### Checking Compatibility

**Test library in Edge Runtime:**

```typescript
// Create test route
// app/api/test-library/route.ts
export const runtime = 'edge';

import { someLibrary } from 'some-library';

export async function GET() {
  try {
    const result = await someLibrary.doSomething();
    return new Response(JSON.stringify({ success: true, result }));
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
```

---

## Environment Variables

### Accessing Environment Variables

```typescript
// ✅ Works in Edge Runtime
const apiKey = process.env.OPENAI_API_KEY;
const dbUrl = process.env.SUPABASE_URL;

// ✅ With fallback
const logLevel = process.env.LOG_LEVEL || 'info';

// ✅ Type-safe access
export function getEnv() {
  return {
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
    SUPABASE_URL: process.env.SUPABASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}
```

### Setting Environment Variables

**Local development (.env.local):**

```bash
WHATSAPP_TOKEN=your_token
WHATSAPP_PHONE_ID=your_phone_id
SUPABASE_URL=your_url
OPENAI_API_KEY=your_key
```

**Production (Vercel CLI):**

```bash
vercel env add WHATSAPP_TOKEN production
vercel env add OPENAI_API_KEY production
```

**Production (Vercel Dashboard):**

Navigate to: `Settings → Environment Variables → Add`

---

## Migration Guide

### From Node.js to Edge Runtime

**1. Replace Node.js APIs:**

```typescript
// ❌ Before (Node.js)
import crypto from 'crypto';
const hash = crypto.createHmac('sha256', secret).update(message).digest('hex');

// ✅ After (Edge Runtime)
const key = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' },
  false,
  ['sign']
);
const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
const hash = hex(sig);
```

**2. Replace Buffer with Uint8Array:**

```typescript
// ❌ Before
const buffer = Buffer.from('hello');
const base64 = buffer.toString('base64');

// ✅ After
const encoder = new TextEncoder();
const bytes = encoder.encode('hello');
const base64 = btoa(String.fromCharCode(...bytes));
```

**3. Use Static Imports:**

```typescript
// ❌ Before (dynamic import)
const module = await import('./module');

// ✅ After (static import)
import { functionName } from './module';
```

**4. Replace axios with fetch:**

```typescript
// ❌ Before
import axios from 'axios';
const res = await axios.get(url);
const data = res.data;

// ✅ After
const res = await fetch(url);
const data = await res.json();
```

### Testing Edge Compatibility

**1. Add Edge Runtime to route:**

```typescript
export const runtime = 'edge';
```

**2. Test locally:**

```bash
npm run dev
```

**3. Check for errors:**

```
Error: The module 'fs' is not supported in Edge Runtime
```

**4. Fix incompatibilities:**

Replace Node.js APIs with Edge-compatible alternatives.

---

## Related Documentation

- [edge-functions-optimization.md](../05-deployment/edge-functions-optimization.md) - Performance optimization
- [edge-security-guide.md](../05-deployment/edge-security-guide.md) - Security best practices
- [whatsapp-webhook-spec.md](./whatsapp-webhook-spec.md) - WhatsApp webhook specification

---

**Last Updated:** 2025-10-03
**Edge Runtime Version:** V8 isolates (Cloudflare Workers compatible)
**Supported Standards:** Fetch API, Web Crypto API, Web Streams API
**Node.js APIs:** Not supported (use Web APIs instead)
