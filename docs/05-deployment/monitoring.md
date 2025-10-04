# Vercel Monitoring & Analytics - Guía Completa 2025

## 📖 Overview

Guía completa para implementar observabilidad, monitoring y analytics en aplicaciones Vercel Edge Functions, con énfasis en chatbots de WhatsApp y APIs de IA.

---

## 🎯 KPIs Clave para Chatbots

### 1. Performance Metrics

| Métrica | Target | Crítico |
|---------|--------|---------|
| Response Time (p50) | < 500ms | < 2s |
| Response Time (p95) | < 1s | < 3s |
| Edge Function Execution | < 100ms | < 500ms |
| Database Query Time | < 50ms | < 200ms |
| OpenAI API Latency | < 1s | < 3s |

### 2. Business Metrics

| Métrica | Target | Descripción |
|---------|--------|-------------|
| Intent Classification Accuracy | > 95% | % intents correctos |
| Conversation Completion Rate | > 80% | % conversaciones resueltas |
| User Satisfaction (CSAT) | > 4.5/5 | Rating promedio |
| Daily Active Users (DAU) | Trending up | Usuarios únicos/día |
| Message Volume | Tracking | Mensajes procesados/día |

### 3. System Health

| Métrica | Target | Alerta |
|---------|--------|--------|
| Error Rate | < 1% | > 5% |
| Timeout Rate | < 0.5% | > 2% |
| API Success Rate | > 99% | < 95% |
| Edge Function Cold Starts | < 5% | > 15% |
| Database Connection Pool | < 80% | > 90% |

---

## 📊 Structured Logging

### 1. Log Schema

```typescript
// lib/logger.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  // Core fields
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;

  // Request context
  requestId?: string;
  userId?: string;
  userPhone?: string;

  // Performance
  duration?: number;
  endpoint?: string;
  method?: string;
  statusCode?: number;

  // AI specific
  intent?: string;
  intentConfidence?: number;
  tokensUsed?: number;
  model?: string;

  // Error context
  error?: string;
  errorStack?: string;
  errorCode?: string;

  // Custom metadata
  metadata?: Record<string, unknown>;
}

export class Logger {
  private service: string;
  private environment: string;

  constructor(service = 'migue-ai') {
    this.service = service;
    this.environment = process.env.VERCEL_ENV || 'development';
  }

  private format(entry: Partial<LogEntry>): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      service: this.service,
      environment: this.environment,
      level: entry.level || 'info',
      message: entry.message || '',
      ...entry,
    };
  }

  debug(message: string, metadata?: Partial<LogEntry>) {
    if (this.environment === 'production') return; // No debug in prod
    console.log(JSON.stringify(this.format({ level: 'debug', message, ...metadata })));
  }

  info(message: string, metadata?: Partial<LogEntry>) {
    console.log(JSON.stringify(this.format({ level: 'info', message, ...metadata })));
  }

  warn(message: string, metadata?: Partial<LogEntry>) {
    console.warn(JSON.stringify(this.format({ level: 'warn', message, ...metadata })));
  }

  error(message: string, error?: Error, metadata?: Partial<LogEntry>) {
    console.error(JSON.stringify(this.format({
      level: 'error',
      message,
      error: error?.message,
      errorStack: error?.stack,
      ...metadata,
    })));
  }

  fatal(message: string, error?: Error, metadata?: Partial<LogEntry>) {
    console.error(JSON.stringify(this.format({
      level: 'fatal',
      message,
      error: error?.message,
      errorStack: error?.stack,
      ...metadata,
    })));
  }
}

export const logger = new Logger();
```

### 2. Usage in Edge Functions

```typescript
// api/whatsapp/webhook.ts
export const config = { runtime: 'edge' };

import { logger } from '../../lib/logger';

export default async function handler(req: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  logger.info('Webhook received', {
    requestId,
    method: req.method,
    endpoint: '/api/whatsapp/webhook',
  });

  try {
    const body = await req.json();
    const message = extractMessage(body);

    // Log intent classification
    const intent = await classifyIntent(message.content);
    logger.info('Intent classified', {
      requestId,
      intent: intent.intent,
      intentConfidence: intent.confidence,
      userPhone: message.from,
    });

    // Generate response
    const response = await generateResponse(intent, message);
    logger.info('Response generated', {
      requestId,
      tokensUsed: response.tokensUsed,
      model: 'gpt-4o',
    });

    // Success log
    logger.info('Request completed successfully', {
      requestId,
      duration: Date.now() - startTime,
      statusCode: 200,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    logger.error('Request failed', error as Error, {
      requestId,
      duration: Date.now() - startTime,
      statusCode: 500,
    });

    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}
```

---

## 📈 Vercel Analytics Integration

### 1. Basic Setup

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.Node }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### 2. Custom Events Tracking

```typescript
// lib/analytics.ts
import { track } from '@vercel/analytics';

export const analytics = {
  // User events
  userRegistered: (userId: string, phone: string) => {
    track('user_registered', { userId, phone });
  },

  // Message events
  messageReceived: (intent: string, confidence: number) => {
    track('message_received', { intent, confidence });
  },

  messageSent: (tokensUsed: number, model: string) => {
    track('message_sent', { tokensUsed, model });
  },

  // Conversation events
  conversationStarted: (userId: string) => {
    track('conversation_started', { userId });
  },

  conversationCompleted: (userId: string, duration: number) => {
    track('conversation_completed', { userId, duration });
  },

  // Error events
  errorOccurred: (errorType: string, errorMessage: string) => {
    track('error_occurred', { errorType, errorMessage });
  },

  // AI events
  intentClassified: (intent: string, confidence: number) => {
    track('intent_classified', { intent, confidence });
  },

  aiResponseGenerated: (tokensUsed: number, duration: number) => {
    track('ai_response_generated', { tokensUsed, duration });
  },
};
```

### 3. Usage Example

```typescript
// api/whatsapp/webhook.ts
import { analytics } from '../../lib/analytics';

export default async function handler(req: Request) {
  try {
    // Track message received
    const message = await extractMessage(req);
    analytics.messageReceived(message.type, 1.0);

    // Classify intent
    const intent = await classifyIntent(message.content);
    analytics.intentClassified(intent.intent, intent.confidence);

    // Generate response
    const startTime = Date.now();
    const response = await generateResponse(intent, message);
    const duration = Date.now() - startTime;

    analytics.aiResponseGenerated(response.tokensUsed, duration);
    analytics.messageSent(response.tokensUsed, 'gpt-4o');

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    analytics.errorOccurred(
      error instanceof Error ? error.name : 'Unknown',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
}
```

---

## 🔔 Error Tracking con Sentry

### 1. Setup

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 2. Configuration

```javascript
// sentry.edge.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.VERCEL_ENV || 'development',
  tracesSampleRate: 0.1, // 10% de traces
  beforeSend(event, hint) {
    // Filtrar errores no críticos
    if (event.exception?.values?.[0]?.value?.includes('AbortError')) {
      return null;
    }
    return event;
  },
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
  ],
});
```

### 3. Usage in Edge Functions

```typescript
// api/example.ts
export const config = { runtime: 'edge' };

import * as Sentry from '@sentry/nextjs';

export default async function handler(req: Request) {
  const transaction = Sentry.startTransaction({
    op: 'webhook',
    name: 'WhatsApp Webhook',
  });

  try {
    // ... handler logic

    transaction.setStatus('ok');
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    transaction.setStatus('internal_error');

    Sentry.captureException(error, {
      tags: {
        endpoint: '/api/whatsapp/webhook',
        method: req.method,
      },
      extra: {
        requestId: req.headers.get('x-request-id'),
      },
    });

    throw error;
  } finally {
    transaction.finish();
  }
}
```

---

## 📊 Custom Metrics Dashboard

### 1. Supabase Metrics Table

```sql
-- Tabla para métricas custom
CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  tags JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_name_time ON metrics(metric_name, timestamp DESC);
CREATE INDEX idx_metrics_tags ON metrics USING gin(tags);
```

### 2. Metrics Client

```typescript
// lib/metrics.ts
import { getSupabaseServerClient } from './supabase';

export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string | number>;
}

export async function recordMetric(metric: Metric) {
  const supabase = getSupabaseServerClient();

  await supabase.from('metrics').insert({
    metric_name: metric.name,
    metric_value: metric.value,
    tags: metric.tags || {},
    timestamp: new Date().toISOString(),
  });
}

export const metrics = {
  // Performance metrics
  async responseTime(duration: number, endpoint: string) {
    await recordMetric({
      name: 'response_time',
      value: duration,
      tags: { endpoint },
    });
  },

  // AI metrics
  async tokensUsed(tokens: number, model: string, intent: string) {
    await recordMetric({
      name: 'tokens_used',
      value: tokens,
      tags: { model, intent },
    });
  },

  // Business metrics
  async messageProcessed(userId: string, intent: string) {
    await recordMetric({
      name: 'message_processed',
      value: 1,
      tags: { userId, intent },
    });
  },

  // Error metrics
  async errorOccurred(errorType: string, endpoint: string) {
    await recordMetric({
      name: 'error_occurred',
      value: 1,
      tags: { errorType, endpoint },
    });
  },
};
```

### 3. Query Metrics

```sql
-- Response time p50, p95, p99
SELECT
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY metric_value) AS p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY metric_value) AS p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY metric_value) AS p99
FROM metrics
WHERE metric_name = 'response_time'
  AND timestamp > NOW() - INTERVAL '1 hour';

-- Tokens used by intent (last 24h)
SELECT
  tags->>'intent' AS intent,
  SUM(metric_value) AS total_tokens,
  COUNT(*) AS request_count,
  AVG(metric_value) AS avg_tokens_per_request
FROM metrics
WHERE metric_name = 'tokens_used'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY tags->>'intent'
ORDER BY total_tokens DESC;

-- Error rate by endpoint
SELECT
  tags->>'endpoint' AS endpoint,
  COUNT(*) AS error_count,
  DATE_TRUNC('hour', timestamp) AS hour
FROM metrics
WHERE metric_name = 'error_occurred'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY endpoint, hour
ORDER BY hour DESC, error_count DESC;
```

---

## 🚨 Alerting & Monitoring

### 1. Vercel Monitoring Dashboard

```bash
# Acceder a logs en tiempo real
vercel logs --follow

# Filtrar por función específica
vercel logs api/whatsapp/webhook.ts --follow

# Ver errores
vercel logs --level error
```

### 2. Webhook Alerts (Slack)

```typescript
// lib/alerts.ts
export async function sendSlackAlert(message: string, severity: 'info' | 'warn' | 'error') {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const colors = {
    info: '#36a64f',
    warn: '#ff9800',
    error: '#f44336',
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color: colors[severity],
        text: message,
        footer: 'migue.ai monitoring',
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}

// Usage
export async function monitorErrorRate() {
  const errorRate = await calculateErrorRate();

  if (errorRate > 0.05) { // > 5%
    await sendSlackAlert(
      `⚠️ High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
      'error'
    );
  }
}
```

### 3. Cron Job Monitoring

```typescript
// api/cron/health-check.ts
export const config = { runtime: 'edge' };

import { sendSlackAlert } from '../../lib/alerts';
import { metrics } from '../../lib/metrics';

export default async function handler(req: Request) {
  try {
    // Check database connection
    const dbHealth = await checkDatabaseHealth();
    await metrics.recordMetric({
      name: 'db_health',
      value: dbHealth ? 1 : 0,
    });

    // Check OpenAI API
    const openaiHealth = await checkOpenAIHealth();
    await metrics.recordMetric({
      name: 'openai_health',
      value: openaiHealth ? 1 : 0,
    });

    // Check WhatsApp API
    const whatsappHealth = await checkWhatsAppHealth();
    await metrics.recordMetric({
      name: 'whatsapp_health',
      value: whatsappHealth ? 1 : 0,
    });

    if (!dbHealth || !openaiHealth || !whatsappHealth) {
      await sendSlackAlert(
        `🔴 System health check failed:\nDB: ${dbHealth}\nOpenAI: ${openaiHealth}\nWhatsApp: ${whatsappHealth}`,
        'error'
      );
    }

    return new Response(JSON.stringify({ health: 'ok' }), { status: 200 });
  } catch (error) {
    await sendSlackAlert(
      `🔴 Health check error: ${error instanceof Error ? error.message : 'Unknown'}`,
      'error'
    );
    return new Response(JSON.stringify({ health: 'error' }), { status: 500 });
  }
}
```

---

## 📊 Dashboard Examples

### 1. Real-time Metrics View (SQL)

```sql
-- Create materialized view for dashboard
CREATE MATERIALIZED VIEW dashboard_metrics AS
SELECT
  DATE_TRUNC('minute', timestamp) AS minute,
  metric_name,
  AVG(metric_value) AS avg_value,
  MAX(metric_value) AS max_value,
  COUNT(*) AS count
FROM metrics
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY minute, metric_name;

-- Refresh every 5 minutes
CREATE INDEX idx_dashboard_metrics ON dashboard_metrics(minute DESC, metric_name);

-- Query for dashboard
SELECT * FROM dashboard_metrics
WHERE minute > NOW() - INTERVAL '1 hour'
ORDER BY minute DESC;
```

### 2. Vercel Analytics API

```typescript
// Query Vercel Analytics API
export async function getVercelMetrics(teamId: string, projectId: string) {
  const response = await fetch(
    `https://api.vercel.com/v1/analytics/${projectId}/series?teamId=${teamId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      },
    }
  );

  return response.json();
}
```

---

## ✅ Monitoring Checklist

### Setup
- [ ] Structured logging implementado
- [ ] Vercel Analytics configurado
- [ ] Sentry error tracking activo
- [ ] Custom metrics tabla creada
- [ ] Slack alerts configurados
- [ ] Health check cron job creado

### Dashboards
- [ ] Response time dashboard
- [ ] Error rate dashboard
- [ ] AI usage dashboard (tokens, intents)
- [ ] Business metrics dashboard (users, conversations)
- [ ] System health dashboard

### Alerts
- [ ] Error rate > 5% → Slack
- [ ] Response time p95 > 3s → Slack
- [ ] Database health → Slack
- [ ] API health (OpenAI, WhatsApp) → Slack
- [ ] Daily summary report → Email

---

## 📚 Resources

- [Vercel Analytics Docs](https://vercel.com/docs/analytics)
- [Sentry Next.js Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Structured Logging Best Practices](https://www.datadoghq.com/blog/log-management-best-practices/)

---

**Última actualización**: 2025 - Vercel Edge Functions Monitoring
