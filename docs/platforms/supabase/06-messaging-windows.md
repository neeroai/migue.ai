# Messaging Windows

WhatsApp 24-hour free messaging window management system.

## Overview

**WhatsApp Business API rules:**
- Window opens when **user** sends message or makes call
- Lasts **24 hours** from user action
- All messages within window: **FREE** (unlimited)
- Free entry point: **72 hours** free after first contact
- Outside window: template messages only (**$0.0667 each**)

**migue.ai automation:**
- Tracks window status per user
- Enforces proactive limits (4/day, 4h interval)
- Respects business hours (7am-8pm Bogotá)
- Sends maintenance messages before expiration

**Cost savings**: 90%+ conversations free (vs paid templates)

## messaging_windows Table

### Schema

```sql
CREATE TABLE messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  window_opened_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  last_user_message_id TEXT,
  proactive_messages_sent_today INT NOT NULL DEFAULT 0,
  last_proactive_sent_at TIMESTAMPTZ,
  free_entry_point_expires_at TIMESTAMPTZ,  -- 72h for new users
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `window_opened_at` | TIMESTAMPTZ | When user last sent message |
| `window_expires_at` | TIMESTAMPTZ | 24h after window_opened_at |
| `free_entry_point_expires_at` | TIMESTAMPTZ | 72h free for new users |
| `proactive_messages_sent_today` | INT | Counter (resets at midnight) |
| `last_proactive_sent_at` | TIMESTAMPTZ | Last proactive message time |

### Constraints

```sql
CONSTRAINT chk_window_expiration CHECK (window_expires_at > window_opened_at),
CONSTRAINT chk_proactive_count CHECK (proactive_messages_sent_today >= 0)
```

## TypeScript Implementation

### lib/messaging-windows.ts

**Core constants:**
```typescript
export const COLOMBIA_TZ = 'America/Bogota'
export const BUSINESS_HOURS = { start: 7, end: 20 }  // 7am-8pm
export const MAX_PROACTIVE_PER_DAY = 4
export const MIN_INTERVAL_HOURS = 4
export const WINDOW_DURATION_HOURS = 24
export const FREE_ENTRY_DURATION_HOURS = 72
export const WINDOW_MAINTENANCE_THRESHOLD_HOURS = 4
```

### Update Window on Message

```typescript
// lib/messaging-windows.ts (lines 59-122)
export async function updateMessagingWindow(
  phoneNumber: string,
  messageId: string,
  isUserMessage: boolean
): Promise<void> {
  const supabase = getSupabaseServerClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone_number', phoneNumber)
    .single()

  if (!user) return

  const now = new Date()
  const windowExpiration = new Date(now.getTime() + WINDOW_DURATION_HOURS * 60 * 60 * 1000)

  if (isUserMessage) {
    // User message: reset 24h window
    await supabase.from('messaging_windows').upsert({
      user_id: user.id,
      phone_number: phoneNumber,
      window_opened_at: now.toISOString(),
      window_expires_at: windowExpiration.toISOString(),
      last_user_message_id: messageId,
      updated_at: now.toISOString(),
    }, { onConflict: 'phone_number' })
  }
}
```

### Get Window Status

```typescript
// lib/messaging-windows.ts (lines 127-172)
export async function getMessagingWindow(phoneNumber: string): Promise<MessagingWindow> {
  const supabase = getSupabaseServerClient()

  const { data } = await supabase.from('messaging_windows')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (!data) {
    return {
      isOpen: false,
      isFreeEntry: false,
      expiresAt: null,
      hoursRemaining: 0,
      canSendProactive: false,
      messagesRemainingToday: 0,
      lastProactiveSentAt: null,
    }
  }

  const now = new Date()
  const expiresAt = new Date(data.window_expires_at)
  const freeEntryExpiresAt = data.free_entry_point_expires_at
    ? new Date(data.free_entry_point_expires_at)
    : null

  const isOpen = expiresAt > now
  const isFreeEntry = freeEntryExpiresAt ? freeEntryExpiresAt > now : false
  const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))

  return {
    isOpen,
    isFreeEntry,
    expiresAt,
    hoursRemaining,
    canSendProactive: isOpen,
    messagesRemainingToday: MAX_PROACTIVE_PER_DAY - data.proactive_messages_sent_today,
    lastProactiveSentAt: data.last_proactive_sent_at ? new Date(data.last_proactive_sent_at) : null,
  }
}
```

## Proactive Message Rules

### Decision Logic

```typescript
// lib/messaging-windows.ts (lines 225-293)
export async function shouldSendProactiveMessage(
  userId: string,
  phoneNumber: string,
  conversationId?: string
): Promise<ProactiveMessageDecision> {
  // 1. Check business hours (7am-8pm Bogotá)
  const withinHours = await isWithinBusinessHours()
  if (!withinHours) {
    return { allowed: false, reason: 'Outside business hours (7am-8pm Bogotá)' }
  }

  // 2. Check messaging window
  const window = await getMessagingWindow(phoneNumber)
  if (!window.isOpen && !window.isFreeEntry) {
    return { allowed: false, reason: 'Messaging window closed and free entry expired' }
  }

  // 3. Check daily limit (4 messages/day)
  if (window.messagesRemainingToday <= 0) {
    return {
      allowed: false,
      reason: `Daily limit reached (${MAX_PROACTIVE_PER_DAY} messages/day)`,
    }
  }

  // 4. Check rate limiting (4h minimum interval)
  if (window.lastProactiveSentAt) {
    const hoursSinceLastProactive =
      (Date.now() - window.lastProactiveSentAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastProactive < MIN_INTERVAL_HOURS) {
      return {
        allowed: false,
        reason: `Rate limit: min ${MIN_INTERVAL_HOURS}h between messages`,
      }
    }
  }

  // 5. Check if user is currently active (< 30 min)
  if (conversationId) {
    const isActive = await isUserActiveRecently(userId, conversationId)
    if (isActive) {
      return {
        allowed: false,
        reason: 'User is currently active (< 30 min since last message)',
      }
    }
  }

  return { allowed: true }
}
```

### Increment Counter

```typescript
// lib/messaging-windows.ts (lines 298-327)
export async function incrementProactiveCounter(phoneNumber: string): Promise<void> {
  const supabase = getSupabaseServerClient()

  const { data: current } = await supabase.from('messaging_windows')
    .select('proactive_messages_sent_today')
    .eq('phone_number', phoneNumber)
    .single()

  if (!current) return

  await supabase.from('messaging_windows')
    .update({
      proactive_messages_sent_today: current.proactive_messages_sent_today + 1,
      last_proactive_sent_at: new Date().toISOString(),
    })
    .eq('phone_number', phoneNumber)
}
```

## Database Functions

### reset_daily_proactive_count()

**Auto-resets counter at midnight** (Colombia timezone):

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 60-70)
CREATE OR REPLACE FUNCTION reset_daily_proactive_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_proactive_sent_at IS NOT NULL AND
     DATE(NEW.last_proactive_sent_at AT TIME ZONE 'America/Bogota') <
     DATE(NOW() AT TIME ZONE 'America/Bogota') THEN
    NEW.proactive_messages_sent_today = 0;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

### find_windows_near_expiration()

**Find windows expiring within N hours:**

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 77-102)
CREATE OR REPLACE FUNCTION find_windows_near_expiration(
  hours_threshold INT DEFAULT 4
)
RETURNS TABLE (
  user_id UUID,
  phone_number TEXT,
  window_expires_at TIMESTAMPTZ,
  hours_remaining NUMERIC,
  proactive_messages_sent_today INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT mw.user_id, mw.phone_number, mw.window_expires_at,
    EXTRACT(EPOCH FROM (mw.window_expires_at - NOW())) / 3600 AS hours_remaining,
    mw.proactive_messages_sent_today
  FROM messaging_windows mw
  WHERE mw.window_expires_at > NOW()
    AND mw.window_expires_at <= NOW() + (hours_threshold || ' hours')::INTERVAL
  ORDER BY mw.window_expires_at ASC;
END $$ LANGUAGE plpgsql;
```

## Cron Job Integration

### app/api/cron/maintain-windows/route.ts

**Runs 4 times/day** (7am, 10am, 1pm, 4pm Bogotá = 12pm, 3pm, 6pm, 9pm UTC):

```typescript
export async function GET(req: Request): Promise<Response> {
  // 1. Find windows expiring in next 4 hours
  const windows = await findWindowsNearExpiration(4)

  // 2. Check proactive rules for each
  for (const window of windows) {
    const decision = await shouldSendProactiveMessage(
      window.user_id,
      window.phone_number
    )

    if (!decision.allowed) continue

    // 3. Generate personalized message with ProactiveAgent
    const message = await generateMaintenanceMessage(window.user_id)

    // 4. Send message
    await sendWhatsAppMessage(window.phone_number, message)

    // 5. Increment counter
    await incrementProactiveCounter(window.phone_number)
  }

  return new Response(JSON.stringify({ processed: windows.length }))
}
```

**vercel.json cron schedule:**
```json
{
  "crons": [
    {
      "path": "/api/cron/maintain-windows",
      "schedule": "0 12,15,18,21 * * *"
    }
  ]
}
```

## Cost Analysis

### Scenario: Active User (30 msg/day)

**With window management:**
- User sends 30 messages/day → Opens window daily
- Bot sends 30 replies/day → All FREE (within 24h window)
- Monthly cost: **$0**

**Without window management:**
- User messages expire after 24h
- Bot would need template messages → 30 × $0.0667 = $2/day
- Monthly cost: **$60**

**Savings**: 100%

### Scenario: Inactive User (proactive reminders)

**With intelligent limits:**
- Max 4 proactive/day → $0 (within free tier)
- Cron jobs respect business hours → No night spam

**Without limits:**
- Unlimited proactive → Window closes
- Need paid templates → $0.0667/message

## Analytics View

### messaging_windows_stats

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 139-149)
CREATE VIEW messaging_windows_stats AS
SELECT
  COUNT(*) AS total_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW()) AS active_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW() AND
                        window_expires_at <= NOW() + INTERVAL '4 hours') AS windows_near_expiration,
  COUNT(*) FILTER (WHERE free_entry_point_expires_at > NOW()) AS free_entry_active,
  SUM(proactive_messages_sent_today) AS total_proactive_today
FROM messaging_windows;
```

**Query**:
```sql
SELECT * FROM messaging_windows_stats;
```

**Returns**:
```json
{
  "total_windows": 150,
  "active_windows": 80,
  "windows_near_expiration": 5,
  "free_entry_active": 12,
  "total_proactive_today": 45
}
```

## Next Steps

- **[AI Cost Tracking](./07-ai-cost-tracking.md)** - Monitor proactive message costs
- **[Custom Functions](./05-custom-functions-triggers.md)** - Window management functions

## Resources

- **WhatsApp**: [Messaging Windows Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- **Project**: [lib/messaging-windows.ts](../../../lib/messaging-windows.ts)

**Last Updated**: 2025-10-11
