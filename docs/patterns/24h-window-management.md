---
title: 24-Hour Messaging Window Management
summary: Pattern for tracking and maintaining WhatsApp's 24-hour messaging window to ensure message delivery
description: Technical implementation of WhatsApp's 24h window policy, including proactive maintenance, template messages, and window expiry handling
version: 1.0
date: 2026-01-28
updated: 2026-01-28
scope: architecture
---

# 24-Hour Messaging Window Management

## WhatsApp Policy

**Rule**: Businesses can send messages to users for 24 hours after the user's last message

**After 24h**: Can only send pre-approved template messages

**Purpose**: Prevent spam, ensure conversations are user-initiated

## Problem Statement

**Without Window Management**:
- Reminders fail to send if window expired
- Users miss critical notifications
- Poor user experience (silent failures)
- No visibility into why messages aren't delivered

**With Window Management**:
- Track window state per user
- Proactively maintain windows for active users
- Send templates to re-open when needed
- Clear visibility and monitoring

## Data Model

### Schema

```sql
ALTER TABLE users ADD COLUMN window_opened_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN window_expires_at TIMESTAMPTZ;

CREATE INDEX idx_users_window_expiry ON users(window_expires_at);

-- Query for expiring windows (used by cron)
CREATE INDEX idx_users_expiring_windows
  ON users(window_expires_at)
  WHERE window_expires_at IS NOT NULL
    AND window_expires_at > NOW();
```

### Window States

| State | Condition | Actions Allowed |
|-------|-----------|-----------------|
| **Open** | `window_expires_at > NOW()` | Send any message |
| **Expiring Soon** | `window_expires_at < NOW() + 2h` | Send proactive template |
| **Expired** | `window_expires_at < NOW()` | Only template messages |
| **Never Opened** | `window_opened_at IS NULL` | Only template messages |

## Implementation

### Update Window on User Message

```typescript
// Called in webhook handler after receiving user message
async function updateMessagingWindow(userId: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

  await supabase
    .from('users')
    .update({
      window_opened_at: now.toISOString(),
      window_expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('id', userId);

  console.log(`Window updated for user ${userId}, expires at ${expiresAt}`);
}
```

### Check Window Before Sending

```typescript
async function sendMessage(userId: string, message: string) {
  const user = await getUser(userId);

  // Check if window is open
  const windowOpen = user.window_expires_at &&
    new Date(user.window_expires_at) > new Date();

  if (!windowOpen) {
    console.warn(`Window expired for user ${userId}, cannot send message`);

    // Queue message for when window re-opens
    await queueMessage(userId, message);

    // Try to re-open window with template
    await sendTemplateMessage(user.phone, 'window_reopen', {
      name: user.name || 'Usuario'
    });

    return { success: false, reason: 'window_expired' };
  }

  // Window is open, send normally
  return await sendWhatsAppMessage(user.phone, message);
}
```

## Proactive Window Maintenance

### Cron Job Strategy

**Goal**: Keep windows open for active users to ensure reminders/notifications deliver

**Approach**: Send proactive template 2 hours before window expires

```typescript
// Runs every 30 minutes via Vercel Cron
// app/api/cron/maintain-windows/route.ts

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // Find users with windows expiring in next 2 hours
  const { data: users } = await supabase
    .from('users')
    .select('id, phone, name, window_expires_at')
    .lt('window_expires_at', twoHoursFromNow.toISOString())
    .gt('window_expires_at', new Date().toISOString())
    .is('last_maintenance_sent_at', null) // Don't spam
    .limit(100);

  if (!users || users.length === 0) {
    return Response.json({ maintained: 0 });
  }

  let maintained = 0;

  for (const user of users) {
    try {
      // Send proactive template
      await sendTemplateMessage(user.phone, 'window_reopen', {
        name: user.name || 'Usuario'
      });

      // Mark maintenance sent (prevent spam)
      await supabase
        .from('users')
        .update({ last_maintenance_sent_at: new Date().toISOString() })
        .eq('id', user.id);

      maintained++;
    } catch (error) {
      console.error(`Failed to maintain window for user ${user.id}:`, error);
    }
  }

  return Response.json({ maintained });
}
```

**Vercel Configuration** (vercel.json):

```json
{
  "crons": [{
    "path": "/api/cron/maintain-windows",
    "schedule": "*/30 * * * *"
  }]
}
```

### Template Message for Window Reopening

**Template Name**: `window_reopen`

**Content**:
```
Hola {{1}}! ¿Hay algo en lo que pueda ayudarte hoy?
```

**Variables**:
- `{{1}}`: User's first name

**Approval**: Must be submitted to WhatsApp Manager and approved before use

**Implementation**:

```typescript
async function sendTemplateMessage(
  phone: string,
  templateName: string,
  variables: Record<string, string>
) {
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'es' },
          components: [{
            type: 'body',
            parameters: Object.values(variables).map(value => ({
              type: 'text',
              text: value
            }))
          }]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Template send failed: ${await response.text()}`);
  }

  return await response.json();
}
```

## Message Queue Pattern

**Use Case**: Store messages that couldn't be sent due to expired window

### Queue Schema

```sql
CREATE TABLE message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'button', 'list'
  payload JSONB, -- For interactive messages
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_queue_pending
  ON message_queue(user_id, status, scheduled_for)
  WHERE status = 'pending';
```

### Queue Implementation

```typescript
// Add message to queue when window expired
async function queueMessage(userId: string, message: string) {
  await supabase
    .from('message_queue')
    .insert({
      user_id: userId,
      message_text: message,
      status: 'pending',
      scheduled_for: new Date().toISOString()
    });
}

// Process queued messages (runs every 5 min)
async function processMessageQueue() {
  const { data: queuedMessages } = await supabase
    .from('message_queue')
    .select('*, users!inner(phone, window_expires_at)')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .limit(100);

  for (const msg of queuedMessages) {
    // Check if window is now open
    const windowOpen = new Date(msg.users.window_expires_at) > new Date();

    if (!windowOpen) {
      // Still closed, skip for now
      continue;
    }

    try {
      // Send the queued message
      await sendWhatsAppMessage(msg.users.phone, msg.message_text);

      // Mark as sent
      await supabase
        .from('message_queue')
        .update({ status: 'sent' })
        .eq('id', msg.id);
    } catch (error) {
      // Increment retry count
      await supabase
        .from('message_queue')
        .update({
          retry_count: msg.retry_count + 1,
          status: msg.retry_count >= 2 ? 'failed' : 'pending'
        })
        .eq('id', msg.id);
    }
  }
}
```

## Monitoring & Alerts

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Window maintenance success rate | >90% | <80% |
| Template delivery rate | >95% | <90% |
| Queued messages pending | <100 | >500 |
| Window re-open rate (after template) | >25% | <15% |

### Dashboard Queries

```sql
-- Users with expiring windows (next 2h)
SELECT COUNT(*)
FROM users
WHERE window_expires_at < NOW() + INTERVAL '2 hours'
  AND window_expires_at > NOW();

-- Window re-open success rate (last 24h)
SELECT
  COUNT(CASE WHEN window_opened_at > last_maintenance_sent_at THEN 1 END) * 100.0 /
  COUNT(*) as reopen_rate
FROM users
WHERE last_maintenance_sent_at > NOW() - INTERVAL '24 hours';

-- Messages stuck in queue
SELECT COUNT(*)
FROM message_queue
WHERE status = 'pending'
  AND scheduled_for < NOW() - INTERVAL '1 hour';
```

## Edge Cases

### User Responds During Template Send

**Scenario**: Template sent, user responds before template delivers

**Handling**:
- Template still delivers (WhatsApp doesn't cancel)
- Window is already re-opened by user response
- No negative impact, just extra message

### Multiple Maintenance Cycles

**Problem**: User has multiple pending reminders, each triggers maintenance

**Solution**: Track `last_maintenance_sent_at`, max 1 template per 24h

```typescript
// In maintenance cron
.is('last_maintenance_sent_at', null) // Never sent
.or('last_maintenance_sent_at', 'lt', new Date(Date.now() - 24*60*60*1000)) // >24h ago
```

### User Blocks Bot

**Scenario**: Window expires, template sent, user has blocked bot

**Handling**:
- WhatsApp returns error code
- Mark user as blocked in database
- Stop sending any messages
- Don't count against quality rating

```typescript
async function handleWebhookError(error: WhatsAppError, userId: string) {
  if (error.code === 131047) { // User blocked bot
    await supabase
      .from('users')
      .update({ status: 'blocked', blocked_at: new Date().toISOString() })
      .eq('id', userId);
  }
}
```

## Testing

### Unit Tests

```typescript
describe('Window Management', () => {
  it('updates window on user message', async () => {
    const userId = 'test-user';
    await updateMessagingWindow(userId);

    const user = await getUser(userId);
    expect(user.window_opened_at).toBeDefined();
    expect(user.window_expires_at).toBeGreaterThan(new Date());
  });

  it('prevents sending when window expired', async () => {
    const user = await createUser({
      window_expires_at: new Date(Date.now() - 1000) // 1s ago
    });

    const result = await sendMessage(user.id, 'Test message');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('window_expired');
  });

  it('queues message when window expired', async () => {
    const user = await createUser({
      window_expires_at: new Date(Date.now() - 1000)
    });

    await sendMessage(user.id, 'Queued message');

    const queued = await getQueuedMessages(user.id);
    expect(queued.length).toBe(1);
    expect(queued[0].message_text).toBe('Queued message');
  });
});
```

### Manual Testing

```bash
# Simulate expired window
psql $DATABASE_URL -c "UPDATE users SET window_expires_at = NOW() - INTERVAL '1 hour' WHERE phone = '+573001234567';"

# Try to send message (should queue)
curl -X POST http://localhost:3000/api/test/send-message \
  -d '{"phone": "+573001234567", "message": "Test"}'

# Check queue
psql $DATABASE_URL -c "SELECT * FROM message_queue WHERE status = 'pending';"

# Trigger maintenance cron
curl http://localhost:3000/api/cron/maintain-windows \
  -H "Authorization: Bearer $CRON_SECRET"

# User responds (simulate)
curl -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "x-hub-signature-256: sha256=$SIGNATURE" \
  -d @test-webhook.json

# Check window re-opened
psql $DATABASE_URL -c "SELECT window_expires_at FROM users WHERE phone = '+573001234567';"
```

## Sources

**C1**: Archived migue.ai code - `/Users/mercadeo/neero/migue.ai/.backup/2026-01-28-full-archive/lib/messaging-windows.ts` L20-L95
**C2**: WhatsApp Cloud API Docs - "Messaging Windows" section
**C3**: molbot project - Window tracking implementation in user service

## Related Patterns

- **Fire-and-Forget Webhook** - Updates window on every incoming message
- **Message Queue** - Stores messages when window expired
- **Template Messages** - Used to re-open windows

---

**Status**: Production-proven (archived migue.ai)
**Complexity**: Medium
**Impact**: Critical for reminder delivery
