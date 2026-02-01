---
title: API Contracts & Schemas
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: All API endpoints with TypeScript interfaces and Zod schemas
---

# API Contracts & Schemas

## Quick Reference
- **Purpose**: Complete API contract specification with request/response types, Zod validation, error codes
- **References**: docs/architecture/ai-agent-system.md, docs/patterns/tool-orchestration.md, docs/patterns/edge-runtime-optimization.md
- **Endpoints**: 5 main routes (webhook, flows, health, cron reminders, cron windows)

---

## API Overview

| Endpoint | Method | Runtime | Auth | Purpose | Timeout |
|----------|--------|---------|------|---------|---------|
| /api/whatsapp/webhook | POST | Edge | HMAC | Receive WhatsApp messages | 5s |
| /api/whatsapp/webhook | GET | Edge | Token | Webhook verification | 1s |
| /api/whatsapp/flows | POST | Edge | HMAC | Handle WhatsApp Flows responses | 5s |
| /api/health | GET | Edge | None | Health check | 1s |
| /api/cron/check-reminders | GET | Edge | Cron Secret | Process pending reminders | 10s |
| /api/cron/maintain-windows | GET | Edge | Cron Secret | Update messaging windows | 10s |

**Source**: docs/architecture/ai-agent-system.md L1-50, docs/patterns/edge-runtime-optimization.md L36-43

---

## WhatsApp Webhook Endpoint

### POST /api/whatsapp/webhook

**Purpose**: Receive and process WhatsApp messages with AI agent

#### Request Schema

```typescript
// Zod schema for validation
import { z } from 'zod';

const WhatsAppMessageSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal('whatsapp'),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z.array(
              z.object({
                profile: z.object({
                  name: z.string(),
                }),
                wa_id: z.string(), // User's WhatsApp ID
              })
            ).optional(),
            messages: z.array(
              z.object({
                from: z.string(), // User phone number
                id: z.string(), // Message ID
                timestamp: z.string(),
                type: z.enum(['text', 'audio', 'image', 'interactive', 'button', 'location']),
                text: z.object({
                  body: z.string(),
                }).optional(),
                audio: z.object({
                  id: z.string(),
                  mime_type: z.string(),
                }).optional(),
                image: z.object({
                  id: z.string(),
                  mime_type: z.string(),
                  caption: z.string().optional(),
                }).optional(),
                interactive: z.object({
                  type: z.enum(['button_reply', 'list_reply']),
                  button_reply: z.object({
                    id: z.string(),
                    title: z.string(),
                  }).optional(),
                  list_reply: z.object({
                    id: z.string(),
                    title: z.string(),
                    description: z.string().optional(),
                  }).optional(),
                }).optional(),
                location: z.object({
                  latitude: z.number(),
                  longitude: z.number(),
                  name: z.string().optional(),
                  address: z.string().optional(),
                }).optional(),
              })
            ).optional(),
            statuses: z.array(
              z.object({
                id: z.string(),
                status: z.enum(['sent', 'delivered', 'read', 'failed']),
                timestamp: z.string(),
                recipient_id: z.string(),
              })
            ).optional(),
          }),
          field: z.literal('messages'),
        })
      ),
    })
  ),
});

type WhatsAppWebhook = z.infer<typeof WhatsAppMessageSchema>;
```

#### Response Schema

```typescript
// Success response
const WebhookResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  processingTime: z.number(), // milliseconds
});

type WebhookResponse = z.infer<typeof WebhookResponseSchema>;

// Error response
const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
});

type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
```

#### Headers

```typescript
// Required headers
interface RequiredHeaders {
  'X-Hub-Signature-256': string; // HMAC SHA256 signature
  'Content-Type': 'application/json';
}

// Validation
const validateSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = `sha256=${hmac.update(payload).digest('hex')}`;
  return signature === expectedSignature;
};
```

#### Error Codes

| Code | Status | Message | Action |
|------|--------|---------|--------|
| INVALID_SIGNATURE | 401 | HMAC signature validation failed | Check webhook secret |
| INVALID_PAYLOAD | 400 | Malformed webhook payload | Check WhatsApp API version |
| USER_NOT_FOUND | 404 | User not registered | Auto-create user |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests | Retry after 60s |
| AI_PROVIDER_ERROR | 502 | AI provider unavailable | Use fallback provider |
| PROCESSING_TIMEOUT | 504 | Processing exceeded 5s | Queue for retry |
| INTERNAL_ERROR | 500 | Unexpected error | Log and alert |

**Source**: docs/patterns/error-handling-fallbacks.md L1-50

---

## WhatsApp Webhook Verification

### GET /api/whatsapp/webhook

**Purpose**: Verify webhook URL during Meta app setup

#### Request Schema

```typescript
const WebhookVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

type WebhookVerification = z.infer<typeof WebhookVerificationSchema>;
```

#### Response

```typescript
// Success: Return challenge as plain text
const response = new Response(challenge, {
  status: 200,
  headers: { 'Content-Type': 'text/plain' },
});

// Error: Invalid token
const response = new Response('Forbidden', { status: 403 });
```

---

## WhatsApp Flows Endpoint

### POST /api/whatsapp/flows

**Purpose**: Handle WhatsApp Flows data exchange and responses

#### Request Schema

```typescript
const FlowRequestSchema = z.object({
  version: z.string(), // Flow version
  action: z.enum(['data_exchange', 'INIT', 'NAVIGATE']),
  screen: z.string(), // Current screen ID
  data: z.record(z.any()), // Form data
  flow_token: z.string(), // Security token
});

type FlowRequest = z.infer<typeof FlowRequestSchema>;
```

#### Response Schema

```typescript
const FlowResponseSchema = z.object({
  version: z.string(),
  screen: z.string(), // Next screen ID
  data: z.record(z.any()), // Screen data
  error_message: z.string().optional(),
});

type FlowResponse = z.infer<typeof FlowResponseSchema>;
```

#### Example: Appointment Booking Flow

```typescript
// INIT action response
{
  version: '3.0',
  screen: 'SELECT_DATE',
  data: {
    available_dates: [
      { id: '2026-01-30', label: 'Tomorrow' },
      { id: '2026-01-31', label: 'Friday' }
    ]
  }
}

// NAVIGATE action response (after date selection)
{
  version: '3.0',
  screen: 'SELECT_TIME',
  data: {
    selected_date: '2026-01-30',
    available_times: [
      { id: '09:00', label: '9:00 AM' },
      { id: '14:00', label: '2:00 PM' }
    ]
  }
}

// Data exchange (final submission)
{
  version: '3.0',
  screen: 'CONFIRMATION',
  data: {
    event_id: 'evt_123',
    title: 'Appointment',
    datetime: '2026-01-30T09:00:00-05:00',
    message: 'Appointment booked successfully'
  }
}
```

**Source**: docs/features/whatsapp-flows-integration.md L1-50

---

## Health Check Endpoint

### GET /api/health

**Purpose**: Verify service availability and dependencies

#### Response Schema

```typescript
const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      latency: z.number(), // milliseconds
    }),
    ai_primary: z.object({
      status: z.enum(['up', 'down']),
      provider: z.string(),
      latency: z.number(),
    }),
    ai_fallback: z.object({
      status: z.enum(['up', 'down']),
      provider: z.string(),
    }).optional(),
    whatsapp: z.object({
      status: z.enum(['up', 'down']),
    }),
  }),
  version: z.string(), // App version
});

type HealthResponse = z.infer<typeof HealthResponseSchema>;
```

#### Example Response

```typescript
{
  status: 'healthy',
  timestamp: '2026-01-29T10:30:00Z',
  services: {
    database: { status: 'up', latency: 45 },
    ai_primary: { status: 'up', provider: 'openai', latency: 320 },
    ai_fallback: { status: 'up', provider: 'claude' },
    whatsapp: { status: 'up' }
  },
  version: '1.0.0'
}
```

---

## Cron Endpoints

### GET /api/cron/check-reminders

**Purpose**: Process pending reminders every minute

#### Headers

```typescript
interface CronHeaders {
  Authorization: `Bearer ${string}`; // CRON_SECRET from env
}
```

#### Response Schema

```typescript
const CheckRemindersResponseSchema = z.object({
  processed: z.number(),
  sent: z.number(),
  failed: z.number(),
  duration: z.number(), // milliseconds
});

type CheckRemindersResponse = z.infer<typeof CheckRemindersResponseSchema>;
```

### GET /api/cron/maintain-windows

**Purpose**: Update messaging window status every 5 minutes

#### Response Schema

```typescript
const MaintainWindowsResponseSchema = z.object({
  checked: z.number(),
  expired: z.number(),
  duration: z.number(),
});

type MaintainWindowsResponse = z.infer<typeof MaintainWindowsResponseSchema>;
```

---

## Rate Limiting

| Endpoint | Limit | Window | Action |
|----------|-------|--------|--------|
| /api/whatsapp/webhook | 50/user | 60s | Return 429 + Retry-After header |
| /api/whatsapp/flows | 20/user | 60s | Return 429 + error message |
| /api/health | 100/IP | 60s | Return 429 |
| /api/cron/* | 1/minute | - | Reject duplicate runs |

**Implementation**:

```typescript
interface RateLimitConfig {
  endpoint: string;
  limit: number;
  windowMs: number;
  keyGenerator: (req: Request) => string; // user_id or IP
}

const rateLimiters: RateLimitConfig[] = [
  {
    endpoint: '/api/whatsapp/webhook',
    limit: 50,
    windowMs: 60000,
    keyGenerator: (req) => extractUserId(req), // From WhatsApp payload
  },
  {
    endpoint: '/api/whatsapp/flows',
    limit: 20,
    windowMs: 60000,
    keyGenerator: (req) => extractUserId(req),
  },
];
```

**Storage**: Use Supabase `rate_limits` table with sliding window

**Source**: docs/patterns/edge-runtime-optimization.md L1-50

---

## Error Response Format

**Standard error response** (all endpoints):

```typescript
interface ErrorResponse {
  error: {
    code: string; // Machine-readable error code
    message: string; // Human-readable message (English)
    details?: Record<string, any>; // Additional context
    timestamp: string; // ISO 8601
    request_id?: string; // For debugging
  };
}

// Example
{
  error: {
    code: 'AI_PROVIDER_ERROR',
    message: 'AI provider unavailable, using fallback',
    details: {
      primary_provider: 'openai',
      fallback_provider: 'claude',
      retry_after: 120
    },
    timestamp: '2026-01-29T10:30:00Z',
    request_id: 'req_abc123'
  }
}
```

---

## TypeScript Interfaces Summary

```typescript
// Core types exported from lib/types.ts
export type {
  WhatsAppWebhook,
  WhatsAppMessage,
  WebhookResponse,
  ErrorResponse,
  FlowRequest,
  FlowResponse,
  HealthResponse,
  CheckRemindersResponse,
  MaintainWindowsResponse,
};

// Zod schemas exported from lib/schemas.ts
export {
  WhatsAppMessageSchema,
  WebhookResponseSchema,
  ErrorResponseSchema,
  FlowRequestSchema,
  FlowResponseSchema,
  HealthResponseSchema,
  CheckRemindersResponseSchema,
  MaintainWindowsResponseSchema,
};
```

---

## Testing Checklist

- [ ] Webhook verification (GET) returns challenge
- [ ] Webhook signature validation rejects invalid HMAC
- [ ] Webhook accepts valid WhatsApp message payload
- [ ] Rate limiting triggers at configured thresholds
- [ ] Error responses follow standard format
- [ ] Health endpoint reports service status
- [ ] Cron endpoints require valid Authorization header
- [ ] All Zod schemas validate correctly

---

**Lines**: 300 | **Tokens**: ~720 | **Status**: Ready for implementation
