# Vercel Edge Functions - Guía Completa 2025

## 📖 Overview

Las **Edge Functions** de Vercel son funciones serverless ejecutadas en el Edge Runtime (basado en V8) en lugar del Node.js tradicional. Ofrecen latencia ultra-baja (< 100ms globalmente), costos reducidos y mejor performance para APIs ligeras.

### ¿Por qué Edge Functions?

- **40% más rápidas** que Serverless Functions tradicionales
- **15x más económicas** para procesamiento intensivo
- **Latencia global < 100ms** (ejecutadas cerca del usuario)
- **Timeouts extendidos**: 25s normal, mayor con streaming
- **Ideal para**: APIs de IA, chatbots, webhooks, proxies

---

## 🎯 Prerequisites

- Next.js 15+ o framework compatible (SvelteKit, Astro, Nuxt)
- Vercel CLI 28.9.0+
- Entender limitaciones del Edge Runtime (NO Node.js completo)

---

## 🚀 Configuración Básica

### 1. Declarar Edge Runtime

**IMPORTANTE**: Usar `runtime: 'edge'` (NO `experimental-edge`)

```typescript
// api/hello/route.ts o api/hello.ts
export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ message: 'Hello from Edge!' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
```

### 2. Configuración en `vercel.json`

**CRÍTICO**: NO especificar `functions.*.runtime` en `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [...],
  "headers": [...]
}
```

✅ **Correcto**: Vercel auto-detecta Edge Functions via `export const config`
❌ **Incorrecto**: Especificar runtime en vercel.json causa errores

---

## 📦 Importaciones y Dependencias

### ✅ Static Imports (Requerido)

```typescript
// ✅ CORRECTO - Static import al inicio del archivo
import { getSupabaseServerClient } from '../../lib/supabase';
import { openai } from '../../lib/openai';

export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const supabase = getSupabaseServerClient();
  // ...
}
```

### ❌ Dynamic Imports (EVITAR)

```typescript
// ❌ INCORRECTO - Dynamic import en Edge Functions
export default async function handler(req: Request) {
  const { getSupabaseServerClient } = await import('../../lib/supabase'); // ❌ Falla en build
  // ...
}
```

**Razón**: Vercel bundler (esbuild) analiza imports en build time. Dynamic imports rompen la resolución de dependencias.

---

## 🔌 APIs Compatibles

### Edge Runtime APIs Soportadas

- ✅ `fetch` (global)
- ✅ `Request` / `Response` (Web APIs)
- ✅ `Headers` / `URL` / `URLSearchParams`
- ✅ `crypto.subtle` (Web Crypto API)
- ✅ `TextEncoder` / `TextDecoder`
- ✅ `setTimeout` / `setInterval` (limitado)
- ✅ `console.log` / `console.error`
- ✅ Edge-compatible npm packages

### Node.js APIs NO Soportadas

- ❌ `fs` (file system)
- ❌ `path`
- ❌ `os`
- ❌ `child_process`
- ❌ `http` / `https` (usar `fetch`)
- ❌ Bibliotecas nativas de Node.js

### Alternativas Edge-Compatible

| Node.js API | Edge Alternative |
|-------------|------------------|
| `fs.readFile()` | Fetch desde URL o edge storage |
| `path.join()` | Template strings |
| `Buffer` | `Uint8Array` / `TextEncoder` |
| `crypto` (Node) | `crypto.subtle` (Web Crypto) |
| OpenAI SDK (Node) | Fetch directo a OpenAI API |

---

## ⚡ Performance & Optimization

### Caching Strategies

```typescript
export default async function handler(req: Request) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 's-maxage=3600, stale-while-revalidate=86400'
      // s-maxage: cache por 1h en edge
      // stale-while-revalidate: servir stale 24h mientras refetch en background
    }
  });
}
```

### Streaming Responses (Mejora percepción 3x)

```typescript
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Enviar datos progresivamente
      controller.enqueue(encoder.encode('Chunk 1\n'));
      await delay(100);
      controller.enqueue(encoder.encode('Chunk 2\n'));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
}
```

---

## 🤖 Ejemplo: WhatsApp AI Bot con GPT-4o

```typescript
// api/whatsapp/webhook.ts
export const config = { runtime: 'edge' };

import { chatCompletion } from '../../lib/openai'; // Edge-compatible client

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await req.json();
  const userMessage = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;

  if (!userMessage) {
    return new Response(JSON.stringify({ status: 'ignored' }), { status: 200 });
  }

  // Procesar con GPT-4o (async, no bloquea respuesta)
  processWithAI(userMessage).catch(console.error);

  // Responder inmediatamente a WhatsApp (< 5s requerido)
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

async function processWithAI(message: string) {
  const response = await chatCompletion([
    { role: 'user', content: message }
  ]);

  // Enviar respuesta a WhatsApp
  await sendWhatsAppMessage(response);
}
```

---

## 🔐 Security Best Practices

### 1. Validar Signatures (HMAC)

```typescript
async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  const signature = req.headers.get('x-hub-signature-256');
  const secret = process.env.WHATSAPP_APP_SECRET;

  if (!signature || !secret) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature.includes(expected);
}
```

### 2. Rate Limiting

```typescript
const rateLimits = new Map<string, { count: number, resetAt: number }>();

function checkRateLimit(identifier: string, limit = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimits.get(identifier);

  if (!record || now > record.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) return false;

  record.count++;
  return true;
}
```

---

## 🐛 Common Issues

### Error: "Unsupported modules"

**Causa**: Dynamic imports o bibliotecas Node.js incompatibles
**Solución**: Usar static imports y bibliotecas edge-compatible

### Error: "Cannot find module"

**Causa**: Imports incorrectos o paths relativos mal resueltos
**Solución**: Verificar paths y usar static imports desde top-level

### Timeout Errors

**Causa**: Función excede 25s (o límite de streaming)
**Solución**: Optimizar queries, usar async/fire-and-forget, implementar streaming

---

## 📊 Monitoring & Debugging

### Local Testing

```bash
# Usar Vercel CLI para simular Edge Runtime
vercel dev

# Verificar build
vercel build

# Deploy preview
vercel --prod=false
```

### Logs en Producción

```typescript
export default async function handler(req: Request) {
  const requestId = crypto.randomUUID();

  console.log(JSON.stringify({
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  }));

  // ... handler logic
}
```

Acceder logs: Vercel Dashboard → Functions → Real-time logs

---

## 📚 References

- [Vercel Edge Functions Docs](https://vercel.com/docs/functions/runtimes/edge/edge-functions)
- [Edge Runtime API Reference](https://nextjs.org/docs/pages/api-reference/edge)
- [Streaming Responses](https://vercel.com/docs/functions/edge-functions/streaming)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)

---

## ✅ Quick Checklist

- [ ] Usar `export const config = { runtime: 'edge' }`
- [ ] Solo static imports (NO dynamic imports)
- [ ] NO especificar runtime en `vercel.json`
- [ ] Usar Web APIs (NO Node.js APIs)
- [ ] Implementar error handling robusto
- [ ] Validar payloads y signatures
- [ ] Añadir logging estructurado
- [ ] Testear con `vercel dev` localmente
- [ ] Configurar monitoring en producción

---

**Última actualización**: 2025 - Basado en Next.js 15 y Vercel Edge Functions 3.0
