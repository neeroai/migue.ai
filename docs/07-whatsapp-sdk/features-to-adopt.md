# Features to Adopt from WhatsApp SDK

Prioritized roadmap for implementing SDK-inspired features in migue.ai using Edge Runtime-compatible code.

---

## Priority Matrix

| Priority | Feature | Effort | Impact | Status |
|----------|---------|--------|--------|--------|
| **P0** | Emoji Reactions | Low (2-4 hours) | High | 📋 Ready |
| **P0** | Enhanced Typing Indicators | Low (1-2 hours) | High | 📋 Ready |
| **P0** | Read Receipt Marking | Low (1 hour) | Medium | 📋 Ready |
| **P1** | Webhook Processor Pattern | Medium (4-6 hours) | High | 📋 Ready |
| **P1** | Message Status Tracking | Medium (3-5 hours) | Medium | 📋 Ready |
| **P2** | Interactive Buttons | Medium (5-8 hours) | High | 📋 Ready |
| **P2** | Broadcast Messaging | Medium (4-6 hours) | Medium | 📋 Ready |
| **P3** | Interactive Lists | High (8-12 hours) | Medium | 🔮 Future |
| **P3** | Template Messages | Medium (4-6 hours) | Low | 🔮 Future |
| **P4** | Media Upload Helpers | Low (2-3 hours) | Low | 🔮 Future |

---

## Phase 1: Quick Wins (1-2 days)
High-impact features with minimal implementation effort.

### 1. Emoji Reactions

**Status**: 📋 Ready to implement
**Effort**: 2-4 hours
**Impact**: High (better UX, instant feedback)
**Dependencies**: None

#### Why This Matters
- ✅ Instant acknowledgment while processing longer requests
- ✅ User engagement feedback
- ✅ Non-intrusive communication
- ✅ Reduces "did my message send?" anxiety

#### Implementation

**File**: `lib/whatsapp.ts`

Add the following functions:

```typescript
// 1. Core reaction function
export async function sendReaction(
  to: string,
  messageId: string,
  emoji: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'Missing credentials' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'reaction',
          reaction: {
            message_id: messageId,
            emoji: emoji || '' // Empty string removes reaction
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Failed to send reaction'
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 2. Remove reaction
export const removeReaction = (to: string, messageId: string) =>
  sendReaction(to, messageId, '');

// 3. Convenience methods (most useful reactions for AI assistant)
export const reactWithCheck = (to: string, messageId: string) =>
  sendReaction(to, messageId, '✅');

export const reactWithThinking = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🤔');

export const reactWithLike = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👍');

export const reactWithLove = (to: string, messageId: string) =>
  sendReaction(to, messageId, '❤️');

export const reactWithFire = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🔥');

export const reactWithSad = (to: string, messageId: string) =>
  sendReaction(to, messageId, '😢');

export const reactWithWarning = (to: string, messageId: string) =>
  sendReaction(to, messageId, '⚠️');
```

#### Usage Examples

```typescript
// In webhook handler - quick acknowledgment
import { reactWithCheck, reactWithThinking } from '@/lib/whatsapp';

// User asks question
await reactWithThinking(phoneNumber, messageId);

// AI generates response (takes 3 seconds)
const response = await generateResponse(message);

// Send response + success reaction
await sendText(phoneNumber, response);
await reactWithCheck(phoneNumber, messageId);
```

```typescript
// Error handling with reactions
try {
  const result = await processRequest(message);
  await reactWithCheck(phoneNumber, messageId);
} catch (error) {
  await reactWithWarning(phoneNumber, messageId);
  await sendText(phoneNumber, 'Sorry, something went wrong. Please try again.');
}
```

#### Testing

**File**: `tests/unit/whatsapp-reactions.test.ts`

```typescript
import { sendReaction, reactWithCheck, removeReaction } from '@/lib/whatsapp';

describe('WhatsApp Reactions', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  });

  it('should send emoji reaction', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_123' }] })
    });

    const result = await sendReaction('1234567890', 'wamid.ABC', '🔥');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_123');
  });

  it('should remove reaction with empty emoji', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_123' }] })
    });

    const result = await removeReaction('1234567890', 'wamid.ABC');

    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('"emoji":""')
      })
    );
  });

  it('should handle API errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid message ID' } })
    });

    const result = await reactWithCheck('1234567890', 'invalid');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid message ID');
  });
});
```

#### Rollout Plan

1. ✅ Add functions to `lib/whatsapp.ts`
2. ✅ Write unit tests
3. ✅ Test in webhook handler with real WhatsApp messages
4. ✅ Monitor error rates for 24 hours
5. ✅ Roll out to all users

---

### 2. Enhanced Typing Indicators

**Status**: 📋 Ready to enhance (current implementation exists)
**Effort**: 1-2 hours
**Impact**: High (better UX)
**Dependencies**: None

#### Why This Matters
- ✅ Shows AI is processing (reduces user impatience)
- ✅ Better perceived response time
- ✅ Professional user experience

#### Current State

You already have `createTypingManager` in `lib/whatsapp.ts:66-95`. Enhance it with:

```typescript
export interface TypingManager {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  startWithDuration: (durationSeconds: number) => Promise<void>; // NEW
  isActive: () => boolean;
}

export function createTypingManager(phoneNumber: string): TypingManager {
  // ... existing code ...

  return {
    // ... existing methods ...

    // NEW: Auto-stop after duration
    startWithDuration: async (durationSeconds: number) => {
      const duration = Math.min(durationSeconds, 25); // WhatsApp max

      await setTypingState('typing');

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        await setTypingState('stop');
        timeoutId = null;
      }, duration * 1000);
    },
  };
}
```

#### Usage

```typescript
const typing = createTypingManager(phoneNumber);

// OLD: Manual control
await typing.start();
const response = await generateResponse(message);
await typing.stop();

// NEW: Automatic timeout
await typing.startWithDuration(5); // Shows for 5s then auto-stops
const response = await generateResponse(message);
// No need to call stop()
```

#### Testing

Already covered by existing tests - add:

```typescript
it('should auto-stop typing after duration', async () => {
  const typing = createTypingManager('1234567890');

  await typing.startWithDuration(1);

  expect(typing.isActive()).toBe(true);

  // Wait for auto-stop
  await new Promise(resolve => setTimeout(resolve, 1100));

  expect(typing.isActive()).toBe(false);
});
```

---

### 3. Read Receipt Marking

**Status**: 📋 Ready to implement
**Effort**: 1 hour
**Impact**: Medium (shows message received)
**Dependencies**: None

#### Implementation

**File**: `lib/whatsapp.ts`

```typescript
export async function markMessageAsRead(
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return { success: false, error: 'Missing credentials' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        })
      }
    );

    return { success: response.ok };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

#### Usage

```typescript
// In webhook handler - mark as read immediately
export async function POST(req: Request) {
  const body = await req.json();

  const messageId = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id;

  if (messageId) {
    await markMessageAsRead(messageId);
  }

  // ... process message ...
}
```

---

## Phase 2: Enhanced Architecture (3-5 days)

### 4. Webhook Processor Pattern

**Status**: 📋 Ready to implement
**Effort**: 4-6 hours
**Impact**: High (cleaner code, better maintainability)
**Dependencies**: None

#### Current State

Your webhook handler in `app/api/whatsapp/webhook/route.ts` manually parses and routes messages.

#### Improvement

Create a type-safe webhook processor (see [edge-compatibility-wrapper.md](./edge-compatibility-wrapper.md#webhook-processor) for full implementation).

**Benefits**:
- ✅ Type-safe message handling
- ✅ Easier to add new message types
- ✅ Centralized error handling
- ✅ Cleaner webhook route code

**File Structure**:
```
lib/
  whatsapp-webhook.ts    # Webhook processor
  whatsapp-handlers.ts   # Message type handlers
```

**Implementation**:
```typescript
// lib/whatsapp-webhook.ts
export function createWebhookProcessor(handlers: WebhookHandlers) {
  return async (body: unknown) => {
    // Type-safe message routing
    // See edge-compatibility-wrapper.md for full code
  };
}

// app/api/whatsapp/webhook/route.ts
const processor = createWebhookProcessor({
  onTextMessage: handleTextMessage,
  onReactionMessage: handleReaction,
  onError: handleError
});

export async function POST(req: Request) {
  await processor(await req.json());
  return new Response('OK', { status: 200 });
}
```

#### Testing

```typescript
describe('Webhook Processor', () => {
  it('should route text messages to handler', async () => {
    const onTextMessage = jest.fn();
    const processor = createWebhookProcessor({ onTextMessage });

    await processor(mockTextWebhook);

    expect(onTextMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'text',
        from: '1234567890'
      })
    );
  });
});
```

---

### 5. Message Status Tracking

**Status**: 📋 Ready to implement
**Effort**: 3-5 hours
**Impact**: Medium (delivery confirmation, debugging)
**Dependencies**: Database schema update

#### Why This Matters
- ✅ Track message delivery (sent → delivered → read → failed)
- ✅ Debug user issues ("I didn't get the message")
- ✅ Analytics on message engagement

#### Database Schema

**File**: `supabase/schema.sql`

```sql
-- Add columns to whatsapp_messages table
ALTER TABLE whatsapp_messages
ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_code INTEGER,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Index for status lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status
ON whatsapp_messages(status, created_at DESC);

-- Index for message ID lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wa_id
ON whatsapp_messages(whatsapp_message_id);
```

#### Implementation

**File**: `lib/message-status.ts` (NEW)

```typescript
import { getSupabaseServerClient } from './supabase';

export async function updateMessageStatus(
  whatsappMessageId: string,
  status: 'sent' | 'delivered' | 'read' | 'failed',
  error?: { code: number; message: string }
) {
  const supabase = getSupabaseServerClient();

  const updates: any = {
    status,
    [`${status}_at`]: new Date().toISOString()
  };

  if (error) {
    updates.error_code = error.code;
    updates.error_message = error.message;
  }

  const { error: dbError } = await supabase
    .from('whatsapp_messages')
    .update(updates)
    .eq('whatsapp_message_id', whatsappMessageId);

  if (dbError) {
    console.error('Failed to update message status:', dbError);
  }
}
```

**Update webhook to track statuses**:

```typescript
// In webhook processor
onMessageStatusUpdate: async (status) => {
  await updateMessageStatus(
    status.id,
    status.status,
    status.errors?.[0]
  );
}
```

#### Testing

```typescript
describe('Message Status Tracking', () => {
  it('should update message status to delivered', async () => {
    const supabase = getSupabaseServerClient();

    await updateMessageStatus('wamid.ABC123', 'delivered');

    const { data } = await supabase
      .from('whatsapp_messages')
      .select('status, delivered_at')
      .eq('whatsapp_message_id', 'wamid.ABC123')
      .single();

    expect(data?.status).toBe('delivered');
    expect(data?.delivered_at).toBeTruthy();
  });
});
```

---

## Phase 3: Advanced Features (1-2 weeks)

### 6. Interactive Buttons

**Status**: 📋 Ready to implement
**Effort**: 5-8 hours
**Impact**: High (better UX, guided interactions)
**Dependencies**: Webhook processor (Phase 2)

#### Why This Matters
- ✅ Guided user flows (onboarding, settings)
- ✅ Reduce free-text ambiguity
- ✅ Better analytics on user choices

#### Implementation

**File**: `lib/whatsapp-interactive.ts` (NEW)

```typescript
export interface Button {
  id: string;
  title: string; // Max 20 chars
}

export interface ButtonMessageOptions {
  header?: string;
  footer?: string;
  replyToMessageId?: string;
}

export async function sendButtons(
  to: string,
  bodyText: string,
  buttons: Button[],
  options: ButtonMessageOptions = {}
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (buttons.length > 3) {
    return { success: false, error: 'Max 3 buttons allowed' };
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title }
        }))
      }
    }
  };

  if (options.header) {
    payload.interactive.header = {
      type: 'text',
      text: options.header
    };
  }

  if (options.footer) {
    payload.interactive.footer = { text: options.footer };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

#### Usage

```typescript
import { sendButtons } from '@/lib/whatsapp-interactive';

// Onboarding flow
await sendButtons(
  phoneNumber,
  'Welcome to migue.ai! How can I help you today?',
  [
    { id: 'btn_started', title: 'Get Started' },
    { id: 'btn_features', title: 'Learn Features' },
    { id: 'btn_help', title: 'Get Help' }
  ],
  {
    header: 'Welcome! 👋',
    footer: 'Powered by migue.ai'
  }
);

// In webhook - handle button click
onButtonClick: async (message) => {
  const buttonId = message.interactive.button_reply.id;

  switch (buttonId) {
    case 'btn_started':
      await sendText(message.from, 'Great! Let\'s get started...');
      break;
    case 'btn_features':
      await sendText(message.from, 'Here are my features...');
      break;
    case 'btn_help':
      await sendText(message.from, 'I\'m here to help!...');
      break;
  }
}
```

---

### 7. Broadcast Messaging

**Status**: 📋 Ready to implement
**Effort**: 4-6 hours
**Impact**: Medium (announcements, updates)
**Dependencies**: None

See [edge-compatibility-wrapper.md](./edge-compatibility-wrapper.md#broadcast-messaging) for full implementation.

**Use Cases**:
- Daily reminders to all users
- Feature announcements
- System maintenance notifications

**Implementation**: `lib/broadcast.ts`

---

## Phase 4: Future Enhancements (As Needed)

### 8. Interactive Lists

**Effort**: 8-12 hours
**Use Case**: Service selection, menu navigation

Not critical for current MVP. Implement when you have > 3 options to present.

### 9. Template Messages

**Effort**: 4-6 hours
**Use Case**: Pre-approved marketing messages

Requires WhatsApp Business approval. Defer until you have approved templates.

### 10. Media Upload Helpers

**Effort**: 2-3 hours
**Use Case**: Sending images/docs from server

Current URL-based media sending works fine. Only needed if you generate images/docs server-side.

---

## Implementation Roadmap

### Week 1: Quick Wins
- **Day 1-2**: Reactions + Enhanced Typing + Read Receipts
- **Day 3**: Testing and monitoring
- **Day 4-5**: Webhook Processor refactor

### Week 2: Advanced Features
- **Day 1-2**: Message Status Tracking (DB + implementation)
- **Day 3-4**: Interactive Buttons
- **Day 5**: Broadcast Messaging

### Week 3+: Polish & Future
- Testing and bug fixes
- Performance monitoring
- Future features as needed

---

## Success Metrics

Track these after each phase:

1. **Reactions**:
   - % of messages that get reactions
   - Time to first reaction (should be < 500ms)
   - Error rate (target: < 1%)

2. **Typing Indicators**:
   - User satisfaction (survey/feedback)
   - % reduction in "did you get my message?" follow-ups

3. **Webhook Processor**:
   - Code complexity (should decrease)
   - Time to add new message type (should decrease)
   - Webhook errors (should decrease)

4. **Message Status**:
   - Delivery success rate (target: > 99%)
   - Time to delivery (p50, p95, p99)
   - Failed message debugging time (should decrease)

5. **Interactive Buttons**:
   - % users who click buttons vs type text
   - Completion rate for button flows
   - Error rate in button handling

---

## Next Steps

**Start with Phase 1 (1-2 days)**:
1. Implement reactions in `lib/whatsapp.ts`
2. Enhance typing indicators with auto-duration
3. Add read receipt marking
4. Write tests for all three
5. Deploy and monitor for 48 hours

**Then proceed to Phase 2** once Phase 1 is stable.

---

## References

- [API Reference](./api-reference.md) - Detailed SDK method signatures
- [Edge Compatibility Guide](./edge-compatibility-wrapper.md) - Implementation patterns
- [Comparison Analysis](./comparison.md) - Feature comparisons

---

**Remember**: Each feature should be:
- ✅ Edge Runtime compatible
- ✅ Thoroughly tested (≥80% coverage)
- ✅ Monitored in production
- ✅ Documented in this guide

Start small, test thoroughly, iterate quickly.
