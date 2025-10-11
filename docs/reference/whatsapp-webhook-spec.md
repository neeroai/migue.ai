# WhatsApp Webhook API Specification

**Complete API specification for WhatsApp Business API v23.0 webhooks**

---

## Table of Contents

- [Overview](#overview)
- [Webhook Verification (GET)](#webhook-verification-get)
- [Webhook Events (POST)](#webhook-events-post)
- [Message Types](#message-types)
- [Interactive Messages](#interactive-messages)
- [Error Responses](#error-responses)
- [Testing](#testing)

---

## Overview

WhatsApp Business API v23.0 webhooks notify your application of incoming messages and events.

**Base URL**: `https://your-domain.com/api/whatsapp/webhook`

**Authentication**:
- Webhook verification (GET): Query parameter token
- Message events (POST): HMAC-SHA256 signature in `X-Hub-Signature-256` header

**Requirements**:
- **Response time**: <5 seconds (WhatsApp timeout)
- **HTTPS required**: No self-signed certificates
- **Signature validation**: Required for production

---

## Webhook Verification (GET)

WhatsApp sends a GET request to verify webhook ownership.

### Request

```http
GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hub.mode` | string | Yes | Must be `subscribe` |
| `hub.verify_token` | string | Yes | Must match your configured token |
| `hub.challenge` | string | Yes | Random string to echo back |

### Response

**Success (200 OK):**
```
CHALLENGE_STRING
```

**Headers**:
```
Content-Type: text/plain
```

**Failure (401 Unauthorized):**
```
Unauthorized
```

### Implementation

```typescript
export function verifyToken(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (
    mode === 'subscribe' &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    return new Response(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    });
  }

  return new Response('Unauthorized', { status: 401 });
}
```

From [lib/webhook-validation.ts:106-118](../../lib/webhook-validation.ts)

---

## Webhook Events (POST)

WhatsApp sends POST requests for incoming messages.

### Request

```http
POST /api/whatsapp/webhook
Content-Type: application/json
X-Hub-Signature-256: sha256=HMAC_SHA256_SIGNATURE
```

**Headers**:

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Hub-Signature-256` | Yes | HMAC-SHA256 signature of request body |

**Payload Structure**:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15551234567",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": {
                  "name": "John Doe"
                },
                "wa_id": "15559876543"
              }
            ],
            "messages": [
              {
                "from": "15559876543",
                "id": "wamid.ABC123==",
                "timestamp": "1234567890",
                "type": "text",
                "text": {
                  "body": "Hello, world!"
                }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Response

**Success (200 OK):**
```json
{
  "success": true,
  "request_id": "abc123"
}
```

**Error (400/401/500):**
```json
{
  "error": "Error description",
  "request_id": "abc123",
  "issues": [/* Zod validation errors */]
}
```

### Signature Validation

```typescript
export async function validateSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256');
  const secret = process.env.WHATSAPP_APP_SECRET;

  if (!header || !secret) {
    return false;
  }

  const [algorithm, provided] = header.split('=');

  if (algorithm !== 'sha256') {
    return false;
  }

  const expected = await hmacSha256Hex(secret, rawBody);

  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  return diff === 0;
}
```

From [lib/webhook-validation.ts:46-93](../../lib/webhook-validation.ts)

---

## Message Types

### Text Message

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "text",
  "text": {
    "body": "Hello, world!"
  }
}
```

**Schema**:
```typescript
const TextContentSchema = z.object({
  body: z.string().min(1),
});
```

### Image Message

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "image",
  "image": {
    "id": "IMAGE_ID",
    "mime_type": "image/jpeg",
    "sha256": "HASH",
    "caption": "Optional caption"
  }
}
```

### Audio/Voice Message

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "audio",
  "audio": {
    "id": "AUDIO_ID",
    "mime_type": "audio/ogg; codecs=opus",
    "sha256": "HASH"
  }
}
```

### Document Message

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "document",
  "document": {
    "id": "DOCUMENT_ID",
    "mime_type": "application/pdf",
    "sha256": "HASH",
    "caption": "Invoice.pdf"
  }
}
```

### Location Message (v23.0)

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "location",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "name": "San Francisco",
    "address": "CA, USA"
  }
}
```

**Schema**:
```typescript
const LocationContentSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});
```

From [types/schemas.ts:42-47](../../types/schemas.ts)

### Reaction Message

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "reaction",
  "reaction": {
    "message_id": "wamid.ORIGINAL_MESSAGE==",
    "emoji": "👍"
  }
}
```

---

## Interactive Messages

### Button Reply

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "interactive",
  "interactive": {
    "type": "button_reply",
    "button_reply": {
      "id": "schedule_confirm",
      "title": "Confirmar Cita"
    }
  }
}
```

**Schema**:
```typescript
const ButtonReplyContentSchema = z.object({
  type: z.literal('button_reply'),
  button_reply: z.object({
    "id": z.string(),
    title: z.string(),
  }),
});
```

From [types/schemas.ts:56-62](../../types/schemas.ts)

### List Reply

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "interactive",
  "interactive": {
    "type": "list_reply",
    "list_reply": {
      "id": "reminder_30min",
      "title": "30 minutos antes",
      "description": "Recordar 30 minutos antes de la cita"
    }
  }
}
```

**Schema**:
```typescript
const ListReplyContentSchema = z.object({
  type: z.literal('list_reply'),
  list_reply: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
  }),
});
```

From [types/schemas.ts:64-71](../../types/schemas.ts)

### CTA Button Reply (v23.0)

```json
{
  "from": "15559876543",
  "id": "wamid.ABC123==",
  "timestamp": "1234567890",
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "cta_url": {
      "id": "view_appointment",
      "title": "Ver Cita"
    }
  }
}
```

---

## Error Responses

### 400 Bad Request

**Invalid JSON:**
```json
{
  "error": "Invalid JSON body",
  "request_id": "abc123"
}
```

**Invalid payload:**
```json
{
  "error": "Invalid webhook payload",
  "request_id": "abc123",
  "issues": [
    {
      "path": ["entry", 0, "changes", 0, "value", "messages", 0, "from"],
      "message": "Invalid E.164 phone number"
    }
  ]
}
```

### 401 Unauthorized

**Invalid signature:**
```json
{
  "error": "Invalid signature",
  "request_id": "abc123"
}
```

### 500 Internal Server Error

**Database error:**
```json
{
  "error": "DB error",
  "detail": "Connection timeout",
  "request_id": "abc123"
}
```

---

## Testing

### Test Webhook Verification (GET)

```bash
curl "https://your-domain.com/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"

# Expected: test123
```

### Test Message Webhook (POST)

```bash
# Generate signature
PAYLOAD='{"entry":[{"changes":[{"value":{"messages":[{"from":"+15551234567","id":"test","timestamp":"1234567890","type":"text","text":{"body":"Test"}}]}}]}]}'

SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WHATSAPP_APP_SECRET" | cut -d' ' -f2)

# Send request
curl -X POST https://your-domain.com/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -d "$PAYLOAD"

# Expected: {"success":true,"request_id":"..."}
```

### Test with Postman

1. **Create POST request**: `https://your-domain.com/api/whatsapp/webhook`

2. **Add headers**:
   - `Content-Type`: `application/json`
   - `X-Hub-Signature-256`: `sha256=SIGNATURE`

3. **Generate signature** (Pre-request Script):
   ```javascript
   const crypto = require('crypto-js');
   const secret = pm.environment.get('WHATSAPP_APP_SECRET');
   const body = pm.request.body.raw;
   const signature = crypto.HmacSHA256(body, secret).toString();
   pm.request.headers.add({
     key: 'X-Hub-Signature-256',
     value: `sha256=${signature}`,
   });
   ```

4. **Send request**

---

## Rate Limits

| Limit | Value | Scope |
|-------|-------|-------|
| Messages sent | 250/sec | Per business account |
| Webhook retries | 5 attempts | Per message |
| Response timeout | 5 seconds | Per webhook |

**Retry schedule**:
- Attempt 1: Immediate
- Attempt 2: 15s delay
- Attempt 3: 30s delay
- Attempt 4: 1min delay
- Attempt 5: 5min delay

---

## Related Documentation

- [edge-security-guide.md](../05-deployment/edge-security-guide.md) - Signature validation
- [edge-runtime-api.md](./edge-runtime-api.md) - Edge Runtime APIs
- [api-performance-guide.md](./api-performance-guide.md) - Performance optimization

---

**Last Updated:** 2025-10-03
**WhatsApp API Version:** v23.0
**Webhook Timeout:** 5 seconds
**Max Retries:** 5 attempts with exponential backoff
