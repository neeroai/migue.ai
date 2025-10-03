# Vercel Deployment Best Practices 2025

## 📖 Overview

Guía actualizada de mejores prácticas para deployments en Vercel con Next.js 15, Edge Functions, y arquitectura moderna de aplicaciones serverless.

---

## 🎯 Configuración de Proyecto

### 1. Structure de `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": null,
  "crons": [
    {
      "path": "/api/cron/task",
      "schedule": "0 9 * * *"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ],
  "rewrites": [],
  "redirects": []
}
```

#### ⚠️ Configuraciones CRÍTICAS

**NO hacer:**
```json
{
  "functions": {
    "api/**/*.ts": {
      "runtime": "edge" // ❌ NO especificar runtime aquí
    }
  },
  "buildCommand": "next build" // ❌ Next.js auto-detected
}
```

**SÍ hacer:**
```typescript
// En cada archivo de API
export const config = { runtime: 'edge' }; // ✅ Runtime detectado automáticamente
```

### 2. Environment Variables

#### Organización Recomendada

```bash
# .env.example (commitear al repo)
WHATSAPP_TOKEN=your_token_here
WHATSAPP_PHONE_ID=your_phone_id
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_key
```

#### Configuración en Vercel

1. **Dashboard → Settings → Environment Variables**
2. **Separar por ambiente**:
   - `Production`: Variables productivas
   - `Preview`: Variables de testing
   - `Development`: Variables locales

3. **Secrets sensibles**:
```bash
# Usar Vercel CLI para secrets
vercel env add OPENAI_API_KEY

# Verificar variables
vercel env ls
```

### 3. `.vercelignore` Optimization

```bash
# .vercelignore
# Reducir tamaño de deployment y build time

# Tests
tests/
**/*.test.ts
**/*.test.tsx
**/*.spec.ts
*.test.js
coverage/

# Development
.vscode/
.cursor/
.idea/
*.log
.DS_Store

# Documentation (opcional, deploy solo producción)
docs/
*.md
!README.md

# Cache local
.next/
.vercel/
node_modules/.cache/

# Python (si existe en proyecto)
__pycache__/
*.pyc
venv/
.venv/

# Archivos temporales
*.tmp
*.bak
.archive/
```

**Impacto**: Reduce deployment time 30-50%

---

## 🚀 Build Optimization

### 1. Next.js 15 Configuration

```javascript
// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimización de imágenes
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    minimumCacheTTL: 60,
  },

  // Strict mode para detectar problemas
  reactStrictMode: true,

  // Optimización de bundle
  swcMinify: true,

  // Para apps Edge-first
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Headers globales
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 2. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "paths": {
      "@/*": ["./*"],
      "@/lib/*": ["./lib/*"],
      "@/api/*": ["./api/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".vercel", "dist", "out"]
}
```

---

## 🔄 Git Workflow

### 1. Branch Strategy

```bash
main          # Producción (auto-deploy)
└── develop   # Staging (preview deploys)
    └── feature/* # Feature branches (preview deploys)
```

### 2. Deployment Flow

```bash
# Feature development
git checkout -b feature/ai-streaming
git add .
git commit -m "feat: implement AI streaming responses"
git push origin feature/ai-streaming

# Vercel crea preview deployment automáticamente
# URL: https://migue-ai-xyz123.vercel.app

# Merge a develop para staging
git checkout develop
git merge feature/ai-streaming
git push origin develop

# Merge a main para producción
git checkout main
git merge develop
git push origin main
```

### 3. Commit Messages Convention

```bash
# Format: <type>(<scope>): <subject>

feat(api): add streaming support for GPT-4o responses
fix(webhook): resolve signature validation error
perf(db): optimize RLS queries with btree indexes
docs(vercel): add Edge Functions deployment guide
chore(deps): update Next.js to 15.5.4
```

---

## ⚡ Performance Optimization

### 1. Edge Functions vs Serverless

**Cuándo usar Edge Functions:**
- ✅ APIs ligeras (< 1MB response)
- ✅ Latencia crítica (< 100ms requerido)
- ✅ Webhooks (WhatsApp, Stripe, etc.)
- ✅ Proxies y redirects
- ✅ AI streaming responses
- ✅ Auth middleware

**Cuándo usar Serverless:**
- ✅ Procesamiento pesado (> 50MB memoria)
- ✅ Bibliotecas Node.js nativas
- ✅ File system operations
- ✅ Procesamiento de imágenes/video
- ✅ Database migrations

### 2. Caching Strategy

```typescript
// Edge Function con cache inteligente
export const config = { runtime: 'edge' };

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');

  const data = await fetchUserData(userId);

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      // Cache en edge por 5 minutos
      'cache-control': 'public, s-maxage=300, stale-while-revalidate=600',
      // Variar cache por user
      'vary': 'Authorization',
    },
  });
}
```

**Niveles de Cache:**
1. **Browser Cache**: `max-age=3600` (1 hora)
2. **Edge Cache**: `s-maxage=300` (5 min)
3. **Stale While Revalidate**: `stale-while-revalidate=600` (10 min)

### 3. Database Connection Pooling

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

let cachedClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseServerClient() {
  if (!cachedClient) {
    cachedClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!,
      {
        auth: { persistSession: false }, // Edge compatible
        db: { schema: 'public' },
        global: {
          headers: { 'x-application-name': 'migue-ai' },
        },
      }
    );
  }
  return cachedClient;
}
```

---

## 🔐 Security Best Practices

### 1. Secrets Management

```bash
# NUNCA commitear secrets
.env
.env.local
.env.*.local

# Usar Vercel Secrets
vercel env add OPENAI_API_KEY production
vercel env add WHATSAPP_TOKEN production
```

### 2. Headers de Seguridad

```javascript
// next.config.mjs
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ];
}
```

### 3. Rate Limiting (Edge)

```typescript
// middleware.ts (Edge Middleware)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const rateLimits = new Map<string, { count: number; resetAt: number }>();

export const config = {
  matcher: '/api/:path*',
};

export function middleware(request: NextRequest) {
  const ip = request.ip || 'anonymous';
  const limit = 100; // requests
  const window = 60000; // 1 minuto

  const now = Date.now();
  const record = rateLimits.get(ip);

  if (!record || now > record.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + window });
    return NextResponse.next();
  }

  if (record.count >= limit) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  record.count++;
  return NextResponse.next();
}
```

---

## 📊 Monitoring & Observability

### 1. Structured Logging

```typescript
type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  duration?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

function log(entry: LogEntry) {
  console.log(JSON.stringify({
    ...entry,
    timestamp: new Date().toISOString(),
    service: 'migue-ai',
  }));
}

// Uso
export default async function handler(req: Request) {
  const requestId = crypto.randomUUID();
  const start = Date.now();

  try {
    // ... handler logic

    log({
      level: 'info',
      message: 'Request processed successfully',
      requestId,
      duration: Date.now() - start,
    });
  } catch (error) {
    log({
      level: 'error',
      message: 'Request failed',
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start,
    });
  }
}
```

### 2. Error Tracking (Sentry)

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV,
    tracesSampleRate: 0.1,
  });
}

// api/example.ts
export default async function handler(req: Request) {
  try {
    // ... logic
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  }
}
```

---

## 🧪 Testing Before Deploy

### 1. Local Testing

```bash
# Instalar Vercel CLI
npm i -g vercel

# Simular producción localmente
vercel dev

# Build local
vercel build

# Testear Edge Functions
curl http://localhost:3000/api/webhook -X POST -d '{"test": true}'
```

### 2. Preview Deployments

```bash
# Deploy preview (NO producción)
vercel

# Deploy específico de branch
git push origin feature/new-feature
# Vercel auto-crea: https://migue-ai-git-feature-new-feature.vercel.app

# Promover preview a producción
vercel --prod
```

### 3. Checklist Pre-Deploy

- [ ] Tests pasan localmente (`npm test`)
- [ ] TypeCheck sin errores (`npm run typecheck`)
- [ ] Build exitoso (`npm run build`)
- [ ] Environment variables configuradas
- [ ] Secrets no commiteados
- [ ] `.vercelignore` actualizado
- [ ] Logs estructurados implementados
- [ ] Error handling robusto
- [ ] Rate limiting configurado
- [ ] Security headers aplicados

---

## 🚨 Common Pitfalls

### 1. ❌ Dynamic Imports en Edge Functions

```typescript
// ❌ MAL - Falla en build
export default async function handler(req: Request) {
  const { func } = await import('./utils');
  return func(req);
}

// ✅ BIEN - Static import
import { func } from './utils';

export default async function handler(req: Request) {
  return func(req);
}
```

### 2. ❌ Node.js APIs en Edge

```typescript
// ❌ MAL - fs no disponible en Edge
import fs from 'fs';
const data = fs.readFileSync('./file.json');

// ✅ BIEN - Fetch desde URL o usar Vercel Edge Config
const data = await fetch('https://api.example.com/config').then(r => r.json());
```

### 3. ❌ Runtime en vercel.json

```json
// ❌ MAL - Causa errores de deployment
{
  "functions": {
    "api/**/*.ts": { "runtime": "edge" }
  }
}

// ✅ BIEN - Auto-detectado via export config
```

---

## 📚 Resources

- [Vercel Docs](https://vercel.com/docs)
- [Next.js 15 Guide](https://nextjs.org/docs)
- [Edge Runtime](https://edge-runtime.vercel.app)
- [Deployment Guide](https://vercel.com/docs/deployments/overview)

---

## ✅ Production Checklist

### Pre-Launch
- [ ] Environment variables en Vercel Dashboard
- [ ] Custom domain configurado
- [ ] SSL/TLS habilitado (automático)
- [ ] Analytics configurado
- [ ] Error tracking (Sentry) activo
- [ ] Rate limiting implementado
- [ ] Database indexes optimizados
- [ ] Cron jobs configurados

### Post-Launch
- [ ] Monitor logs en tiempo real
- [ ] Verificar métricas de performance
- [ ] Configurar alertas (Slack/email)
- [ ] Documentar runbook de incidentes
- [ ] Backup de environment variables

---

**Última actualización**: 2025 - Next.js 15, Vercel Edge Functions 3.0
