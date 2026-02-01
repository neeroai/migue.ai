---
title: Security & WhatsApp Compliance
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: WhatsApp policy compliance, HMAC validation, RLS, PII handling
---

# Security & WhatsApp Compliance

## Quick Reference
- **Purpose**: Security implementation and WhatsApp Business Policy compliance
- **References**: docs/patterns/error-handling-fallbacks.md, WhatsApp Business Policy
- **Critical**: HMAC validation, RLS policies, 24h messaging window, PII protection

---

## WhatsApp Business Policy Compliance

### Allowed Use Cases

| Category | Allowed | Examples | Restrictions |
|----------|---------|----------|--------------|
| Transactional | ✅ Yes | Appointment confirmations, reminders, receipts | Must be user-initiated |
| Customer support | ✅ Yes | Answer questions, provide assistance | Within 24h window |
| Account updates | ✅ Yes | Status changes, notifications | Relevant to user account |
| Proactive reminders | ✅ Yes | Calendar reminders, scheduled alerts | User must opt-in explicitly |
| Marketing | ⚠️ Limited | Promotional content requires opt-in | Must use approved templates outside 24h window |
| Sensitive info | ❌ No | Financial transactions, medical records | Use secure channels instead |

**Critical rules**:
1. **24-hour messaging window**: Can only send freeform messages within 24h of user's last message
2. **Outside window**: Must use pre-approved message templates only
3. **No spam**: Automated messages must be relevant and user-initiated
4. **Opt-in required**: Users must explicitly consent to reminders/notifications
5. **Data privacy**: No sharing user data with third parties

**Source**: WhatsApp Business Policy (https://developers.facebook.com/docs/whatsapp/overview/policy-enforcement/)

---

## 24-Hour Messaging Window

### Window Management

**File**: lib/whatsapp/messaging-window.ts

```typescript
interface MessagingWindow {
  userId: string;
  isOpen: boolean;
  expiresAt: Date | null;
  lastUserMessageId: string | null;
}

export async function checkMessagingWindow(userId: string): Promise<MessagingWindow> {
  const { data } = await supabase
    .from('messaging_windows')
    .select('*')
    .eq('user_id', userId)
    .eq('is_open', true)
    .single();

  if (!data) {
    return {
      userId,
      isOpen: false,
      expiresAt: null,
      lastUserMessageId: null,
    };
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(data.expires_at);

  if (now > expiresAt) {
    // Mark as closed
    await supabase
      .from('messaging_windows')
      .update({ is_open: false })
      .eq('id', data.id);

    return {
      userId,
      isOpen: false,
      expiresAt: null,
      lastUserMessageId: null,
    };
  }

  return {
    userId,
    isOpen: true,
    expiresAt,
    lastUserMessageId: data.last_user_message_id,
  };
}

export async function openMessagingWindow(userId: string, messageId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  // Close any existing open windows
  await supabase
    .from('messaging_windows')
    .update({ is_open: false })
    .eq('user_id', userId)
    .eq('is_open', true);

  // Create new window
  await supabase.from('messaging_windows').insert({
    user_id: userId,
    opened_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    is_open: true,
    last_user_message_id: messageId,
  });
}

export async function canSendFreeformMessage(userId: string): Promise<boolean> {
  const window = await checkMessagingWindow(userId);
  return window.isOpen;
}
```

### Sending Messages Based on Window

```typescript
export async function sendMessage(userId: string, content: string) {
  const canSendFreeform = await canSendFreeformMessage(userId);

  if (canSendFreeform) {
    // Send regular text message
    await sendWhatsAppMessage({
      to: userId,
      type: 'text',
      text: { body: content },
    });
  } else {
    // Must use template message
    console.warn(`Messaging window closed for user ${userId}, using template`);
    await sendReminderTemplate(userId, content);
  }
}
```

---

## HMAC Signature Validation

### Implementation

**File**: lib/whatsapp/validation.ts

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function validateSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // WhatsApp sends signature as: sha256=<hex_digest>
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const expectedSignature = `sha256=${createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  // Timing-safe comparison to prevent timing attacks
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Usage in webhook
export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!signature) {
    return Response.json({ error: 'Missing signature' }, { status: 401 });
  }

  const isValid = validateSignature(
    body,
    signature,
    process.env.WHATSAPP_WEBHOOK_SECRET!
  );

  if (!isValid) {
    console.error('Invalid webhook signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook
  const payload = JSON.parse(body);
  // ...
}
```

**Source**: WhatsApp Security Best Practices (https://developers.facebook.com/docs/whatsapp/webhooks)

---

## Row-Level Security (RLS)

### Policy Definitions

**All user data tables use RLS with service role only access**

```sql
-- Users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON users
  FOR ALL
  USING (auth.role() = 'service_role');

-- Messages table
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON messages
  FOR ALL
  USING (auth.role() = 'service_role');

-- Reminders table
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON reminders
  FOR ALL
  USING (auth.role() = 'service_role');

-- Calendar events table
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON calendar_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Expenses table
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON expenses
  FOR ALL
  USING (auth.role() = 'service_role');

-- User memory table
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON user_memory
  FOR ALL
  USING (auth.role() = 'service_role');
```

**Why service_role only**: migue.ai uses server-side AI agent with no direct client access to database. All queries go through Edge Functions with service role key.

**Key security principles**:
1. **No anon key database access** - Only service role can query
2. **Supabase client in Edge Functions only** - Never expose to frontend
3. **User isolation** - All queries filter by user_id
4. **No direct user input to SQL** - Always use parameterized queries

---

## PII Protection

### Data Classification

| Data Type | Classification | Storage | Encryption | Retention |
|-----------|----------------|---------|------------|-----------|
| Phone number | PII | Database | At rest (Supabase) | 90 days inactive |
| Name | PII | Database | At rest | 90 days inactive |
| Message content | Sensitive | Database | At rest | 90 days |
| Calendar events | Sensitive | Database | At rest | Until deleted |
| Expenses | Sensitive | Database | At rest | Until deleted |
| User preferences | Non-sensitive | Database | At rest | Until deleted |
| AI requests | Non-sensitive | Database | At rest | 30 days |

**Colombian privacy laws (Ley 1581 de 2012)**:
- Users must explicitly authorize data collection
- Users can request data deletion (derecho al olvido)
- Data processing must have legitimate purpose
- Data must be protected from unauthorized access

### PII Handling Rules

```typescript
// 1. Never log PII
export function sanitizeLog(data: any): any {
  const piiFields = ['phone_number', 'whatsapp_name', 'display_name', 'email'];
  const sanitized = { ...data };

  for (const field of piiFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// 2. Redact phone numbers in error messages
export function redactPhoneNumber(phone: string): string {
  if (phone.length < 10) return '[REDACTED]';
  return `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

// 3. User data deletion (GDPR/Colombian law compliance)
export async function deleteUserData(userId: string) {
  // Delete all user data (cascading)
  await supabase.from('users').delete().eq('id', userId);

  // Log deletion for audit
  console.log(`User data deleted: ${redactPhoneNumber(userId)}`);
}

// 4. Data retention enforcement
export async function enforceDataRetention() {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Delete old messages
  await supabase
    .from('messages')
    .delete()
    .lt('created_at', ninetyDaysAgo.toISOString());

  // Delete old AI requests (30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  await supabase
    .from('ai_requests')
    .delete()
    .lt('created_at', thirtyDaysAgo.toISOString());
}
```

---

## Environment Variable Security

### Secret Management

```bash
# .env (NEVER commit to git)
# Use Vercel environment variables for production

# Public keys (safe to expose)
NEXT_PUBLIC_APP_URL=https://migue-ai.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG... # Anon key is public

# Secret keys (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... # CRITICAL: Server-side only
OPENAI_API_KEY=sk-proj-...
CLAUDE_API_KEY=sk-ant-...
WHATSAPP_ACCESS_TOKEN=EAAxxxxx
WHATSAPP_WEBHOOK_SECRET=your_webhook_secret_here
CRON_SECRET=your_cron_secret_here
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-xxx
```

### Validation

```typescript
// Validate env vars on startup
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
});

// This will throw if any required env var is missing
export const env = envSchema.parse(process.env);
```

---

## Cron Secret Protection

**Cron endpoints require Authorization header**

```typescript
// app/api/cron/check-reminders/route.ts
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Process reminders
  // ...
}
```

**Vercel cron configuration**:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "* * * * *",
      "headers": {
        "Authorization": "Bearer ${CRON_SECRET}"
      }
    }
  ]
}
```

---

## Security Testing Checklist

- [ ] HMAC signature validation rejects invalid signatures
- [ ] Webhook rejects requests without signature header
- [ ] RLS policies block unauthorized access
- [ ] Service role key never exposed to client
- [ ] PII fields redacted in logs
- [ ] Phone numbers masked in error messages
- [ ] 24h messaging window enforced
- [ ] Template messages used outside window
- [ ] Cron endpoints require valid secret
- [ ] Environment variables validated on startup
- [ ] Data retention policies enforced

---

**Lines**: 200 | **Tokens**: ~480 | **Status**: Ready for implementation
