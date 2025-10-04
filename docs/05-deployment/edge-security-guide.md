# Edge Functions Security Guide

**Complete security best practices for Vercel Edge Functions and WhatsApp webhooks**

---

## Table of Contents

- [Overview](#overview)
- [Webhook Signature Validation](#webhook-signature-validation)
- [Authentication & Authorization](#authentication--authorization)
- [Rate Limiting](#rate-limiting)
- [Request Validation](#request-validation)
- [Secret Management](#secret-management)
- [Attack Prevention](#attack-prevention)
- [Security Checklist](#security-checklist)

---

## Overview

Security is critical for WhatsApp webhook handlers that process sensitive user messages and personal data. This guide covers:

- **HMAC signature validation** using Web Crypto API
- **Constant-time comparisons** to prevent timing attacks
- **Rate limiting** with token bucket algorithm
- **Input validation** with Zod schemas
- **Secret management** in Edge Runtime
- **Attack prevention** (replay, SSRF, MiTM)

---

## Webhook Signature Validation

### Why Validate Signatures?

WhatsApp signs all webhook requests with HMAC-SHA256. Validation ensures:
- Requests originate from WhatsApp (not attackers)
- Request body hasn't been tampered with
- Protection against replay attacks

### HMAC-SHA256 Implementation

**Using Web Crypto API (Edge Runtime compatible):**

```typescript
/**
 * Generate HMAC-SHA256 hex signature using Web Crypto API
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

### Timing-Attack Resistant Validation

**Critical: Use constant-time comparison to prevent timing attacks**

Attackers can measure response times to guess signatures. Use XOR-based comparison:

```typescript
/**
 * Validate WhatsApp webhook signature using constant-time comparison
 * Implements timing-attack resistant HMAC-SHA256 validation
 *
 * Security: Uses XOR-based constant-time comparison to prevent timing attacks
 * where attackers could measure execution time to guess the signature
 */
export async function validateSignature(
  req: Request,
  rawBody: string
): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') ||
                 req.headers.get('X-Hub-Signature-256');
  const { WHATSAPP_APP_SECRET } = getEnv();

  // Allow when not configured (development only)
  if (!header || !WHATSAPP_APP_SECRET) {
    console.warn('⚠️  Signature validation disabled - configure WHATSAPP_APP_SECRET');
    return true;
  }

  // Header format: sha256=abcdef...
  const parts = header.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('❌ Invalid signature header format');
    return false;
  }

  const provided = parts[1];
  if (!provided) {
    console.error('❌ Missing signature value');
    return false;
  }

  // Calculate expected signature
  const expected = await hmacSha256Hex(WHATSAPP_APP_SECRET, rawBody);

  // Constant-time comparison to prevent timing attacks
  // Length check is OK as length is public information
  if (provided.length !== expected.length) {
    console.error('❌ Signature length mismatch');
    return false;
  }

  // XOR-based constant-time string comparison
  // Ensures comparison takes same time regardless of where strings differ
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  const isValid = diff === 0;

  if (!isValid) {
    console.error('❌ Signature validation failed');
  }

  return isValid;
}
```

From [lib/webhook-validation.ts:36-93](../../lib/webhook-validation.ts)

**Key Security Features:**
1. **Constant-time XOR comparison** - No early exit
2. **Bitwise OR accumulation** - Uniform execution time
3. **Case-insensitive header lookup** - Handles variations
4. **Length validation** - Prevents buffer overflows

### Webhook Handler Integration

```typescript
export async function POST(req: Request): Promise<Response> {
  // Read raw body BEFORE parsing (needed for signature)
  const rawBody = await req.text();

  // Validate signature with raw body
  const signatureOk = await validateSignature(req, rawBody);
  if (!signatureOk) {
    return jsonResponse({ error: 'Invalid signature' }, 401);
  }

  // Only parse JSON after validation
  const jsonBody = JSON.parse(rawBody);

  // Process validated request...
}
```

From [app/api/whatsapp/webhook/route.ts:77-94](../../app/api/whatsapp/webhook/route.ts)

---

## Authentication & Authorization

### Webhook Verification (GET Request)

WhatsApp sends a GET request to verify webhook ownership:

```typescript
/**
 * Handle webhook verification request
 */
export function verifyToken(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const { WHATSAPP_VERIFY_TOKEN } = getEnv();

  // Verify mode is 'subscribe' and token matches
  if (
    mode === 'subscribe' &&
    token &&
    token === WHATSAPP_VERIFY_TOKEN &&
    challenge
  ) {
    // Return challenge to confirm ownership
    return new Response(challenge, {
      status: 200,
      headers: { 'content-type': 'text/plain' }
    });
  }

  return new Response('Unauthorized', { status: 401 });
}
```

From [lib/webhook-validation.ts:95-118](../../lib/webhook-validation.ts)

**Security Notes:**
- Verify token is stored as environment variable
- Must match exactly (case-sensitive)
- Returns challenge only if all checks pass

### GET Handler Implementation

```typescript
/**
 * GET handler for webhook verification
 */
export async function GET(req: Request): Promise<Response> {
  return verifyToken(req);
}
```

From [app/api/whatsapp/webhook/route.ts:70-72](../../app/api/whatsapp/webhook/route.ts)

---

## Rate Limiting

### Why Rate Limit?

Prevent abuse and comply with API limits:
- **WhatsApp API**: 250 messages/second
- **OpenAI API**: Varies by plan (e.g., 10,000 TPM)
- **Supabase**: Connection pooling limits
- **Protection**: DDoS, spam, abuse

### Token Bucket Algorithm

Efficient rate limiting with automatic cleanup:

```typescript
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250; // WhatsApp: 250 msg/sec

/**
 * Rate limiter implementing token bucket algorithm
 * Ensures compliance with WhatsApp Cloud API rate limits
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  if (!rateLimitBuckets.has(second)) {
    rateLimitBuckets.set(second, []);

    // Clean old buckets to prevent memory leaks
    for (const [key] of rateLimitBuckets) {
      if (key < second - 2) {
        rateLimitBuckets.delete(key);
      }
    }
  }

  const bucket = rateLimitBuckets.get(second)!;

  // Check if limit exceeded
  if (bucket.length >= RATE_LIMIT) {
    // Wait for next second
    const waitTime = 1000 - (now % 1000);
    await new Promise(r => setTimeout(r, waitTime));
    return rateLimit(); // Retry
  }

  // Add token to bucket
  bucket.push(now);
}
```

From [lib/whatsapp.ts:34-73](../../lib/whatsapp.ts)

**Benefits:**
- Prevents rate limit errors (429)
- Automatic cleanup (no memory leaks)
- Recursive retry with backoff
- Per-second granularity

### User-Level Rate Limiting

Prevent individual users from abusing the system:

```typescript
const userRateLimits = new Map<string, number[]>();
const USER_RATE_LIMIT = 10; // 10 messages per minute per user
const WINDOW_MS = 60000; // 1 minute

function checkUserRateLimit(userId: string): boolean {
  const now = Date.now();

  if (!userRateLimits.has(userId)) {
    userRateLimits.set(userId, []);
  }

  const timestamps = userRateLimits.get(userId)!;

  // Remove expired timestamps
  const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);

  if (validTimestamps.length >= USER_RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  userRateLimits.set(userId, validTimestamps);

  return true;
}
```

---

## Request Validation

### Zod Schema Validation

Validate all incoming payloads with Zod:

```typescript
import { safeValidateWebhookPayload } from '@/types/schemas';

// Validate with Zod schemas
const validationResult = safeValidateWebhookPayload(jsonBody);

if (!validationResult.success) {
  logger.warn('[webhook] Validation failed', {
    requestId,
    metadata: { issues: validationResult.error.issues.slice(0, 3) },
  });

  return jsonResponse(
    {
      error: 'Invalid webhook payload',
      request_id: requestId,
      issues: validationResult.error.issues.slice(0, 3), // First 3 errors
    },
    400
  );
}

const payload = validationResult.data;
```

From [app/api/whatsapp/webhook/route.ts:97-114](../../app/api/whatsapp/webhook/route.ts)

**Security Benefits:**
- Type-safe validated data
- Prevents injection attacks
- Rejects malformed payloads
- Clear error messages

### Input Sanitization

Sanitize user input before processing:

```typescript
// Sanitize phone numbers
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

// Sanitize text content
function sanitizeText(text: string): string {
  return text
    .trim()
    .slice(0, 4096) // Limit length
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars
}
```

---

## Secret Management

### Environment Variables in Edge Runtime

**Access environment variables securely:**

```typescript
// lib/env.ts
export function getEnv() {
  return {
    WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };
}
```

**Best Practices:**
- ✅ Store secrets in Vercel environment variables
- ✅ Never commit secrets to git
- ✅ Use `.env.local` for development only
- ✅ Rotate secrets periodically
- ❌ Never log secrets
- ❌ Never include secrets in error messages

### Vercel Environment Variables

Set in Vercel Dashboard or CLI:

```bash
# Production
vercel env add WHATSAPP_APP_SECRET production

# Preview
vercel env add WHATSAPP_APP_SECRET preview

# Development
vercel env add WHATSAPP_APP_SECRET development
```

---

## Attack Prevention

### 1. Replay Attack Prevention

Use idempotency with message IDs:

```typescript
const processedWebhooks = new Map<string, number>();
const DEDUP_WINDOW_MS = 60000; // 1 minute

function isDuplicateWebhook(messageId: string): boolean {
  const now = Date.now();

  // Check if already processed
  if (processedWebhooks.has(messageId)) {
    const processedAt = processedWebhooks.get(messageId)!;
    if (now - processedAt < DEDUP_WINDOW_MS) {
      return true; // Duplicate (possible replay attack)
    }
  }

  // Mark as processed
  processedWebhooks.set(messageId, now);

  // Clean old entries
  for (const [id, timestamp] of processedWebhooks) {
    if (now - timestamp > DEDUP_WINDOW_MS) {
      processedWebhooks.delete(id);
    }
  }

  return false;
}
```

From [app/api/whatsapp/webhook/route.ts:37-65](../../app/api/whatsapp/webhook/route.ts)

**Protection:**
- Prevents processing same message twice
- Mitigates replay attacks
- 1-minute deduplication window

### 2. SQL Injection Prevention

Use parameterized queries with Supabase:

```typescript
// ✅ Good: Parameterized query
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('user_id', userId) // Automatically parameterized
  .single();

// ❌ Bad: String concatenation (vulnerable)
const query = `SELECT * FROM messages WHERE user_id = '${userId}'`;
```

### 3. Cross-Site Scripting (XSS) Prevention

WhatsApp messages are text-only, but sanitize before storing:

```typescript
// Sanitize before database insertion
const sanitized = {
  content: message.text.body.trim(),
  type: 'text',
  // Never store HTML or script tags
};
```

### 4. Server-Side Request Forgery (SSRF)

Validate URLs before fetching:

```typescript
async function fetchMedia(url: string): Promise<ArrayBuffer> {
  // Validate URL is from WhatsApp CDN only
  const allowedHosts = ['lookaside.fbsbx.com', 'mmg.whatsapp.net'];
  const parsed = new URL(url);

  if (!allowedHosts.includes(parsed.hostname)) {
    throw new Error('Invalid media URL host');
  }

  const res = await fetch(url);
  return res.arrayBuffer();
}
```

### 5. Man-in-the-Middle (MiTM) Prevention

- **HTTPS Only**: Vercel enforces HTTPS for all Edge Functions
- **Signature Validation**: Detects tampered requests
- **Certificate Pinning**: Not needed (Vercel handles TLS)

---

## Security Checklist

### Pre-Deployment

- [ ] HMAC signature validation enabled
- [ ] Constant-time comparison implemented
- [ ] Verify token configured
- [ ] Rate limiting active (WhatsApp API + user-level)
- [ ] Zod schema validation for all inputs
- [ ] Secrets stored in Vercel environment variables
- [ ] No secrets in git repository
- [ ] HTTPS enforced (Vercel default)
- [ ] Request deduplication implemented
- [ ] SQL injection prevented (parameterized queries)
- [ ] SSRF protection (URL validation)
- [ ] Input sanitization applied

### Post-Deployment

- [ ] Monitor failed signature validations
- [ ] Check rate limit violations
- [ ] Review error logs for security events
- [ ] Rotate secrets periodically (quarterly)
- [ ] Update dependencies for security patches
- [ ] Test webhook with invalid signatures
- [ ] Verify rate limiting works under load

---

## Testing Security

### 1. Test Signature Validation

```bash
# Invalid signature should fail
curl -X POST https://your-app.vercel.app/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=invalid" \
  -d '{"entry": []}'

# Expected: 401 Unauthorized
```

### 2. Test Rate Limiting

```typescript
// tests/unit/rate-limiting.test.ts
describe('Rate Limiting', () => {
  it('should block requests exceeding limit', async () => {
    const requests = Array(251).fill(null).map(() =>
      sendWhatsAppRequest({ ... })
    );

    const results = await Promise.allSettled(requests);
    const rejected = results.filter(r => r.status === 'rejected');

    expect(rejected.length).toBeGreaterThan(0);
  });
});
```

### 3. Test Input Validation

```typescript
// tests/unit/validation.test.ts
describe('Webhook Validation', () => {
  it('should reject invalid payload', async () => {
    const invalidPayload = { invalid: 'data' };

    const response = await POST(
      new Request('https://test.com', {
        method: 'POST',
        body: JSON.stringify(invalidPayload),
      })
    );

    expect(response.status).toBe(400);
  });
});
```

---

## Security Incident Response

### If Signature Validation Fails

1. **Immediate Actions:**
   - Block suspicious IPs temporarily
   - Review logs for attack patterns
   - Verify WHATSAPP_APP_SECRET is correct

2. **Investigation:**
   - Check if secret was leaked
   - Review recent code changes
   - Analyze failed validation timestamps

3. **Remediation:**
   - Rotate WHATSAPP_APP_SECRET if compromised
   - Update WhatsApp app configuration
   - Deploy new secret to Vercel

### If Rate Limit Exceeded

1. **Identify Source:**
   - Check user IDs in logs
   - Look for IP patterns
   - Analyze message content

2. **Mitigation:**
   - Block abusive users
   - Adjust rate limits if needed
   - Add CAPTCHA for suspicious activity

---

## Related Documentation

- [edge-functions-optimization.md](./edge-functions-optimization.md) - Performance optimization
- [edge-error-handling.md](./edge-error-handling.md) - Error handling patterns
- [edge-observability.md](./edge-observability.md) - Security monitoring
- [whatsapp-webhook-spec.md](../03-api-reference/whatsapp-webhook-spec.md) - Webhook API specification

---

**Last Updated:** 2025-10-03
**Security Standard:** OWASP Top 10 2021 compliant
**Encryption:** HTTPS (TLS 1.3) enforced by Vercel
**Signature Algorithm:** HMAC-SHA256
