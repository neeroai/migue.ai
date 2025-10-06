# Vercel Functions - Guía Completa para Desarrolladores AWS

> Guía comparativa para desarrolladores con experiencia en AWS Lambda/Serverless que están aprendiendo Vercel Functions y TypeScript.

## Tabla de Contenidos

1. [Comparación AWS Lambda vs Vercel Functions](#comparación-aws-lambda-vs-vercel-functions)
2. [Arquitectura de Vercel Functions](#arquitectura-de-vercel-functions)
3. [File-Based Routing](#file-based-routing)
4. [Configuración: vercel.json](#configuración-verceljson)
5. [Ciclo de Vida](#ciclo-de-vida)
6. [Patrones Comunes en Este Proyecto](#patrones-comunes-en-este-proyecto)
7. [Limitaciones Edge Runtime](#limitaciones-edge-runtime)
8. [Deployment Flow](#deployment-flow)
9. [Pricing Comparison](#pricing-comparison)
10. [Cuándo Usar Cada Runtime](#cuándo-usar-cada-runtime)
11. [Debugging y Logs](#debugging-y-logs)
12. [Cheat Sheet AWS → Vercel](#cheat-sheet-aws--vercel)
13. [Recursos y Próximos Pasos](#recursos-y-próximos-pasos)

---

## Comparación AWS Lambda vs Vercel Functions

| Característica | AWS Lambda | Vercel Functions |
|---|---|---|
| **Arquitectura** | Contenedores efímeros en regiones AWS | MicroVMs V8 (Edge) o Node.js containers |
| **Deployment** | Manual/CloudFormation/SAM/Serverless Framework | Git push automático |
| **Cold Start** | 100-500ms | Edge: <10ms, Node: 50-200ms |
| **Configuración** | `serverless.yml` o CloudFormation YAML | Archivos en `app/api/` + `vercel.json` |
| **Rutas** | API Gateway + mappings manuales | File-based routing (automático) |
| **Runtime** | Python 3.x, Node 20.x, Go, Java, .NET, Ruby | Edge (V8), Node.js, Python, Go, Ruby |
| **Pricing Model** | Requests + GB-seconds | Requests + Active CPU + Memory |
| **Regions** | Selección manual de región | Edge: Global automático, Node: iad1 default |
| **Timeout** | 15 min max (Lambda) | Edge: 25s, Node: 10s-300s según plan |
| **Concurrency** | 1000 default, configurable | 30K-100K+ automático |

### Ventajas de Vercel

- ✅ **Zero configuration**: No necesitas configurar API Gateway
- ✅ **Git-based deploys**: Push = deploy automático
- ✅ **Preview URLs**: Cada PR genera URL única
- ✅ **Edge global**: Latencia ultra-baja sin configuración
- ✅ **Developer Experience**: Logs, analytics, rollbacks integrados

### Ventajas de AWS Lambda

- ✅ **Flexibilidad total**: Cualquier runtime/biblioteca
- ✅ **Timeouts largos**: Hasta 15 minutos
- ✅ **Integración AWS**: EventBridge, SQS, DynamoDB, etc.
- ✅ **Control granular**: VPC, roles IAM, layers
- ✅ **Multi-cloud ready**: Terraform, Pulumi support

---

## Arquitectura de Vercel Functions

Vercel ofrece **2 tipos de functions** con casos de uso diferentes:

### 1. Edge Functions ⚡

**Runtime**: V8 JavaScript engine (igual que Cloudflare Workers)

**Ejemplo básico**:
```typescript
// app/api/health/route.ts
export const runtime = 'edge'; // ← Declara Edge Runtime

export async function GET(req: Request): Promise<Response> {
  return new Response(JSON.stringify({ status: 'healthy' }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
```

**Características**:

| Feature | Valor |
|---|---|
| **Ubicación** | Edge más cercano al usuario (global) |
| **Cold Start** | <10ms (prácticamente instantáneo) |
| **Timeout** | 25s para responder, 300s streaming |
| **Tamaño código** | 1MB (Hobby), 2MB (Pro), 4MB (Enterprise) |
| **Filesystem** | ❌ Read-only (no `/tmp`) |
| **Node.js APIs** | ⚠️ Solo subset limitado |
| **Concurrencia** | Alta (30K+ requests simultáneos) |

**APIs Disponibles**:
- ✅ Web Standard APIs: `fetch`, `Request`, `Response`, `Headers`
- ✅ Crypto Web API
- ✅ Encoding APIs: `TextEncoder`, `TextDecoder`
- ✅ Streams API
- ✅ Subset Node.js: `buffer`, `events`, `util`, `async_hooks`

**Limitaciones**:
- ❌ No `fs`, `path`, `child_process`
- ❌ No `require()` (solo ES modules)
- ❌ No dynamic `import()`
- ❌ No native modules (excepto WebAssembly)
- ❌ No eval, Function constructor

**Equivalente AWS**: Lambda@Edge + CloudFront Functions

**Casos de uso ideales**:
- Webhooks (WhatsApp, Stripe, etc.)
- Authentication middleware
- Redirects y rewrites
- API proxies
- Health checks
- Rate limiting

---

### 2. Serverless Functions 🔧

**Runtime**: Node.js completo (18.x/20.x), Python, Go, Ruby

**Ejemplo básico**:
```typescript
// app/api/process/route.ts
// Sin declarar runtime → usa Node.js por defecto

import fs from 'fs';
import { exec } from 'child_process';

export async function POST(req: Request): Promise<Response> {
  // Acceso completo a Node.js APIs
  const tempFile = '/tmp/data.json';
  fs.writeFileSync(tempFile, await req.text());

  // Ejecutar comandos
  exec('convert image.jpg -resize 50% output.jpg');

  return new Response('OK');
}
```

**Características**:

| Feature | Valor |
|---|---|
| **Ubicación** | Región única (default: `iad1` Washington DC) |
| **Cold Start** | 50-200ms |
| **Timeout** | 10s (Hobby), 60s (Pro), 900s (Enterprise) |
| **Tamaño código** | Sin límite estricto |
| **Filesystem** | ✅ `/tmp` 500 MB writable |
| **Node.js APIs** | ✅ Todas disponibles |
| **Native modules** | ✅ Soportados |

**APIs Disponibles**:
- ✅ Todas las Node.js APIs estándar
- ✅ Filesystem completo en `/tmp`
- ✅ `child_process` para ejecutar comandos
- ✅ Native modules (sharp, canvas, etc.)
- ✅ Dynamic imports

**Equivalente AWS**: AWS Lambda tradicional

**Casos de uso ideales**:
- Procesamiento de imágenes/PDFs
- Generación de reportes
- Cron jobs complejos
- Operaciones con filesystem
- Bibliotecas con dependencias nativas

---

## File-Based Routing

Una de las mayores diferencias con AWS: **NO necesitas configurar rutas manualmente**.

### En AWS Lambda (Serverless Framework)

```yaml
# serverless.yml
functions:
  webhook:
    handler: handlers/webhook.post
    events:
      - http:
          path: /whatsapp/webhook
          method: POST

  health:
    handler: handlers/health.get
    events:
      - http:
          path: /health
          method: GET
```

### En Vercel (Next.js App Router)

```
app/api/
├── health/
│   └── route.ts          → GET /api/health
├── whatsapp/
│   ├── webhook/
│   │   └── route.ts      → GET/POST /api/whatsapp/webhook
│   └── flows/
│       └── route.ts      → POST /api/whatsapp/flows
└── cron/
    └── check-reminders/
        └── route.ts      → GET /api/cron/check-reminders
```

**Reglas**:
1. ✅ Archivo **DEBE** llamarse `route.ts` o `route.js`
2. ✅ Exportar funciones HTTP: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`
3. ✅ Firma estándar Web API: `(req: Request) => Promise<Response>`

### Ejemplo Completo

```typescript
// app/api/whatsapp/webhook/route.ts
export const runtime = 'edge';

/**
 * GET - Verificación de webhook de WhatsApp
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

/**
 * POST - Recepción de mensajes de WhatsApp
 */
export async function POST(req: Request): Promise<Response> {
  const payload = await req.json();

  // Procesar mensaje...

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
```

### Rutas Dinámicas

```typescript
// app/api/users/[id]/route.ts
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const userId = params.id; // Extraído automáticamente de la URL

  return new Response(JSON.stringify({ userId }));
}

// GET /api/users/123 → params.id = "123"
```

---

## Configuración: vercel.json

A diferencia de `serverless.yml`, **NO configuras cada función individualmente**.

### Estructura Básica

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "next build",

  // Cron jobs (como EventBridge en AWS)
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "0 9 * * *"  // Sintaxis cron estándar (UTC)
    }
  ],

  // Headers globales por ruta
  "headers": [
    {
      "source": "/api/whatsapp/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store, no-cache, must-revalidate"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        }
      ]
    }
  ],

  // Redirects
  "redirects": [
    {
      "source": "/old-path",
      "destination": "/new-path",
      "permanent": true
    }
  ],

  // Rewrites (internal redirects)
  "rewrites": [
    {
      "source": "/api/v1/:path*",
      "destination": "/api/:path*"
    }
  ]
}
```

### ⚠️ IMPORTANTE: NO configurar runtime aquí

```json
❌ INCORRECTO:
{
  "functions": {
    "app/api/health/route.ts": {
      "runtime": "edge"  // NO hacer esto
    }
  }
}

✅ CORRECTO:
// app/api/health/route.ts
export const runtime = 'edge'; // Declarar en el archivo
```

### Configuración de Regiones (Serverless Functions)

```json
{
  "regions": ["iad1", "sfo1"]  // Multi-region deployment
}
```

Para Edge Functions, la región es automática (global).

---

## Ciclo de Vida

### AWS Lambda
```
Request → API Gateway → Cold Start (si idle) → Lambda Container → Handler → Response
          ↓
     CloudWatch Logs
```

**Cold Start triggers**:
- Primera invocación
- Sin requests por >10-15 min
- Deploy nuevo
- Escalado (nueva instancia)

### Vercel Edge Functions
```
Request → Edge CDN (más cercano) → Micro Cold Start (<10ms) → V8 Isolate → Handler → Response
          ↓
     Vercel Logs
```

**Cold Start triggers**:
- Primera invocación en ese edge
- Sin requests por >30 min
- Deploy nuevo

### Vercel Serverless Functions
```
Request → Vercel CDN → Región (iad1) → Cold Start (si idle) → Node Container → Handler → Response
          ↓
     Vercel Logs
```

**Optimización "Fluid Compute"**:
- Vercel mantiene containers warm más tiempo que Lambda
- Escalado adaptativo según patrones de tráfico
- Reducción de cold starts del 40-60%

---

## Patrones Comunes en Este Proyecto

### 1. Fire-and-Forget con `waitUntil()`

**Problema**: WhatsApp requiere respuesta en <5 segundos, pero el procesamiento puede tomar 10-30 segundos.

**Solución AWS (SQS + Lambda)**:
```python
# Lambda webhook handler
import boto3
sqs = boto3.client('sqs')

def webhook_handler(event, context):
    # Validar webhook
    message = validate(event)

    # Enviar a SQS (async)
    sqs.send_message(
        QueueUrl=os.environ['QUEUE_URL'],
        MessageBody=json.dumps(message)
    )

    return {'statusCode': 200, 'body': '{"success": true}'}

# Lambda processor (trigger: SQS)
def process_handler(event, context):
    for record in event['Records']:
        message = json.loads(record['body'])
        process_with_ai(message)  # Toma 20s
```

**Solución Vercel (waitUntil)**:
```typescript
// app/api/whatsapp/webhook/route.ts
import { waitUntil } from '@vercel/functions';

export const runtime = 'edge';

export async function POST(req: Request): Promise<Response> {
  // FAST PATH: Validaciones rápidas (<100ms)
  const rawBody = await req.text();
  const isValid = await validateSignature(req, rawBody);

  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const message = JSON.parse(rawBody);

  // ✅ RESPONDER INMEDIATAMENTE (<100ms)
  // Fire-and-forget: Procesar en background
  waitUntil(
    processInBackground(message).catch(handleError)
  );

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * Esta función se ejecuta en background SIN bloquear la respuesta
 * Puede tomar hasta 25s (Edge) o 60s (Node.js)
 */
async function processInBackground(msg: any): Promise<void> {
  try {
    // Persistir en DB (con deduplicación)
    const result = await persistMessage(msg);

    if (result.isDuplicate) {
      return; // Ya procesado
    }

    // Procesar con AI (10-20s)
    await sendToAI(msg.content);

    // Enviar respuesta a WhatsApp
    await sendWhatsAppMessage(msg.from, response);

  } catch (error) {
    logger.error('Background processing failed', error);
    // Enviar mensaje de error al usuario
    await sendWhatsAppMessage(msg.from, 'Disculpa, hubo un error');
  }
}
```

**Diferencias clave**:
- AWS: 2 Lambdas + SQS (mayor complejidad)
- Vercel: 1 función + `waitUntil()` (más simple)
- AWS: Retry automático (SQS DLQ)
- Vercel: Manejo de errores manual

**Código real del proyecto**: `app/api/whatsapp/webhook/route.ts:189-196`

---

### 2. Cron Jobs

**AWS (EventBridge)**:
```yaml
# serverless.yml
functions:
  checkReminders:
    handler: handlers/cron.check
    events:
      - schedule:
          rate: cron(0 9 * * ? *)  # 9 AM UTC diario
          enabled: true
```

```python
# handlers/cron.py
def check(event, context):
    reminders = get_due_reminders()
    for r in reminders:
        send_whatsapp(r.phone, r.message)
    return {'statusCode': 200}
```

**Vercel**:
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "0 9 * * *"  // 9 AM UTC diario
    }
  ]
}
```

```typescript
// app/api/cron/check-reminders/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  // ✅ Verificar autenticación (Vercel agrega header automático)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Obtener recordatorios pendientes
  const reminders = await getDueReminders();

  // Procesar cada uno
  const results = [];
  for (const r of reminders) {
    try {
      await sendWhatsAppText(r.phone, r.message);
      await markReminderAsSent(r.id);
      results.push({ id: r.id, status: 'sent' });
    } catch (err) {
      results.push({ id: r.id, status: 'failed', error: err.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { 'content-type': 'application/json' }
  });
}
```

**Diferencias**:
- AWS: EventBridge + Lambda (separados)
- Vercel: `vercel.json` + endpoint (integrado)
- AWS: CloudWatch Events para monitoreo
- Vercel: Logs en dashboard + alertas integradas

**Código real del proyecto**: `app/api/cron/check-reminders/route.ts`

---

### 3. Environment Variables

**AWS (SSM Parameter Store)**:
```bash
# Configurar
aws ssm put-parameter \
  --name /myapp/prod/WHATSAPP_TOKEN \
  --value "xxx" \
  --type SecureString

# serverless.yml
provider:
  environment:
    WHATSAPP_TOKEN: ${ssm:/myapp/prod/WHATSAPP_TOKEN}
```

```python
# Acceder
import os
token = os.environ['WHATSAPP_TOKEN']
```

**Vercel**:
```bash
# Configurar via CLI
vercel env add WHATSAPP_TOKEN

# O via Dashboard: Settings → Environment Variables

# Desarrollo local (.env.local)
WHATSAPP_TOKEN=xxx
SUPABASE_URL=https://xxx.supabase.co
```

```typescript
// Acceso directo (⚠️ no type-safe)
const token = process.env.WHATSAPP_TOKEN;

// ✅ MEJOR: Helper con validación
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  WHATSAPP_TOKEN: z.string().min(1),
  WHATSAPP_PHONE_ID: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
});

export function getEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.message}`);
  }

  return parsed.data;
}

// Uso en functions
import { getEnv } from '@/lib/env';

export async function POST(req: Request) {
  const env = getEnv(); // Type-safe + validated
  const token = env.WHATSAPP_TOKEN;
  // ...
}
```

**Scopes de variables**:
- **Production**: Solo en deploys de `main` branch
- **Preview**: Solo en PRs y feature branches
- **Development**: Solo en `vercel dev`

---

### 4. Streaming Responses

**Use case**: Generar respuestas largas con AI sin timeout.

```typescript
// app/api/stream/route.ts
export const runtime = 'edge';

export async function POST(req: Request): Promise<Response> {
  const { prompt } = await req.json();

  // Stream de OpenAI/Anthropic
  const stream = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  // Convertir a ReadableStream
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'content-type': 'text/plain',
      'transfer-encoding': 'chunked',
    },
  });
}
```

**Límites**:
- Edge: 300 segundos streaming
- Node.js: Según timeout configurado

---

## Limitaciones Edge Runtime

**Comparación detallada**:

| Feature | Edge Runtime | Node.js Runtime | AWS Lambda |
|---|---|---|---|
| **File System** | ❌ No | ✅ `/tmp` 500MB | ✅ `/tmp` 512MB-10GB |
| **Native Modules** | ❌ Solo WASM | ✅ Sí | ✅ Sí (+ Layers) |
| **Dynamic `import()`** | ❌ No | ✅ Sí | ✅ Sí |
| **`require()`** | ❌ No | ✅ Sí | ✅ Sí |
| **`child_process`** | ❌ No | ✅ Sí | ✅ Sí |
| **`fs`, `path`, `os`** | ❌ No | ✅ Sí | ✅ Sí |
| **Crypto (Web API)** | ✅ Sí | ✅ Sí | ✅ Sí |
| **fetch API** | ✅ Sí | ✅ Sí | ⚠️ Requiere polyfill (Node <18) |
| **Streaming** | ✅ 300s | ✅ Según timeout | ✅ Según timeout |
| **Buffer** | ✅ Sí | ✅ Sí | ✅ Sí |
| **WebSocket** | ⚠️ Limitado | ✅ Sí | ✅ Sí + API Gateway |
| **Timers** | ✅ Sí | ✅ Sí | ✅ Sí |

### Bibliotecas Comunes

| Biblioteca | Edge | Node.js | Notas |
|---|---|---|---|
| `@anthropic-ai/sdk` | ✅ | ✅ | Messages API compatible |
| `@anthropic-ai/claude-agent-sdk` | ❌ | ✅ | Requiere `fs` |
| `openai` | ✅ | ✅ | Compatible desde v4+ |
| `groq-sdk` | ✅ | ✅ | Audio transcription |
| `tesseract.js` | ✅ | ✅ | OCR compatible |
| `sharp` | ❌ | ✅ | Requiere native bindings |
| `canvas` | ❌ | ✅ | Native module |
| `pdf-lib` | ✅ | ✅ | Pure JS |
| `prisma` | ⚠️ | ✅ | Edge solo con Data Proxy |
| `bcrypt` | ❌ | ✅ | Use `bcryptjs` para Edge |
| `jsonwebtoken` | ✅ | ✅ | Compatible |
| `zod` | ✅ | ✅ | Schema validation |

### Verificar Compatibilidad

```typescript
// Detectar runtime
if (typeof EdgeRuntime !== 'string') {
  // Estamos en Node.js
  const fs = require('fs');
} else {
  // Estamos en Edge
  console.log('Running on Edge');
}

// O usar conditional exports en package.json
{
  "exports": {
    "edge-light": "./dist/edge.js",
    "node": "./dist/node.js",
    "default": "./dist/edge.js"
  }
}
```

---

## Deployment Flow

### AWS Lambda (Serverless Framework)

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar TypeScript (si aplica)
npm run build

# 3. Empaquetar (crear .zip)
serverless package

# 4. Deploy
serverless deploy --stage prod --region us-east-1

# Output:
# ✓ Service deployed
# endpoints:
#   POST - https://xxx.execute-api.us-east-1.amazonaws.com/prod/webhook
# functions:
#   webhook: myapp-prod-webhook
```

**Tiempo**: 1-3 minutos

---

### Vercel

```bash
# 1. Configurar proyecto (primera vez)
vercel

# 2. Link a Git (si no está)
vercel git connect

# 3. Deploy (automático en cada push)
git add .
git commit -m "feat: add new endpoint"
git push origin main

# ✅ Deploy automático inicia
# Output en GitHub PR:
#   🔨 Building...
#   ✓ Preview: https://myapp-abc123.vercel.app
#   ✓ Production: https://myapp.vercel.app (si es main)
```

**Tiempo**: 30-60 segundos

---

### Comparación de Workflows

| Aspecto | AWS Lambda | Vercel |
|---|---|---|
| **Setup inicial** | AWS CLI, IAM, Serverless Framework | `vercel` CLI o Git connect |
| **Deploy** | `sls deploy` manual | Git push automático |
| **Rollback** | `sls deploy --stage prod` anterior | UI: Rollback en 1 click |
| **Environments** | Stages (dev/prod) manual | Branch-based automático |
| **Preview** | Manual (deploy a stage diferente) | Automático por PR |
| **Secrets** | SSM/Secrets Manager | Vercel Dashboard |
| **CI/CD** | GitHub Actions + AWS credentials | Integrado (cero config) |

---

### Preview URLs (Feature Único de Vercel)

Cada PR genera una URL única:

```
PR #42: feat/new-feature
↓
Deploy automático
↓
https://myapp-git-feat-new-feature-user.vercel.app
```

**Ventajas**:
- ✅ Testing sin afectar producción
- ✅ Compartir con stakeholders
- ✅ Testing de integración antes de merge
- ✅ URL estable durante vida del PR

---

## Pricing Comparison

### AWS Lambda (us-east-1)

**Compute**:
- Primeros 400,000 GB-seconds/mes: GRATIS
- Después: $0.0000166667 por GB-second

**Requests**:
- Primer 1M requests/mes: GRATIS
- Después: $0.20 por 1M requests

**API Gateway**:
- $1.00 per 1M requests

**Ejemplo (500K requests, 1GB RAM, 3s avg)**:
- Requests: GRATIS (< 1M)
- Compute: 500K * 1GB * 3s = 1.5M GB-s = GRATIS (< 400K GB-s)
- API Gateway: $0.50
- **Total: ~$0.50/mes**

---

### Vercel

**Hobby Plan** (GRATIS):
- 100 GB-hours/mes
- 100K invocations/mes
- 1K build minutes
- Edge & Serverless incluidos

**Pro Plan** ($20/mes):
- 1000 GB-hours incluidos
- 100K invocations incluidos
- Después:
  - $0.60 por 1M invocations
  - $40 por 100 GB-hours adicionales

**Ejemplo (500K requests, 3s avg)**:
- Invocations: 500K - 100K = 400K exceso
- Costo invocations: 400K * $0.60/1M = $0.24
- GB-hours: 500K * 3s * 1GB / 3600 = ~417 GB-hours
- GB-hours exceso: 417 - 1000 = GRATIS (dentro de plan)
- **Total: $20 (plan) + $0.24 = $20.24/mes**

---

### Comparación Real (Este Proyecto)

**Carga**:
- 2,000 mensajes/día = 60K/mes
- Promedio 2s por request
- 1 GB RAM

| Provider | Costo Mensual | Notas |
|---|---|---|
| **AWS Lambda** | ~$5 | Solo Lambda + API Gateway |
| **Vercel Hobby** | $0 | Dentro de límites gratis |
| **Vercel Pro** | $20 | Extras: Analytics, Teams, Support |

**Conclusión**:
- Para proyectos pequeños (<100K req/mes): Vercel Hobby GRATIS
- Para startups (100K-1M req/mes): Similar o más barato
- Para empresas (>10M req/mes): AWS Lambda más económico

---

## Cuándo Usar Cada Runtime

### Usa Edge Functions ⚡ cuando:

✅ **Latencia es crítica**
- API endpoints públicos
- Webhooks (WhatsApp, Stripe, GitHub)
- Authentication middleware

✅ **Requests pequeños y rápidos**
- Health checks
- Redirects/Rewrites
- Rate limiting
- Feature flags

✅ **Cobertura global**
- API internacional
- CDN personalizado
- Geo-routing

✅ **Solo necesitas Web APIs**
- HTTP requests
- JSON parsing
- Crypto operations

**Ejemplos en este proyecto**:
- `app/api/whatsapp/webhook/route.ts` - Webhook WhatsApp
- `app/api/health/route.ts` - Health check
- `app/api/cron/check-reminders/route.ts` - Cron jobs

---

### Usa Serverless Functions 🔧 cuando:

✅ **Necesitas Node.js APIs completas**
- Filesystem operations
- Child processes
- Native modules

✅ **Procesamiento pesado**
- Image processing (sharp, canvas)
- PDF generation
- Video transcoding
- Data transformations

✅ **Dependencias nativas**
- Bibliotecas con C/C++ bindings
- Puppeteer/Playwright
- Prisma (sin Data Proxy)

✅ **Timeouts largos (>25s)**
- Batch processing
- Report generation
- ML inference

**Cuándo migrar de Edge → Serverless**:

```typescript
// ❌ NO funciona en Edge
export const runtime = 'edge';
import sharp from 'sharp'; // Error: native module

// ✅ Cambia a Node.js
// Remover la línea runtime = 'edge'
import sharp from 'sharp'; // ✓ Funciona
```

---

### Matriz de Decisión

| Use Case | Edge | Serverless | Razón |
|---|---|---|---|
| Webhook WhatsApp | ✅ | ⚠️ | Latencia baja, requests simples |
| Transcripción audio | ❌ | ✅ | Requiere bibliotecas nativas |
| Health check | ✅ | ✅ | Ambos funcionan, Edge más rápido |
| Procesamiento imágenes | ❌ | ✅ | sharp requiere Node.js |
| Generación PDF | ❌ | ✅ | canvas/puppeteer requiere Node.js |
| Rate limiting | ✅ | ⚠️ | Edge más rápido globalmente |
| Database queries | ✅ | ✅ | Ambos OK, Edge si <25s |
| Cron jobs | ✅ | ✅ | Edge para tareas simples |
| File uploads | ⚠️ | ✅ | Edge limitado a 4.5MB body |
| Streaming AI | ✅ | ✅ | Edge ideal para streaming |

---

## Debugging y Logs

### AWS Lambda (CloudWatch)

```python
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    logger.info('Processing request', extra={
        'user_id': event.get('userId'),
        'request_id': context.request_id
    })

    try:
        result = process()
        return {'statusCode': 200, 'body': result}
    except Exception as e:
        logger.error('Error processing', exc_info=True)
        return {'statusCode': 500, 'body': str(e)}
```

**Ver logs**:
```bash
aws logs tail /aws/lambda/myapp-prod-webhook --follow
```

---

### Vercel

```typescript
// Logs automáticos en Vercel Dashboard
export async function POST(req: Request): Promise<Response> {
  console.log('Processing request', {
    url: req.url,
    method: req.method
  });

  try {
    const result = await process();
    return new Response(JSON.stringify(result));
  } catch (error) {
    console.error('Error processing:', error);
    return new Response('Error', { status: 500 });
  }
}
```

**Ver logs**:
```bash
# CLI
vercel logs [deployment-url] --follow

# O en Dashboard: Deployments → [tu deploy] → Function Logs
```

---

### Logger Customizado (Recomendado)

```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

class Logger {
  private log(level: LogLevel, message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...context,
    };

    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'production') return;
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, error: Error, context?: LogContext) {
    this.log('error', message, {
      ...context,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    });
  }
}

export const logger = new Logger();

// Uso
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  logger.info('Webhook received', { requestId });

  try {
    await process();
  } catch (error) {
    logger.error('Processing failed', error, { requestId });
  }
}
```

**Ver logs estructurados**:
```bash
# Filtrar por error
vercel logs --filter='level="error"'

# Filtrar por requestId
vercel logs --filter='requestId="abc-123"'
```

---

### Monitoreo y Alertas

**Vercel Pro incluye**:
- Real-time logs streaming
- Error tracking
- Performance metrics
- Alerts (Slack, email, webhook)

```json
// vercel.json
{
  "monitoring": {
    "alerts": [
      {
        "type": "function-error-rate",
        "threshold": 0.05,  // 5% error rate
        "period": "5m",
        "integrations": ["slack"]
      }
    ]
  }
}
```

---

## Cheat Sheet AWS → Vercel

### Conceptos Equivalentes

| AWS | Vercel | Notas |
|---|---|---|
| `handler.py` | `route.ts` | Archivo de función |
| `def handler(event, context)` | `export async function POST(req: Request)` | Firma |
| `serverless.yml` | `vercel.json` | Config (limitado) |
| `sls deploy` | `git push` | Deployment |
| Lambda@Edge | Edge Functions | Edge compute |
| Lambda (Node.js) | Serverless Functions | Compute tradicional |
| API Gateway | File-based routing | Rutas automáticas |
| EventBridge | Cron (`vercel.json`) | Scheduled tasks |
| SQS | `waitUntil()` | Background processing |
| CloudWatch | Vercel Logs | Logging |
| IAM Roles | Environment Variables | Secrets |
| VPC | - | No equivalente |
| Layers | `node_modules` | Shared code |
| DLQ | Manual retry logic | Error handling |
| Provisioned Concurrency | Always warm (Fluid) | Reduce cold starts |

---

### Comandos Comunes

| Tarea | AWS (Serverless) | Vercel |
|---|---|---|
| **Deploy producción** | `sls deploy --stage prod` | `git push origin main` |
| **Deploy preview** | `sls deploy --stage dev` | `git push origin feature-x` |
| **Ver logs** | `sls logs -f webhook` | `vercel logs` |
| **Rollback** | `sls deploy --stage prod` (versión anterior) | UI: Rollback button |
| **Env vars** | `sls deploy` (actualiza stack) | `vercel env add VAR` |
| **Invoke local** | `sls invoke local -f webhook` | `vercel dev` |
| **Ver endpoints** | `sls info` | `vercel inspect` |

---

### Migración Checklist

- [ ] **Convertir handlers a route.ts**
  - `handler.py` → `app/api/[name]/route.ts`
  - `def handler` → `export async function POST`

- [ ] **Actualizar responses**
  - `{'statusCode': 200}` → `new Response('OK', { status: 200 })`

- [ ] **Reemplazar AWS SDKs**
  - `boto3` (S3) → `@vercel/blob`
  - `boto3` (DynamoDB) → Supabase/Postgres
  - `boto3` (SES) → Resend/SendGrid

- [ ] **Adaptar background processing**
  - SQS → `waitUntil()`

- [ ] **Migrar cron jobs**
  - EventBridge → `vercel.json` crons

- [ ] **Environment variables**
  - SSM → Vercel Dashboard

- [ ] **Logging**
  - CloudWatch → Vercel Logs + logger

- [ ] **Testing**
  - `pytest` → Jest + Vitest

- [ ] **CI/CD**
  - GitHub Actions + AWS credentials → Git push (automático)

---

## Recursos y Próximos Pasos

### Documentación Oficial

- [Vercel Functions](https://vercel.com/docs/functions)
- [Edge Runtime API](https://vercel.com/docs/functions/edge-functions/edge-runtime)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Vercel CLI](https://vercel.com/docs/cli)

### Guías de Migración

- [AWS Lambda → Vercel](https://vercel.com/guides/migrate-to-vercel-from-aws-lambda)
- [Python → TypeScript](https://github.com/microsoft/TypeScript-Website/blob/v2/packages/documentation/copy/en/tutorials/TypeScript%20for%20Python%20Devs.md)
- [Serverless Framework → Vercel](https://vercel.com/guides/migrate-from-serverless-framework)

### Learning Path para Devs AWS

1. **Fundamentos TypeScript** (si vienes de Python)
   - [TypeScript for Python Developers](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html)
   - Tipos, interfaces, generics

2. **Next.js App Router** (equivalente a API Gateway)
   - File-based routing
   - Middleware
   - API routes

3. **Edge Runtime** (equivalente a Lambda@Edge)
   - Web Standard APIs
   - Limitaciones y workarounds

4. **Vercel Platform**
   - Deployments y previews
   - Environment variables
   - Monitoring y logs

### Proyectos de Práctica

1. **Webhook Processor** (este proyecto)
   - WhatsApp webhook
   - Fire-and-forget con `waitUntil()`
   - Edge Functions

2. **Cron Job**
   - Daily reminders
   - Database queries
   - Email notifications

3. **API Proxy**
   - Rate limiting
   - Caching
   - Authentication

4. **Image Processing** (Serverless Functions)
   - sharp para resize
   - Upload a Vercel Blob
   - Streaming responses

### Herramientas Útiles

- **Vercel CLI**: `npm i -g vercel`
- **VSCode Extension**: Vercel (oficial)
- **Testing**: Vitest para Edge Runtime
- **Type checking**: TypeScript strict mode

### Comunidad

- [Vercel Discord](https://vercel.com/discord)
- [GitHub Discussions](https://github.com/vercel/vercel/discussions)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/vercel)

---

## Glosario

| Término | Definición |
|---|---|
| **Edge Function** | Función que se ejecuta en el edge más cercano al usuario (V8 runtime) |
| **Serverless Function** | Función tradicional con Node.js completo en región única |
| **File-based routing** | Sistema donde la estructura de archivos determina las rutas API |
| **Cold start** | Tiempo de inicialización cuando una función no ha sido usada recientemente |
| **Fluid compute** | Sistema de Vercel para mantener functions warm y reducir cold starts |
| **Preview deployment** | Deploy automático de cada PR en URL única |
| **Edge Runtime** | Runtime ligero basado en V8 con Web Standard APIs |
| **waitUntil()** | API para ejecutar código en background sin bloquear respuesta |
| **Route handler** | Función exportada (GET, POST, etc.) en `route.ts` |
| **Runtime** | Entorno de ejecución (edge o nodejs) |

---

**Última actualización**: 2025-10-06
**Autor**: claude-master
**Proyecto**: migue.ai - WhatsApp AI Assistant

