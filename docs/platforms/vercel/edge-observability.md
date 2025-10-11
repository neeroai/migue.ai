# Edge Functions Observability Guide

**Comprehensive monitoring, debugging, and observability for Vercel Edge Functions**

---

## Table of Contents

- [Overview](#overview)
- [Vercel Observability](#vercel-observability)
- [Structured Logging](#structured-logging)
- [Performance Monitoring](#performance-monitoring)
- [Error Tracking](#error-tracking)
- [Debugging Techniques](#debugging-techniques)
- [Third-Party Integrations](#third-party-integrations)
- [Production Playbook](#production-playbook)

---

## Overview

Vercel Observability (October 2024 release) provides comprehensive monitoring for Edge Functions:

- **CPU throttling** metrics
- **Memory usage** tracking
- **Time to First Byte (TTFB)** measurement
- **Cold start** monitoring
- **Request tracing** with correlation IDs
- **Log drains** for third-party tools

---

## Vercel Observability

### Enabling Observability

**1. Enable in Project Settings:**

Navigate to: `Vercel Dashboard → Project → Settings → Observability`

**2. Configure in `vercel.json`:**

```json
{
  "analytics": {
    "enabled": true
  },
  "observability": {
    "enabled": true,
    "logsEnabled": true,
    "tracingEnabled": true
  }
}
```

### Available Metrics

#### Function Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **Invocations** | Total function calls | Track trends |
| **Duration** | Execution time (P50, P95, P99) | <100ms (P95) |
| **Error Rate** | Failed requests / Total | <0.1% |
| **Cold Starts** | First invocation after idle | <5% of requests |
| **Memory Usage** | Peak memory consumption | <100 MB (128 MB limit) |
| **CPU Throttle** | CPU constraint events | <1% of requests |

#### Request Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **TTFB** | Time to first byte | <100ms (global) |
| **Response Time** | Total request duration | <500ms |
| **Status Codes** | 2xx/4xx/5xx distribution | >99% 2xx |
| **Request Size** | Incoming payload size | <1 MB |
| **Response Size** | Outgoing payload size | <5 MB |

### Dashboard Views

**1. Overview Dashboard**
- Function invocations (last 24h)
- Error rate trends
- P95 latency chart
- Top errors by frequency

**2. Performance Dashboard**
- TTFB histogram
- Cold start percentage
- Memory usage over time
- CPU throttle events

**3. Logs Dashboard**
- Real-time log streaming
- Filterable by level (info/warn/error)
- Search by requestId/userId
- Export to CSV/JSON

---

## Structured Logging

### Logger Implementation

**Structured JSON logging for better searchability:**

```typescript
/**
 * Structured logging system
 * Provides consistent JSON-formatted logs with context and correlation IDs
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  conversationId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  conversationId?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

function log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
  const env = getEnv();

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'migue-ai',
    environment: env.NODE_ENV,
    ...(context?.requestId && { requestId: context.requestId }),
    ...(context?.userId && { userId: context.userId }),
    ...(context?.conversationId && { conversationId: context.conversationId }),
    ...(context?.duration !== undefined && { duration: context.duration }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error instanceof AppError ? error.code : undefined,
      },
    }),
    ...(context?.metadata && { metadata: context.metadata }),
  };

  // Output as JSON for structured logging (Vercel Logs)
  console.log(JSON.stringify(entry));
}
```

From [lib/logger.ts:1-98](../../lib/logger.ts)

### Logger Usage

```typescript
import { logger } from '@/lib/logger';

// Info log with context
logger.info('[webhook] Location saved', {
  requestId,
  conversationId,
  userId,
});

// Error log with error object and context
logger.error('Background AI processing failed', err, {
  requestId,
  conversationId,
  userId,
});

// Warning log with metadata
logger.warn('[webhook] Validation failed', {
  requestId,
  metadata: { issues: validationResult.error.issues.slice(0, 3) },
});

// Debug log (only in development)
logger.debug('Cache hit', {
  metadata: { cacheKey, ttl: 3600 },
});
```

### Log Levels

**Environment-based filtering:**

```typescript
// Skip debug logs in production unless LOG_LEVEL is debug
if (level === 'debug' && env.LOG_LEVEL !== 'debug') {
  return;
}

// Skip info logs if LOG_LEVEL is warn or error
if (level === 'info' && (env.LOG_LEVEL === 'warn' || env.LOG_LEVEL === 'error')) {
  return;
}
```

**Set LOG_LEVEL in Vercel:**
```bash
vercel env add LOG_LEVEL production
# Values: debug | info | warn | error
```

### Request ID Tracing

**Generate unique request IDs for correlation:**

```typescript
/**
 * Generate unique request ID
 */
function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request): Promise<Response> {
  const requestId = getRequestId();

  logger.info('[webhook] Incoming request', { requestId });

  // Use requestId in all subsequent logs
  logger.error('Processing failed', error, { requestId });

  return jsonResponse({ request_id: requestId });
}
```

From [app/api/whatsapp/webhook/route.ts:28-31](../../app/api/whatsapp/webhook/route.ts)

**Benefits:**
- Track request lifecycle
- Correlate logs across services
- Debug distributed transactions

---

## Performance Monitoring

### Latency Tracking

**Measure and log API latency:**

```typescript
const startTime = Date.now();

const res = await fetch(url, { ... });

const latency = Date.now() - startTime;

// Log slow requests
if (latency > 100) {
  console.warn(`WhatsApp API slow response: ${latency}ms`);
}

// Log performance metrics (Vercel Observability)
logger.info('API call completed', {
  requestId,
  duration: latency,
  metadata: { endpoint: url, status: res.status },
});
```

From [lib/whatsapp.ts:93-122](../../lib/whatsapp.ts)

### Cold Start Detection

**Monitor cold starts:**

```typescript
let isWarmStart = false;

export async function GET(req: Request): Promise<Response> {
  const isColdStart = !isWarmStart;
  isWarmStart = true;

  if (isColdStart) {
    logger.info('Cold start detected', {
      metadata: { runtime: 'edge' },
    });
  }

  // Rest of handler...
}
```

### Memory Monitoring

**Track memory usage (development only):**

```typescript
if (process.env.NODE_ENV === 'development') {
  const memUsage = (performance as any).memory;
  if (memUsage) {
    const usedMB = (memUsage.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (memUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2);

    logger.debug('Memory usage', {
      metadata: { usedMB, limitMB, percent: (usedMB / limitMB * 100).toFixed(1) },
    });
  }
}
```

**Note:** `performance.memory` not available in production Edge Runtime

### Performance Budgets

**Set alerts for performance thresholds:**

```typescript
const PERFORMANCE_BUDGETS = {
  WEBHOOK_RESPONSE: 5000, // 5s (WhatsApp requirement)
  DATABASE_QUERY: 1000, // 1s
  API_CALL: 100, // 100ms
  AI_RESPONSE: 30000, // 30s
};

const duration = Date.now() - startTime;

if (duration > PERFORMANCE_BUDGETS.WEBHOOK_RESPONSE) {
  logger.warn('Performance budget exceeded', {
    requestId,
    duration,
    metadata: { budget: PERFORMANCE_BUDGETS.WEBHOOK_RESPONSE },
  });
}
```

---

## Error Tracking

### Error Rate Monitoring

**Track error rates and patterns:**

```typescript
const errorMetrics = {
  total: 0,
  byType: new Map<string, number>(),
  byEndpoint: new Map<string, number>(),
};

function trackError(error: Error, endpoint: string) {
  errorMetrics.total++;

  const type = error.name;
  errorMetrics.byType.set(type, (errorMetrics.byType.get(type) || 0) + 1);
  errorMetrics.byEndpoint.set(endpoint, (errorMetrics.byEndpoint.get(endpoint) || 0) + 1);

  // Alert if error rate exceeds threshold
  if (errorMetrics.total > 100) {
    logger.error('High error rate detected', new Error('Error threshold exceeded'), {
      metadata: { total: errorMetrics.total, byType: Object.fromEntries(errorMetrics.byType) },
    });
  }
}
```

### Error Grouping

**Group similar errors for better analysis:**

```typescript
function getErrorFingerprint(error: Error): string {
  // Create unique fingerprint for error grouping
  return `${error.name}:${error.message.slice(0, 100)}`;
}

const errorCounts = new Map<string, number>();

function logError(error: Error, context: LogContext) {
  const fingerprint = getErrorFingerprint(error);
  errorCounts.set(fingerprint, (errorCounts.get(fingerprint) || 0) + 1);

  logger.error(error.message, error, {
    ...context,
    metadata: {
      fingerprint,
      count: errorCounts.get(fingerprint),
    },
  });
}
```

---

## Debugging Techniques

### Local Development Debugging

**1. Enable detailed logging:**

```bash
# .env.local
LOG_LEVEL=debug
NODE_ENV=development
```

**2. Use Vercel dev server:**

```bash
npm run dev
# Tail logs in real-time
vercel logs --follow
```

**3. Debug with curl:**

```bash
# Test webhook locally
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$(echo -n '{"entry":[]}' | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | cut -d' ' -f2)" \
  -d '{"entry":[]}'
```

### Production Debugging

**1. Stream production logs:**

```bash
vercel logs --follow --project migue-ai
```

**2. Filter logs by request ID:**

```bash
vercel logs --project migue-ai | grep "requestId\":\"xyz123"
```

**3. Search logs in Dashboard:**

Navigate to: `Vercel Dashboard → Logs → Filter`

Filters:
- Level: error
- Service: migue-ai
- Time range: Last 1 hour

### Request Tracing

**Trace a request across multiple services:**

```typescript
// Generate trace ID in webhook
const traceId = getRequestId();

// Pass to all downstream calls
logger.info('Processing message', {
  requestId: traceId,
  metadata: { userId, conversationId },
});

// OpenAI call
logger.info('Calling OpenAI', {
  requestId: traceId,
  metadata: { model: 'gpt-4o' },
});

// Database call
logger.info('Saving to database', {
  requestId: traceId,
  metadata: { table: 'messages' },
});

// Response sent
logger.info('Response sent', {
  requestId: traceId,
  duration: Date.now() - startTime,
});
```

**Search by trace ID in logs:**
```bash
vercel logs | grep "xyz123"
```

---

## Third-Party Integrations

### Sentry (Error Tracking)

**1. Install Sentry:**

```bash
npm install @sentry/nextjs
```

**2. Configure Sentry:**

```typescript
// lib/sentry.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  enabled: process.env.NODE_ENV === 'production',
});

export { Sentry };
```

**3. Use in error handlers:**

```typescript
try {
  await processMessage(message);
} catch (error: any) {
  // Log to Sentry
  Sentry.captureException(error, {
    tags: { service: 'whatsapp-webhook' },
    extra: { requestId, userId },
  });

  logger.error('Processing failed', error, { requestId });
}
```

### Datadog (APM)

**1. Add Datadog agent:**

```bash
npm install dd-trace
```

**2. Initialize in Edge Runtime:**

```typescript
// Not recommended for Edge Runtime (use Vercel Observability instead)
// Edge Functions don't support full APM agents
```

**Alternative: Use Log Drains**

Configure Datadog log drain in Vercel:
```bash
vercel integrations add datadog
```

### Checkly (Synthetic Monitoring)

**1. Create API check:**

```javascript
// checkly-check.js
const { ApiCheck } = require('checkly');

new ApiCheck('whatsapp-webhook-health', {
  name: 'WhatsApp Webhook Health',
  activated: true,
  locations: ['us-east-1', 'eu-west-1'],
  request: {
    method: 'GET',
    url: 'https://migue.app/api/health',
  },
  assertions: [
    { source: 'STATUS_CODE', comparison: 'EQUALS', target: '200' },
    { source: 'RESPONSE_TIME', comparison: 'LESS_THAN', target: 1000 },
  ],
});
```

### Log Drains

**Configure log drain for third-party tools:**

```bash
# Add log drain
vercel integrations add log-drains

# Supported: Datadog, Splunk, Sumo Logic, New Relic, etc.
```

---

## Production Playbook

### Incident Response

**1. High Error Rate Alert**

```bash
# Check error rate
vercel logs --project migue-ai | grep '"level":"error"' | wc -l

# Identify most common error
vercel logs --project migue-ai | grep '"level":"error"' | jq '.error.message' | sort | uniq -c | sort -rn

# Find affected users
vercel logs --project migue-ai | grep '"level":"error"' | jq '.userId' | sort | uniq
```

**2. Slow Response Alert**

```bash
# Find slow requests
vercel logs --project migue-ai | jq 'select(.duration > 5000)' | jq '{requestId, duration, userId}'

# Check API latency
vercel logs --project migue-ai | grep 'WhatsApp API slow response'
```

**3. High Memory Usage**

```bash
# Identify memory-intensive requests
# (Note: Memory metrics not directly available in logs)

# Check cold starts (potential memory issue indicator)
vercel logs --project migue-ai | grep 'Cold start detected'

# Review recent deployments
vercel ls --project migue-ai
```

### Health Check Endpoint

**Create health check for monitoring:**

```typescript
// app/api/health/route.ts
export const runtime = 'edge';

export async function GET(req: Request): Promise<Response> {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime?.() || 0,
    checks: {
      supabase: 'unknown',
      openai: 'unknown',
      whatsapp: 'unknown',
    },
  };

  // Optional: Check service availability
  try {
    await getSupabaseServerClient().from('messages').select('id').limit(1);
    health.checks.supabase = 'healthy';
  } catch {
    health.checks.supabase = 'unhealthy';
    health.status = 'degraded';
  }

  return new Response(JSON.stringify(health), {
    status: health.status === 'healthy' ? 200 : 503,
    headers: { 'content-type': 'application/json' },
  });
}
```

### Alerting Rules

**Set up alerts in Vercel Dashboard:**

1. **Error Rate Alert**: >1% errors in 5 minutes
2. **Latency Alert**: P95 > 500ms for 5 minutes
3. **Availability Alert**: <99% success rate in 15 minutes
4. **Cold Start Alert**: >10% cold starts in 1 hour

---

## Monitoring Checklist

### Pre-Deployment

- [ ] Structured logging implemented
- [ ] Request IDs generated
- [ ] Error tracking configured
- [ ] Performance budgets set
- [ ] Health check endpoint created
- [ ] Log level configured (production: info/warn/error)

### Post-Deployment

- [ ] Vercel Observability enabled
- [ ] Dashboard reviewed for errors
- [ ] Latency metrics checked (P50, P95, P99)
- [ ] Cold start percentage <5%
- [ ] Memory usage <100 MB
- [ ] Error rate <0.1%
- [ ] Logs searchable by requestId

### Ongoing

- [ ] Monitor error trends daily
- [ ] Review slow requests weekly
- [ ] Analyze cold starts monthly
- [ ] Optimize performance budgets quarterly
- [ ] Update alerting rules as needed

---

## Related Documentation

- [edge-functions-optimization.md](./edge-functions-optimization.md) - Performance optimization
- [edge-security-guide.md](./edge-security-guide.md) - Security monitoring
- [edge-error-handling.md](./edge-error-handling.md) - Error handling patterns

---

**Last Updated:** 2025-10-03
**Observability Platform:** Vercel Observability (Oct 2024)
**Log Format:** JSON (structured)
**Retention:** 7 days (Hobby), 30 days (Pro), 90 days (Enterprise)
