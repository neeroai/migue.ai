# WhatsApp Cloud API v23.0 - Complete Reference Guide

**Last Updated:** October 2025
**API Version:** v23.0
**Edge Runtime Compatible:** ✅ Yes
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Endpoints](#architecture--endpoints)
3. [Authentication](#authentication)
4. [Rate Limiting](#rate-limiting)
5. [Message Types](#message-types)
   - [Text Messages](#text-messages)
   - [Media Messages](#media-messages)
   - [Interactive Messages](#interactive-messages)
   - [Template Messages](#template-messages)
   - [Reaction Messages](#reaction-messages)
   - [Location Messages](#location-messages)
   - [Contact Messages](#contact-messages)
6. [Webhook Events](#webhook-events)
7. [Error Handling](#error-handling)
8. [TypeScript Reference](#typescript-reference)
9. [Best Practices](#best-practices)

---

## Overview

The WhatsApp Cloud API v23.0 is a REST API that enables businesses to send and receive WhatsApp messages programmatically. This reference covers all available features optimized for Vercel Edge Functions and the migue.ai architecture.

### Key Features

- **Messaging**: Send text, media, interactive, and template messages
- **Webhooks**: Receive messages and status updates in real-time
- **Interactive Elements**: Buttons, lists, flows, product catalogs
- **Media Handling**: Audio, video, images, documents, stickers
- **Reactions**: Send emoji reactions to messages
- **Typing Indicators**: Show typing status to users
- **Read Receipts**: Mark messages as read
- **Call Permissions**: Request permission for business-initiated calls
- **Block API**: Manage spam by blocking phone numbers

### API Endpoint Base URL

```
https://graph.facebook.com/v23.0
```

---

## Architecture & Endpoints

### Primary Endpoints

#### Send Messages
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/messages
```

#### Retrieve Message
```
GET https://graph.facebook.com/v23.0/{MESSAGE_ID}
```

#### Upload Media
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/media
```

#### Download Media
```
GET https://graph.facebook.com/v23.0/{MEDIA_ID}
```

#### Block/Unblock Phone Numbers (v23.0 New)
```
POST https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/block
DELETE https://graph.facebook.com/v23.0/{PHONE_NUMBER_ID}/block/{BLOCKED_NUMBER}
```

### Edge Runtime Compatibility

All WhatsApp Cloud API endpoints are fully compatible with Vercel Edge Functions:

- ✅ **Fetch API**: Standard `fetch()` calls
- ✅ **No Node.js APIs**: Pure JavaScript/TypeScript
- ✅ **Streaming**: Not supported by WhatsApp API
- ✅ **Global Distribution**: Sub-100ms latency targets

---

## Authentication

### Access Tokens

All API requests require a Bearer token in the Authorization header:

```typescript
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
};
```

### Environment Variables

```bash
WHATSAPP_TOKEN=EAAxxxxxxxxxx          # Access token from Meta App
WHATSAPP_PHONE_ID=123456789012345    # Phone number ID
WHATSAPP_VERIFY_TOKEN=your_secret    # Webhook verification token
```

### Token Security

- ✅ Store tokens in environment variables (never in code)
- ✅ Rotate tokens periodically
- ✅ Use system user tokens for production
- ✅ Never commit tokens to version control

---

## Rate Limiting

### Current Limits (v23.0)

- **250 messages per second** per phone number
- **10,000 messages per day** (tier-dependent, can increase)
- **Message quality rating** affects sending limits

### Rate Limit Implementation

The migue.ai implementation uses a token bucket algorithm:

```typescript
// lib/whatsapp.ts
const rateLimitBuckets = new Map<number, number[]>();
const RATE_LIMIT = 250; // messages per second

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const second = Math.floor(now / 1000);

  if (!rateLimitBuckets.has(second)) {
    rateLimitBuckets.set(second, []);
    // Clean old buckets
    for (const [key] of rateLimitBuckets) {
      if (key < second - 2) {
        rateLimitBuckets.delete(key);
      }
    }
  }

  const bucket = rateLimitBuckets.get(second)!;
  if (bucket.length >= RATE_LIMIT) {
    const waitTime = 1000 - (now % 1000);
    await new Promise(r => setTimeout(r, waitTime));
    return rateLimit();
  }

  bucket.push(now);
}
```

### Rate Limit Best Practices

1. **Implement backoff**: Exponential backoff on rate limit errors
2. **Batch processing**: Group messages when possible
3. **Monitor quality**: Maintain high message quality rating
4. **Avoid spam**: Only message opted-in users
5. **Use templates**: Outside 24-hour customer service window

---

## Message Types

### Text Messages

Simple text messages with optional link previews.

#### Basic Text Message

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'text',
  text: {
    body: 'Hello! How can I help you today?'
  }
};
```

#### Text with Link Preview

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'text',
  text: {
    preview_url: true,
    body: 'Check out our latest product: https://example.com/product'
  }
};
```

#### TypeScript Implementation

```typescript
export async function sendWhatsAppText(
  to: string,
  body: string,
  previewUrl: boolean = false
): Promise<string | null> {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body, preview_url: previewUrl },
  });
  return result?.messages?.[0]?.id ?? null;
}
```

#### Formatting Options

WhatsApp supports basic formatting:

- **Bold**: `*text*`
- **Italic**: `_text_`
- **Strikethrough**: `~text~`
- **Monospace**: ` ```text``` `

```typescript
const formattedText = `
*Bold Text*
_Italic Text_
~Strikethrough~
\`\`\`Monospace\`\`\`
`;
```

---

### Media Messages

Send images, videos, audio files, documents, and stickers.

#### Supported Media Types

| Type | Formats | Max Size | Use Case |
|------|---------|----------|----------|
| Image | JPEG, PNG | 5 MB | Product images, receipts |
| Video | MP4, 3GPP | 16 MB | Tutorials, demos |
| Audio | AAC, MP3, AMR, OGG | 16 MB | Voice messages, recordings |
| Document | PDF, DOC, DOCX, etc. | 100 MB | Invoices, contracts |
| Sticker | WebP | 100 KB | Fun reactions |

#### Image Message

```typescript
interface ImageMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'image';
  image: {
    id?: string;        // Media ID (uploaded)
    link?: string;      // External URL
    caption?: string;   // Optional caption
  };
}

// Example: Send image by URL
const payload: ImageMessage = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'image',
  image: {
    link: 'https://example.com/product.jpg',
    caption: 'Check out our new product!'
  }
};

// Example: Send uploaded image
const payload: ImageMessage = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'image',
  image: {
    id: '1234567890',
    caption: 'Your receipt'
  }
};
```

#### Video Message

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'video',
  video: {
    link: 'https://example.com/tutorial.mp4',
    caption: 'How to use our product'
  }
};
```

#### Audio Message

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'audio',
  audio: {
    id: '1234567890'  // Uploaded media ID
  }
};
```

#### Document Message

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'document',
  document: {
    link: 'https://example.com/invoice.pdf',
    caption: 'Your invoice #12345',
    filename: 'invoice-12345.pdf'
  }
};
```

#### Sticker Message

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'sticker',
  sticker: {
    id: '1234567890'  // Uploaded WebP sticker
  }
};
```

#### Media Upload

Upload media to WhatsApp servers for reuse:

```typescript
async function uploadMedia(
  file: File | Blob,
  mimeType: string
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('messaging_product', 'whatsapp');
  formData.append('type', mimeType);

  const response = await fetch(
    `${GRAPH_BASE_URL}/${process.env.WHATSAPP_PHONE_ID}/media`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: formData
    }
  );

  const data = await response.json();
  return data.id;
}
```

---

### Interactive Messages

Interactive messages provide rich user experiences with buttons, lists, and flows.

#### Reply Buttons (Max 3)

```typescript
interface InteractiveButton {
  type: 'button';
  body: { text: string };
  action: {
    buttons: Array<{
      type: 'reply';
      reply: { id: string; title: string };
    }>;
  };
  header?: { type: 'text'; text: string };
  footer?: { text: string };
}

// Example
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'button',
    header: {
      type: 'text',
      text: 'Appointment Confirmation'
    },
    body: {
      text: 'Do you want to confirm your appointment for tomorrow at 2 PM?'
    },
    footer: {
      text: 'Powered by migue.ai'
    },
    action: {
      buttons: [
        {
          type: 'reply',
          reply: { id: 'btn_confirm', title: 'Confirm' }
        },
        {
          type: 'reply',
          reply: { id: 'btn_reschedule', title: 'Reschedule' }
        },
        {
          type: 'reply',
          reply: { id: 'btn_cancel', title: 'Cancel' }
        }
      ]
    }
  }
};
```

**Button Constraints:**
- Max 3 buttons per message
- Button title max 20 characters
- Button ID max 256 characters

**TypeScript Implementation:**

```typescript
export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options: {
    header?: string;
    footer?: string;
    replyToMessageId?: string;
  } = {}
): Promise<string | null> {
  const interactive: InteractiveButton = {
    type: 'button',
    body: { text: body },
    action: {
      buttons: buttons.map((button) => ({
        type: 'reply',
        reply: { id: button.id, title: button.title },
      })),
    },
  };

  if (options.header) {
    interactive.header = { type: 'text', text: options.header };
  }

  if (options.footer) {
    interactive.footer = { text: options.footer };
  }

  const payload: any = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive,
  };

  if (options.replyToMessageId) {
    payload.context = { message_id: options.replyToMessageId };
  }

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}
```

#### Interactive Lists

Lists are ideal for 4+ options with descriptions.

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'list',
    header: {
      type: 'text',
      text: 'Available Services'
    },
    body: {
      text: 'Select a service to learn more:'
    },
    footer: {
      text: 'migue.ai'
    },
    action: {
      button: 'View Services',
      sections: [
        {
          title: 'Consulting Services',
          rows: [
            {
              id: 'service_strategy',
              title: 'Strategy Consulting',
              description: 'Business strategy and planning'
            },
            {
              id: 'service_tech',
              title: 'Tech Consulting',
              description: 'Technology implementation'
            }
          ]
        },
        {
          title: 'Support Services',
          rows: [
            {
              id: 'service_support',
              title: '24/7 Support',
              description: 'Round-the-clock assistance'
            }
          ]
        }
      ]
    }
  }
};
```

**List Constraints:**
- Max 10 rows total
- Max 10 sections
- Row title max 24 characters
- Row description max 72 characters

**TypeScript Implementation:**

```typescript
export async function sendInteractiveList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  sectionTitle: string = 'Options'
): Promise<string | null> {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: [
          {
            title: sectionTitle,
            rows: rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
            })),
          },
        ],
      },
    },
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}
```

#### CTA (Call-to-Action) URL Buttons

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'cta_url',
    header: {
      type: 'text',
      text: 'Special Offer!'
    },
    body: {
      text: 'Get 20% off your first purchase. Click below to shop now!'
    },
    footer: {
      text: 'Offer valid until Dec 31'
    },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: 'Shop Now',
        url: 'https://example.com/shop?promo=WELCOME20'
      }
    }
  }
};
```

#### Location Request

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'location_request_message',
    body: {
      text: 'Please share your location for delivery'
    },
    action: {
      name: 'send_location'
    }
  }
};
```

#### Call Permission Request (v23.0 New)

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'call_permission_request',
    body: {
      text: 'May we call you to discuss your inquiry?'
    },
    action: {
      name: 'request_call_permission'
    }
  }
};
```

---

### Template Messages

Template messages are pre-approved message formats that can be sent outside the 24-hour customer service window.

#### Template Types

- **Marketing**: Promotional content, offers (⚠️ Restricted for US numbers as of April 2025)
- **Utility**: Account updates, order notifications, appointment reminders
- **Authentication**: One-time passwords, verification codes

#### Template Message Structure

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'template',
  template: {
    name: 'appointment_reminder',
    language: {
      code: 'en_US'
    },
    components: [
      {
        type: 'header',
        parameters: [
          {
            type: 'text',
            text: 'Dr. Smith'
          }
        ]
      },
      {
        type: 'body',
        parameters: [
          {
            type: 'text',
            text: 'John Doe'
          },
          {
            type: 'text',
            text: 'tomorrow at 2 PM'
          }
        ]
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: 0,
        parameters: [
          {
            type: 'payload',
            payload: 'CONFIRM_APPOINTMENT_123'
          }
        ]
      }
    ]
  }
};
```

#### 2025 Pricing Changes

**Starting July 1, 2025:**
- Billing is per template message delivered (not per conversation)
- Marketing, Utility, and Authentication templates are charged
- Service messages within customer service window remain FREE

**US Marketing Restrictions (April 1, 2025):**
- Marketing template messages to US phone numbers are temporarily paused
- Use Utility templates for transactional messages
- Service messages still allowed during active conversations

---

### Reaction Messages

Send emoji reactions to messages.

#### Send Reaction

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'reaction',
  reaction: {
    message_id: 'wamid.HBgNMTIzNDU2Nzg5MAA=',
    emoji: '👍'
  }
};
```

#### Remove Reaction

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'reaction',
  reaction: {
    message_id: 'wamid.HBgNMTIzNDU2Nzg5MAA=',
    emoji: ''  // Empty string removes reaction
  }
};
```

#### TypeScript Implementation

```typescript
export async function sendReaction(
  to: string,
  messageId: string,
  emoji: string
): Promise<string | null> {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji || '', // Empty removes reaction
    },
  });
  return result?.messages?.[0]?.id ?? null;
}

// Convenience methods
export const reactWithCheck = (to: string, msgId: string) =>
  sendReaction(to, msgId, '✅');

export const reactWithThinking = (to: string, msgId: string) =>
  sendReaction(to, msgId, '🤔');

export const reactWithLike = (to: string, msgId: string) =>
  sendReaction(to, msgId, '👍');

export const removeReaction = (to: string, msgId: string) =>
  sendReaction(to, msgId, '');
```

---

### Location Messages

Send or receive location data.

#### Send Location

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'location',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    name: 'Our Office',
    address: '123 Market St, San Francisco, CA 94103'
  }
};
```

---

### Contact Messages

Share contact information.

```typescript
const payload = {
  messaging_product: 'whatsapp',
  to: '1234567890',
  type: 'contacts',
  contacts: [
    {
      name: {
        formatted_name: 'John Doe',
        first_name: 'John',
        last_name: 'Doe'
      },
      phones: [
        {
          phone: '+1 234 567 8900',
          type: 'MOBILE'
        }
      ],
      emails: [
        {
          email: 'john@example.com',
          type: 'WORK'
        }
      ]
    }
  ]
};
```

---

## Webhook Events

WhatsApp sends real-time notifications to your webhook endpoint.

### Webhook Verification

```typescript
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}
```

### Webhook Payload Structure

```typescript
interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<Message>;
        statuses?: Array<StatusUpdate>;
      };
      field: 'messages';
    }>;
  }>;
}
```

### Message Received Events

```typescript
interface Message {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' |
        'sticker' | 'location' | 'contacts' | 'button' | 'interactive';

  // Message content (one of the following)
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; filename: string; mime_type: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string };
  contacts?: Array<Contact>;

  // Interactive message replies
  button?: { text: string; payload: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };

  // Context (reply to message)
  context?: {
    from: string;
    id: string;
  };
}
```

### Status Update Events

```typescript
interface StatusUpdate {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: {
      type: 'service' | 'utility' | 'marketing' | 'authentication';
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: 'CBP';
    category: 'service' | 'utility' | 'marketing' | 'authentication';
  };
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}
```

### New Webhook Events (v23.0)

#### Account Update Event

```typescript
interface AccountUpdateEvent {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      field: 'account_update';
      value: {
        event: 'AD_ACCOUNT_LINKED';
        ad_account_id: string;
      };
    }>;
  }>;
}
```

---

## Error Handling

### Common Error Codes

| Code | Error | Description | Solution |
|------|-------|-------------|----------|
| 131000 | Recipient incapable of receiving message | User doesn't have WhatsApp or blocked you | Remove from list |
| 131009 | Message type not supported | Feature not available for business account | Use supported message type |
| 131026 | Too many messages sent to receiver | Sending too frequently | Implement rate limiting |
| 131031 | Template message invalid | Template not approved or parameters incorrect | Check template status |
| 131047 | Re-engagement message | User hasn't messaged in >24hrs, use template | Send template message |
| 131051 | Message type not currently supported | Unsupported message type | Check API documentation |
| 133015 | Phone number not registered | Phone number not found | Verify phone number |

### Error Response Structure

```typescript
interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: 'whatsapp';
      details: string;
    };
    error_subcode?: number;
    fbtrace_id: string;
  };
}
```

### Error Handling Pattern

```typescript
async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();

      // Handle specific errors
      switch (error.error.code) {
        case 131000:
          console.error('Recipient cannot receive messages');
          return null;
        case 131047:
          console.error('24-hour window expired, use template');
          return null;
        case 131026:
          console.error('Rate limit exceeded');
          await new Promise(r => setTimeout(r, 5000)); // Backoff
          return sendWhatsAppRequest(payload); // Retry
        default:
          throw new Error(`WhatsApp API error ${error.error.code}: ${error.error.message}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error('WhatsApp request failed:', error);
    throw error;
  }
}
```

---

## TypeScript Reference

### Core Types

```typescript
// Base payload
type WhatsAppPayload = {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
};

// Message types
type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'template'
  | 'reaction';

// Interactive message types
type InteractiveType =
  | 'button'
  | 'list'
  | 'cta_url'
  | 'location_request_message'
  | 'call_permission_request'
  | 'flow'
  | 'product'
  | 'product_list'
  | 'catalog';

// Template categories
type TemplateCategory =
  | 'MARKETING'
  | 'UTILITY'
  | 'AUTHENTICATION';
```

### Zod Validation Schemas

```typescript
import { z } from 'zod';

// Text message schema
export const TextMessageSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  to: z.string(),
  type: z.literal('text'),
  text: z.object({
    body: z.string(),
    preview_url: z.boolean().optional()
  })
});

// Interactive button schema
export const InteractiveButtonSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  to: z.string(),
  type: z.literal('interactive'),
  interactive: z.object({
    type: z.literal('button'),
    header: z.object({
      type: z.literal('text'),
      text: z.string()
    }).optional(),
    body: z.object({
      text: z.string()
    }),
    footer: z.object({
      text: z.string()
    }).optional(),
    action: z.object({
      buttons: z.array(z.object({
        type: z.literal('reply'),
        reply: z.object({
          id: z.string(),
          title: z.string().max(20)
        })
      })).max(3)
    })
  })
});

// Webhook message schema
export const WebhookMessageSchema = z.object({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.enum(['text', 'image', 'video', 'audio', 'document', 'button', 'interactive']),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({
    text: z.string(),
    payload: z.string()
  }).optional(),
  interactive: z.object({
    type: z.enum(['button_reply', 'list_reply']),
    button_reply: z.object({
      id: z.string(),
      title: z.string()
    }).optional(),
    list_reply: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().optional()
    }).optional()
  }).optional()
});
```

---

## Best Practices

### 1. Message Quality

- ✅ Only message opted-in users
- ✅ Provide clear opt-out mechanisms
- ✅ Send relevant, timely content
- ✅ Maintain high engagement rates
- ❌ Don't send spam or promotional content outside templates
- ❌ Don't message users who haven't responded

### 2. Performance Optimization

```typescript
// Cache successful responses
const messageCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  const cacheKey = JSON.stringify(payload);
  const cached = messageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetch(/* ... */);
  messageCache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}
```

### 3. Security

```typescript
// Validate webhook signatures
function validateSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}
```

### 4. Error Recovery

```typescript
// Exponential backoff
async function sendWithRetry(
  payload: WhatsAppPayload,
  maxRetries: number = 3
): Promise<unknown> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sendWhatsAppRequest(payload);
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

### 5. Monitoring

```typescript
// Track latency
const startTime = Date.now();
const response = await sendWhatsAppRequest(payload);
const latency = Date.now() - startTime;

if (latency > 100) {
  console.warn(`WhatsApp API slow response: ${latency}ms`);
}
```

---

## Reference Links

- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/)
- [Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/reference)
- [Messaging Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
- [Webhook Reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components)
- [Error Codes](https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes)
- [migue.ai Documentation](../README.md)

---

**Next Steps:**
- [Migration Guide](./whatsapp-api-v23-migration.md) - Upgrade from older versions
- [Advanced Features](./whatsapp-api-v23-advanced.md) - Flows, catalogs, broadcasting
- [WhatsApp Flows](./whatsapp-api-v23-flows.md) - Interactive flows deep dive
