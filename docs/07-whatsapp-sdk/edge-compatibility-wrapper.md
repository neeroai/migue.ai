# Edge Runtime Compatibility Guide

How to implement WhatsApp SDK features using Edge Runtime-compatible code (Vercel Edge Functions).

**Problem**: The WhatsApp SDK uses `axios` and `form-data`, which are NOT compatible with Vercel Edge Runtime.

**Solution**: Implement SDK-inspired features using native `fetch` API and Edge-compatible patterns.

---

## Table of Contents

- [Why Edge Runtime Matters](#why-edge-runtime-matters)
- [Core Compatibility Patterns](#core-compatibility-patterns)
- [Implementing SDK Features](#implementing-sdk-features)
  - [Reactions](#reactions)
  - [Enhanced Typing Indicators](#enhanced-typing-indicators)
  - [Webhook Processor](#webhook-processor)
  - [Broadcast Messaging](#broadcast-messaging)
- [Type Definitions](#type-definitions)
- [Testing Edge Compatibility](#testing-edge-compatibility)

---

## Why Edge Runtime Matters

### Performance Benefits

```
Traditional Node.js Runtime:
- Cold start: 300-800ms
- Geographic distribution: Limited
- Memory: 128MB - 3GB

Vercel Edge Runtime:
- Cold start: 0-50ms ✅
- Geographic distribution: 250+ locations ✅
- Memory: 128MB (optimized)
```

### For WhatsApp Bot

WhatsApp expects webhook responses **within 20 seconds**, ideally **< 5 seconds**:

- ✅ **Edge Runtime**: < 100ms response time (even with AI processing)
- ❌ **Node.js Runtime**: 300ms+ just for cold start

**Critical**: We MUST maintain Edge Runtime compatibility.

---

## Core Compatibility Patterns

### ❌ NOT Edge Compatible

```typescript
// axios - requires Node.js http module
import axios from 'axios';
const response = await axios.post(url, data);

// form-data - requires Node.js stream and buffer
import FormData from 'form-data';
const form = new FormData();
form.append('file', buffer);

// fs module - not available in Edge
import fs from 'fs';
const file = fs.readFileSync('./file.txt');

// Node.js Buffer - limited support in Edge
const buffer = Buffer.from('data');
```

### ✅ Edge Compatible

```typescript
// Native fetch API
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

// Web FormData API
const form = new FormData();
form.append('file', blob);

// Dynamic imports (for large dependencies)
const { heavy } = await import('./heavy-module');

// ArrayBuffer and Uint8Array
const buffer = new Uint8Array([1, 2, 3]);
```

---

## Implementing SDK Features

### Reactions

#### SDK Implementation (NOT Edge Compatible)

```typescript
// whatsapp-sdk internals (simplified)
async sendReaction(to: string, messageId: string, emoji: string) {
  return await axios.post(`${this.baseUrl}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji }
  }, {
    headers: { 'Authorization': `Bearer ${this.token}` }
  });
}
```

#### ✅ Edge-Compatible Implementation

```typescript
// lib/whatsapp.ts (add these functions)

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
            emoji
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

// Remove reaction
export async function removeReaction(
  to: string,
  messageId: string
): Promise<{ success: boolean; error?: string }> {
  // Send empty emoji to remove reaction
  return sendReaction(to, messageId, '');
}

// Convenience methods
export const reactWithLike = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👍');

export const reactWithLove = (to: string, messageId: string) =>
  sendReaction(to, messageId, '❤️');

export const reactWithFire = (to: string, messageId: string) =>
  sendReaction(to, messageId, '🔥');

export const reactWithClap = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👏');

export const reactWithCheck = (to: string, messageId: string) =>
  sendReaction(to, messageId, '✅');

export const reactWithThumbsDown = (to: string, messageId: string) =>
  sendReaction(to, messageId, '👎');
```

**Usage:**
```typescript
// In webhook handler
import { reactWithCheck, sendText } from '../../lib/whatsapp';

// Quick acknowledgment
await reactWithCheck(phoneNumber, messageId);

// Process request...
const response = await generateResponse(message);

// Send full response
await sendText(phoneNumber, response);
```

---

### Enhanced Typing Indicators

#### Current Implementation (lib/whatsapp.ts:66-95)

Your current `createTypingManager` is already Edge-compatible! We can enhance it with SDK-inspired features:

```typescript
// lib/whatsapp.ts - Enhanced version

export interface TypingManager {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  startWithDuration: (durationSeconds: number) => Promise<void>;
  isActive: () => boolean;
}

export function createTypingManager(phoneNumber: string): TypingManager {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  let isTyping = false;
  let timeoutId: NodeJS.Timeout | null = null;

  const setTypingState = async (state: 'typing' | 'stop'): Promise<void> => {
    if (!phoneNumberId || !accessToken) {
      console.error('Missing WhatsApp credentials for typing indicator');
      return;
    }

    try {
      await fetch(
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
            to: phoneNumber,
            type: state === 'typing' ? 'text' : 'reaction',
            [state === 'typing' ? 'text' : 'reaction']: state === 'typing'
              ? { body: ' ' }
              : { message_id: '', emoji: '' }
          })
        }
      );

      isTyping = state === 'typing';
    } catch (error) {
      console.error('Failed to set typing state:', error);
    }
  };

  return {
    start: async () => {
      if (!isTyping) {
        await setTypingState('typing');
      }
    },

    stop: async () => {
      if (isTyping) {
        await setTypingState('stop');
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      }
    },

    // NEW: Auto-stop after duration (max 25s per WhatsApp limit)
    startWithDuration: async (durationSeconds: number) => {
      const duration = Math.min(durationSeconds, 25); // WhatsApp max

      await setTypingState('typing');

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        await setTypingState('stop');
        timeoutId = null;
      }, duration * 1000);
    },

    isActive: () => isTyping
  };
}

// NEW: Mark message as read
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

**Usage:**
```typescript
const typing = createTypingManager(phoneNumber);

// Show typing for 5 seconds then auto-stop
await typing.startWithDuration(5);

// Or manual control
await typing.start();
const response = await generateAIResponse(message);
await typing.stop();

await sendText(phoneNumber, response);
```

---

### Webhook Processor

#### SDK Pattern (NOT Edge Compatible)

The SDK's webhook processor is excellent but relies on internal state and class instances.

#### ✅ Edge-Compatible Pattern

```typescript
// lib/webhook-processor.ts - NEW FILE

export interface WebhookHandlers {
  onTextMessage?: (message: TextMessage) => Promise<void>;
  onImageMessage?: (message: ImageMessage) => Promise<void>;
  onAudioMessage?: (message: AudioMessage) => Promise<void>;
  onReactionMessage?: (message: ReactionMessage) => Promise<void>;
  onButtonClick?: (message: ButtonMessage) => Promise<void>;
  onError?: (error: Error, rawMessage?: unknown) => Promise<void>;
}

export interface TextMessage {
  from: string;
  id: string;
  timestamp: string;
  text: { body: string };
  type: 'text';
}

export interface ImageMessage {
  from: string;
  id: string;
  timestamp: string;
  image: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  type: 'image';
}

export interface ReactionMessage {
  from: string;
  id: string;
  timestamp: string;
  reaction: {
    message_id: string;
    emoji: string; // Empty string = removed
  };
  type: 'reaction';
}

export interface ButtonMessage {
  from: string;
  id: string;
  timestamp: string;
  interactive: {
    type: 'button_reply';
    button_reply: {
      id: string;
      title: string;
    };
  };
  type: 'interactive';
}

export function createWebhookProcessor(handlers: WebhookHandlers) {
  return async (webhookBody: unknown): Promise<{ success: boolean }> => {
    try {
      // Validate webhook structure
      if (!isValidWebhook(webhookBody)) {
        return { success: false };
      }

      const body = webhookBody as WebhookBody;

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;

          // Process messages
          for (const message of value.messages || []) {
            try {
              await routeMessage(message, handlers);
            } catch (error) {
              if (handlers.onError) {
                await handlers.onError(
                  error instanceof Error ? error : new Error('Unknown error'),
                  message
                );
              }
            }
          }

          // Process statuses
          for (const status of value.statuses || []) {
            // Handle message status updates
            console.log(`Message ${status.id} status: ${status.status}`);
          }
        }
      }

      return { success: true };
    } catch (error) {
      if (handlers.onError) {
        await handlers.onError(
          error instanceof Error ? error : new Error('Unknown error')
        );
      }
      return { success: false };
    }
  };
}

async function routeMessage(
  message: any,
  handlers: WebhookHandlers
): Promise<void> {
  switch (message.type) {
    case 'text':
      if (handlers.onTextMessage) {
        await handlers.onTextMessage(message as TextMessage);
      }
      break;

    case 'image':
      if (handlers.onImageMessage) {
        await handlers.onImageMessage(message as ImageMessage);
      }
      break;

    case 'audio':
      if (handlers.onAudioMessage) {
        await handlers.onAudioMessage(message as any);
      }
      break;

    case 'reaction':
      if (handlers.onReactionMessage) {
        await handlers.onReactionMessage(message as ReactionMessage);
      }
      break;

    case 'interactive':
      if (message.interactive?.type === 'button_reply' && handlers.onButtonClick) {
        await handlers.onButtonClick(message as ButtonMessage);
      }
      break;

    default:
      console.log(`Unhandled message type: ${message.type}`);
  }
}

function isValidWebhook(body: unknown): body is WebhookBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    'entry' in body &&
    Array.isArray((body as any).entry)
  );
}

interface WebhookBody {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      field: string;
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        messages?: any[];
        statuses?: any[];
      };
    }>;
  }>;
}
```

**Usage in Webhook Route:**
```typescript
// app/api/whatsapp/webhook/route.ts

import { createWebhookProcessor } from '@/lib/webhook-processor';
import { sendText, reactWithCheck } from '@/lib/whatsapp';
import { classifyIntent } from '@/lib/intent';
import { generateResponse } from '@/lib/response';

export const runtime = 'edge';

const processor = createWebhookProcessor({
  onTextMessage: async (message) => {
    // Quick acknowledgment
    await reactWithCheck(message.from, message.id);

    // Process message
    const intent = await classifyIntent(message.text.body);
    const response = await generateResponse(intent, message.text.body);

    // Send response
    await sendText(message.from, response);
  },

  onReactionMessage: async (message) => {
    console.log(
      `User reacted with ${message.reaction.emoji} to ${message.reaction.message_id}`
    );
    // Could track user satisfaction, etc.
  },

  onError: async (error) => {
    console.error('Webhook processing error:', error);
  }
});

export async function POST(req: Request) {
  const body = await req.json();
  await processor(body);
  return new Response('OK', { status: 200 });
}
```

---

### Broadcast Messaging

#### ✅ Edge-Compatible Implementation

```typescript
// lib/broadcast.ts - NEW FILE

export interface BroadcastOptions {
  batchSize?: number;
  delayBetweenBatches?: number;
  onProgress?: (progress: BroadcastProgress) => void;
}

export interface BroadcastProgress {
  total: number;
  sent: number;
  failed: number;
  percentage: number;
}

export interface BroadcastResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    phoneNumber: string;
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

export async function sendBroadcast(
  phoneNumbers: string[],
  message: string,
  options: BroadcastOptions = {}
): Promise<BroadcastResult> {
  const {
    batchSize = 10,
    delayBetweenBatches = 1000,
    onProgress
  } = options;

  const results: BroadcastResult['results'] = [];
  let sent = 0;
  let failed = 0;

  // Process in batches to respect rate limits
  for (let i = 0; i < phoneNumbers.length; i += batchSize) {
    const batch = phoneNumbers.slice(i, i + batchSize);

    // Send batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(async (phoneNumber) => {
        const result = await sendText(phoneNumber, message);
        return { phoneNumber, result };
      })
    );

    // Process batch results
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const { phoneNumber, result: sendResult } = result.value;
        if (sendResult.success) {
          sent++;
          results.push({
            phoneNumber,
            success: true,
            messageId: sendResult.messageId
          });
        } else {
          failed++;
          results.push({
            phoneNumber,
            success: false,
            error: sendResult.error
          });
        }
      } else {
        failed++;
        results.push({
          phoneNumber: batch[results.length] || 'unknown',
          success: false,
          error: result.reason
        });
      }
    }

    // Report progress
    if (onProgress) {
      onProgress({
        total: phoneNumbers.length,
        sent,
        failed,
        percentage: Math.round(((sent + failed) / phoneNumbers.length) * 100)
      });
    }

    // Delay between batches (except last batch)
    if (i + batchSize < phoneNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return {
    total: phoneNumbers.length,
    successful: sent,
    failed,
    results
  };
}
```

**Usage:**
```typescript
import { sendBroadcast } from '@/lib/broadcast';

const result = await sendBroadcast(
  ['1111111111', '2222222222', '3333333333'],
  'Important announcement!',
  {
    batchSize: 5,
    delayBetweenBatches: 2000,
    onProgress: (progress) => {
      console.log(`Sent ${progress.sent}/${progress.total} (${progress.percentage}%)`);
    }
  }
);

console.log(`Broadcast: ${result.successful} sent, ${result.failed} failed`);
```

---

## Type Definitions

### Edge-Compatible Type Imports

You can import SDK types for type safety WITHOUT importing runtime code:

```typescript
// types/whatsapp.ts - NEW FILE

// Import types only (no runtime impact)
import type {
  MessageResponse,
  WhatsAppApiError
} from 'whatsapp-client-sdk';

// Or define your own (Edge-compatible)
export interface MessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface WhatsAppError {
  code: number;
  message: string;
  type: string;
  error_data?: {
    details: string;
  };
}
```

---

## Testing Edge Compatibility

### Vercel Dev

```bash
npm run dev
# Vercel dev automatically uses Edge Runtime for routes with:
# export const runtime = 'edge';
```

### Edge Runtime Environment

```typescript
// Check if running in Edge Runtime
if (typeof EdgeRuntime !== 'undefined') {
  console.log('Running in Edge Runtime');
}

// Available globals
console.log(typeof fetch);        // ✅ 'function'
console.log(typeof Request);      // ✅ 'function'
console.log(typeof Response);     // ✅ 'function'
console.log(typeof Headers);      // ✅ 'function'
console.log(typeof crypto);       // ✅ 'object'
console.log(typeof TextEncoder);  // ✅ 'function'
console.log(typeof atob);         // ✅ 'function'
console.log(typeof btoa);         // ✅ 'function'

// NOT available
console.log(typeof require);      // ❌ 'undefined'
console.log(typeof process.cwd);  // ❌ Error
console.log(typeof fs);           // ❌ 'undefined'
```

### Unit Tests with Edge Runtime

```typescript
// tests/unit/whatsapp-reactions.test.ts

import { sendReaction, reactWithLike } from '../../lib/whatsapp';

describe('WhatsApp Reactions (Edge Compatible)', () => {
  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
    process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  });

  it('should send reaction with fetch API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messages: [{ id: 'msg_123' }]
      })
    });

    const result = await sendReaction('1234567890', 'wamid.ABC', '🔥');

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg_123');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"emoji":"🔥"')
      })
    );
  });
});
```

---

## Best Practices

### 1. Always Specify Edge Runtime

```typescript
// app/api/*/route.ts
export const runtime = 'edge'; // FIRST LINE after imports
```

### 2. Use Native APIs

```typescript
// ✅ Good
const data = await fetch(url).then(r => r.json());

// ❌ Bad
const { data } = await axios.get(url);
```

### 3. Handle Errors Gracefully

```typescript
export async function sendMessage(to: string, text: string) {
  try {
    const response = await fetch(/* ... */);
    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message };
    }
    return { success: true, data: await response.json() };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### 4. Minimize Bundle Size

```typescript
// ❌ Don't import entire libraries
import _ from 'lodash';

// ✅ Use native methods or specific imports
const unique = [...new Set(array)];
```

---

## Migration Checklist

When adding SDK-inspired features:

- [ ] ✅ Uses native `fetch` instead of `axios`
- [ ] ✅ No Node.js-specific modules (`fs`, `path`, `http`, etc.)
- [ ] ✅ Exports `const runtime = 'edge'` in API routes
- [ ] ✅ Uses Web APIs (FormData, Headers, Request, Response)
- [ ] ✅ Handles errors with try/catch
- [ ] ✅ Returns typed responses
- [ ] ✅ Includes unit tests
- [ ] ✅ Tests pass with `npm run test`
- [ ] ✅ Builds successfully with `npm run build`
- [ ] ✅ Works in `npm run dev` (Vercel dev)

---

## Next Steps

- **[Features to Adopt](./features-to-adopt.md)** - Priority guide for implementing SDK features
- **[API Reference](./api-reference.md)** - Complete SDK method reference
- **[Comparison](./comparison.md)** - Detailed analysis

---

**Key Takeaway**: You can adopt ALL SDK patterns and features using Edge-compatible implementations. The SDK is an excellent reference, but we implement using `fetch` to maintain our performance advantage.
