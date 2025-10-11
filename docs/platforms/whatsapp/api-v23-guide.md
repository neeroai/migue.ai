# WhatsApp Cloud API v23.0 - Essential Guide

**API Version**: v23.0 | **Edge Runtime**: ✅ Compatible | **Last Updated**: 2025-10-03

## Overview

WhatsApp Cloud API v23.0 enables programmatic messaging for migue.ai. This guide covers essential features for our implementation.

## Quick Start

### Base URL
```
https://graph.facebook.com/v23.0
```

### Authentication
```typescript
const headers = {
  'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
};
```

### Send Text Message
```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: phoneNumber,
  type: 'text',
  text: { body: message }
};

await fetch(`${BASE_URL}/${PHONE_ID}/messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify(payload)
});
```

## Message Types

### 1. Text Messages
```typescript
{ type: 'text', text: { body: 'Hello!' } }
```

### 2. Interactive Buttons (≤3 options)
```typescript
{
  type: 'interactive',
  interactive: {
    type: 'button',
    body: { text: 'Choose an option:' },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'opt1', title: 'Option 1' } },
        { type: 'reply', reply: { id: 'opt2', title: 'Option 2' } }
      ]
    }
  }
}
```

### 3. Interactive Lists (4+ options)
```typescript
{
  type: 'interactive',
  interactive: {
    type: 'list',
    body: { text: 'Select from menu:' },
    action: {
      button: 'View Options',
      sections: [{
        title: 'Options',
        rows: [
          { id: 'opt1', title: 'Option 1', description: 'Details' },
          { id: 'opt2', title: 'Option 2', description: 'Details' }
        ]
      }]
    }
  }
}
```

### 4. Reactions
```typescript
{
  type: 'reaction',
  reaction: {
    message_id: originalMessageId,
    emoji: '👍'
  }
}
```

### 5. Media Messages
```typescript
// Audio (for transcription responses)
{
  type: 'audio',
  audio: { link: audioUrl }
}

// Image
{
  type: 'image',
  image: { link: imageUrl, caption: 'Description' }
}
```

## Webhook Events

### Receiving Messages
```typescript
// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        const message = change.value.messages?.[0];

        switch (message.type) {
          case 'text':
            await handleTextMessage(message);
            break;
          case 'audio':
            await handleAudioMessage(message);
            break;
          case 'interactive':
            await handleInteractiveResponse(message);
            break;
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
}
```

### Message Object Structure
```typescript
interface IncomingMessage {
  from: string;              // Sender phone number
  id: string;                // Message ID
  timestamp: string;
  type: 'text' | 'audio' | 'interactive' | 'image';
  text?: { body: string };
  audio?: { id: string, mime_type: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string, title: string };
    list_reply?: { id: string, title: string };
  };
}
```

## Advanced Features

### Typing Indicators
```typescript
await fetch(`${BASE_URL}/${PHONE_ID}/messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: phoneNumber,
    type: 'typing',
    typing: { state: 'on' }  // or 'off'
  })
});
```

### Read Receipts
```typescript
await fetch(`${BASE_URL}/${PHONE_ID}/messages`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  })
});
```

### Template Messages
```typescript
{
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
}
```

## Rate Limits & Quotas

| Limit Type | Value | Notes |
|-----------|-------|-------|
| Messages/sec | 80 | Business API tier |
| Message length | 4096 chars | Text messages |
| Buttons | 3 max | Use lists for 4+ |
| List rows | 10/section | Max 10 sections |
| Media size | 100 MB | Audio/video |

## Error Handling

### Common Error Codes
```typescript
const ERROR_CODES = {
  130429: 'Rate limit exceeded',
  131051: 'Unsupported message type',
  133000: 'Invalid parameter',
  133015: 'Template does not exist',
  135000: 'Generic error'
};
```

### Error Response Structure
```typescript
interface WhatsAppError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      details: string;
    };
    fbtrace_id: string;
  };
}
```

### Retry Strategy
```typescript
async function sendWithRetry(payload: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sendMessage(payload);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // Exponential backoff
    }
  }
}
```

## Best Practices

### 1. Use Interactive Messages
- Buttons for 1-3 options
- Lists for 4+ options
- Better UX than free text

### 2. Implement Graceful Degradation
```typescript
try {
  await sendInteractiveButtons(params);
} catch (error) {
  // Fallback to text
  await sendTextMessage(phone, 'Please reply with your choice');
}
```

### 3. Handle Media Efficiently
```typescript
// Download media
const mediaUrl = await fetch(`${BASE_URL}/${mediaId}`, { headers });
const mediaData = await mediaUrl.json();

// Upload to permanent storage (Supabase)
const permanentUrl = await uploadToStorage(mediaData.url);
```

### 4. Respect Rate Limits
```typescript
// Queue messages for batch sending
const queue = new MessageQueue({ rateLimit: 80 });
await queue.add(message);
```

## migue.ai Implementation

See `lib/whatsapp.ts` for our wrapper functions:
- `sendMessage()` - Basic text messages
- `sendInteractiveButtons()` - Button messages
- `sendInteractiveList()` - List messages
- `sendReaction()` - React to messages
- `markAsRead()` - Mark messages as read
- `createTypingManager()` - Typing indicators

## Migration from v19-v22

### Key Changes in v23.0
1. **New**: Calling API, Block API
2. **Changed**: Pricing model (per-message since July 2025)
3. **Deprecated**: On-Behalf-Of (OBO) tokens

### Breaking Changes
- Template message pricing increased
- Marketing templates restricted in US (April 2025)
- System user tokens required (OBO deprecated)

See original docs for full migration details.

## Additional Resources

- [WhatsApp Business API Docs](https://developers.facebook.com/docs/whatsapp)
- [Flows Implementation](./flows-implementation.md)
- [Interactive Features](./interactive-features.md)
- Our wrapper library: `lib/whatsapp.ts`

---

**Implementation Status**: ✅ Production Ready
**Used in**: `app/api/whatsapp/webhook/route.ts`
