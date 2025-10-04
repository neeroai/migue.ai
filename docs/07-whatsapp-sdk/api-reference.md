# WhatsApp SDK API Reference

Complete TypeScript API reference for `whatsapp-client-sdk` v1.6.0

**Note**: This is a reference guide. See [edge-compatibility-wrapper.md](./edge-compatibility-wrapper.md) for Edge Runtime-compatible implementations.

---

## Table of Contents

- [Client Initialization](#client-initialization)
- [Text Messaging](#text-messaging)
- [Reactions](#reactions)
- [Typing Indicators & Read Receipts](#typing-indicators--read-receipts)
- [Interactive Messages](#interactive-messages)
- [Media Messages](#media-messages)
- [Template Messages](#template-messages)
- [Broadcast Messaging](#broadcast-messaging)
- [Media Management](#media-management)
- [Webhook Processing](#webhook-processing)
- [Message Status](#message-status)
- [Type Definitions](#type-definitions)

---

## Client Initialization

### Constructor

```typescript
import { WhatsAppClient } from 'whatsapp-client-sdk';

const client = new WhatsAppClient({
  phoneNumberId: string;      // Your WhatsApp Business Phone Number ID
  accessToken: string;         // WhatsApp Business API Access Token
  apiVersion?: string;         // Default: 'v18.0'
  webhookVerifyToken?: string; // Token for webhook verification
  supabase?: {                 // Optional Supabase integration
    url: string;
    key: string;
    tableName?: string;        // Default: 'whatsapp_messages'
  }
});
```

**Example:**
```typescript
const client = new WhatsAppClient({
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
  apiVersion: 'v18.0',
  webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN
});
```

---

## Text Messaging

### sendText()

Send a text message to a recipient.

```typescript
async sendText(
  to: string,
  text: string,
  options?: {
    previewUrl?: boolean;      // Enable URL preview (default: false)
    replyToMessageId?: string; // Reply to specific message
  }
): Promise<MessageResponse>
```

**Parameters:**
- `to` - Recipient phone number (international format, no +)
- `text` - Message text (max 4096 characters)
- `options.previewUrl` - Show link previews for URLs
- `options.replyToMessageId` - Message ID to reply to

**Returns:**
```typescript
interface MessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string; // Message ID for tracking
  }>;
}
```

**Example:**
```typescript
const response = await client.sendText(
  '1234567890',
  'Hello from migue.ai!',
  { previewUrl: true }
);

console.log('Message ID:', response.messages[0]?.id);
```

---

## Reactions

### sendReaction()

Send an emoji reaction to a message.

```typescript
async sendReaction(
  to: string,
  messageId: string,
  emoji: string
): Promise<MessageResponse>
```

**Parameters:**
- `to` - Recipient phone number
- `messageId` - ID of message to react to
- `emoji` - Single emoji character (e.g., '👍', '❤️', '🔥')

**Example:**
```typescript
await client.sendReaction('1234567890', 'wamid.ABC123', '🔥');
```

### removeReaction()

Remove a previously sent reaction.

```typescript
async removeReaction(
  to: string,
  messageId: string
): Promise<MessageResponse>
```

**Example:**
```typescript
await client.removeReaction('1234567890', 'wamid.ABC123');
```

### Convenience Reaction Methods

```typescript
// Pre-defined reaction methods (12+ available)
async reactWithLike(to: string, messageId: string): Promise<MessageResponse>
async reactWithLove(to: string, messageId: string): Promise<MessageResponse>
async reactWithFire(to: string, messageId: string): Promise<MessageResponse>
async reactWithClap(to: string, messageId: string): Promise<MessageResponse>
async reactWithSmile(to: string, messageId: string): Promise<MessageResponse>
async reactWithWow(to: string, messageId: string): Promise<MessageResponse>
async reactWithSad(to: string, messageId: string): Promise<MessageResponse>
async reactWithAngry(to: string, messageId: string): Promise<MessageResponse>
async reactWithPray(to: string, messageId: string): Promise<MessageResponse>
async reactWithParty(to: string, messageId: string): Promise<MessageResponse>
async reactWithCheck(to: string, messageId: string): Promise<MessageResponse>
async reactWithThumbsDown(to: string, messageId: string): Promise<MessageResponse>
```

**Example:**
```typescript
await client.reactWithLove('1234567890', 'wamid.ABC123');
await client.reactWithFire('1234567890', 'wamid.XYZ789');
```

---

## Typing Indicators & Read Receipts

### sendTypingIndicator()

Show typing indicator to recipient (lasts ~25 seconds).

```typescript
async sendTypingIndicator(
  to: string,
  messageId?: string
): Promise<TypingIndicatorResponse>
```

**Parameters:**
- `to` - Recipient phone number
- `messageId` - Optional message ID for context

**Returns:**
```typescript
interface TypingIndicatorResponse {
  success: boolean;
}
```

**Example:**
```typescript
// Show typing indicator
await client.sendTypingIndicator('1234567890');

// Process message...
await new Promise(resolve => setTimeout(resolve, 2000));

// Send message
await client.sendText('1234567890', 'Your response here');
```

### sendTypingIndicatorWithDuration()

Show typing indicator with automatic stop after specified duration.

```typescript
async sendTypingIndicatorWithDuration(
  to: string,
  duration?: number,        // Duration in seconds (max 25)
  messageId?: string
): Promise<TypingIndicatorResponse>
```

**Example:**
```typescript
// Show typing for 5 seconds, then auto-stop
await client.sendTypingIndicatorWithDuration('1234567890', 5);
```

### markMessageAsRead()

Mark a received message as read.

```typescript
async markMessageAsRead(
  messageId: string
): Promise<TypingIndicatorResponse>
```

**Example:**
```typescript
// In webhook handler
await client.markMessageAsRead(incomingMessage.id);
```

---

## Interactive Messages

### sendButtons()

Send message with up to 3 action buttons.

```typescript
async sendButtons(
  to: string,
  text: string,
  buttons: Button[],
  options?: MessageOptions
): Promise<MessageResponse>

interface Button {
  id: string;           // Unique button ID (max 256 chars)
  title: string;        // Button text (max 20 chars)
}

interface MessageOptions {
  header?: {
    type: 'text';
    text: string;
  };
  footer?: string;
  replyToMessageId?: string;
}
```

**Example:**
```typescript
await client.sendButtons(
  '1234567890',
  'How can I help you today?',
  [
    { id: 'option_1', title: 'Get Started' },
    { id: 'option_2', title: 'Learn More' },
    { id: 'option_3', title: 'Contact Us' }
  ],
  {
    header: { type: 'text', text: 'Welcome!' },
    footer: 'Powered by migue.ai'
  }
);
```

### sendList()

Send interactive list with multiple sections and options.

```typescript
async sendList(
  to: string,
  text: string,
  buttonText: string,
  sections: Section[],
  options?: MessageOptions
): Promise<MessageResponse>

interface Section {
  title: string;
  rows: Row[];
}

interface Row {
  id: string;          // Unique row ID (max 200 chars)
  title: string;       // Row title (max 24 chars)
  description?: string; // Row description (max 72 chars)
}
```

**Example:**
```typescript
await client.sendList(
  '1234567890',
  'Select a service',
  'View Options',
  [
    {
      title: 'Popular Services',
      rows: [
        {
          id: 'service_1',
          title: 'AI Assistant',
          description: 'Get help with tasks'
        },
        {
          id: 'service_2',
          title: 'Reminders',
          description: 'Set up daily reminders'
        }
      ]
    },
    {
      title: 'Other Services',
      rows: [
        {
          id: 'service_3',
          title: 'Analytics',
          description: 'View your usage stats'
        }
      ]
    }
  ]
);
```

---

## Media Messages

### sendImage()

```typescript
async sendImage(
  to: string,
  image: {
    link?: string;  // Image URL (https only)
    id?: string;    // Media ID from upload
  },
  options?: {
    caption?: string;         // Image caption
    replyToMessageId?: string;
  }
): Promise<MessageResponse>
```

**Example:**
```typescript
// Send from URL
await client.sendImage(
  '1234567890',
  { link: 'https://example.com/image.jpg' },
  { caption: 'Check this out!' }
);

// Send uploaded media
await client.sendImage(
  '1234567890',
  { id: 'uploaded_media_id' }
);
```

### sendDocument()

```typescript
async sendDocument(
  to: string,
  document: {
    link?: string;
    id?: string;
  },
  options?: {
    filename?: string;        // Document filename
    caption?: string;
    replyToMessageId?: string;
  }
): Promise<MessageResponse>
```

### sendAudio()

```typescript
async sendAudio(
  to: string,
  audio: {
    link?: string;
    id?: string;
  },
  options?: {
    replyToMessageId?: string;
  }
): Promise<MessageResponse>
```

### sendVideo()

```typescript
async sendVideo(
  to: string,
  video: {
    link?: string;
    id?: string;
  },
  options?: {
    caption?: string;
    replyToMessageId?: string;
  }
): Promise<MessageResponse>
```

### sendSticker()

```typescript
async sendSticker(
  to: string,
  sticker: {
    link?: string;
    id?: string;
  }
): Promise<MessageResponse>
```

---

## Template Messages

### sendTemplate()

Send pre-approved message template.

```typescript
async sendTemplate(
  to: string,
  name: string,                    // Template name
  language: string,                // Language code (e.g., 'en', 'es')
  components?: TemplateComponent[]
): Promise<MessageResponse>

interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: Array<{
    type: 'text' | 'currency' | 'date_time' | 'image' | 'video' | 'document';
    text?: string;
    currency?: { fallback_value: string; code: string; amount_1000: number };
    date_time?: { fallback_value: string };
    image?: { link: string };
    video?: { link: string };
    document?: { link: string };
  }>;
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}
```

**Example:**
```typescript
await client.sendTemplate(
  '1234567890',
  'welcome_message',
  'en',
  [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: 'John' }
      ]
    }
  ]
);
```

---

## Broadcast Messaging

### sendBroadcastText()

Send text message to multiple recipients with rate limiting.

```typescript
async sendBroadcastText(
  phoneNumbers: string[],
  text: string,
  options?: {
    batchSize?: number;        // Messages per batch (default: 10)
    delayBetweenBatches?: number; // ms delay (default: 1000)
    previewUrl?: boolean;
    onProgress?: (progress: BroadcastProgress) => void;
    onMessageSent?: (result: BroadcastMessageResult) => void;
  }
): Promise<BroadcastResult>

interface BroadcastProgress {
  total: number;
  sent: number;
  failed: number;
  percentage: number;
}

interface BroadcastMessageResult {
  phoneNumber: string;
  success: boolean;
  messageId?: string;
  error?: any;
}

interface BroadcastResult {
  total: number;
  successful: number;
  failed: number;
  results: BroadcastMessageResult[];
}
```

**Example:**
```typescript
const result = await client.sendBroadcastText(
  ['1111111111', '2222222222', '3333333333'],
  'Important update!',
  {
    batchSize: 5,
    delayBetweenBatches: 2000,
    onProgress: (progress) => {
      console.log(`Sent ${progress.sent}/${progress.total} (${progress.percentage}%)`);
    },
    onMessageSent: (result) => {
      console.log(`Message to ${result.phoneNumber}: ${result.success ? 'OK' : 'Failed'}`);
    }
  }
);

console.log(`Broadcast complete: ${result.successful} sent, ${result.failed} failed`);
```

### sendBulkTemplates()

Send personalized templates to multiple recipients.

```typescript
async sendBulkTemplates(
  recipients: BroadcastRecipient[],
  templateName: string,
  language: string,
  options?: BroadcastOptions
): Promise<BroadcastResult>

interface BroadcastRecipient {
  phoneNumber: string;
  components?: TemplateComponent[];
}
```

**Example:**
```typescript
await client.sendBulkTemplates(
  [
    {
      phoneNumber: '1111111111',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'Alice' }] }
      ]
    },
    {
      phoneNumber: '2222222222',
      components: [
        { type: 'body', parameters: [{ type: 'text', text: 'Bob' }] }
      ]
    }
  ],
  'personalized_greeting',
  'en'
);
```

---

## Media Management

### uploadMedia()

Upload media file to WhatsApp servers.

```typescript
async uploadMedia(
  file: Buffer | ReadableStream,
  mimeType: string
): Promise<MediaUploadResponse>

interface MediaUploadResponse {
  id: string; // Use this ID in sendImage, sendDocument, etc.
}
```

**Example:**
```typescript
const fs = require('fs');
const fileBuffer = fs.readFileSync('./image.jpg');

const upload = await client.uploadMedia(fileBuffer, 'image/jpeg');
await client.sendImage('1234567890', { id: upload.id });
```

### getMediaUrl()

Get downloadable URL for received media.

```typescript
async getMediaUrl(
  mediaId: string
): Promise<MediaUrlResponse>

interface MediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
}
```

**Example:**
```typescript
const mediaInfo = await client.getMediaUrl('media_id_from_webhook');
const mediaBuffer = await fetch(mediaInfo.url).then(r => r.arrayBuffer());
```

### downloadMedia()

Download media file directly.

```typescript
async downloadMedia(
  mediaId: string
): Promise<Buffer>
```

---

## Webhook Processing

### createWebhookProcessor()

Create type-safe webhook handler.

```typescript
createWebhookProcessor(handlers: {
  onTextMessage?: (message: TextMessage) => Promise<void>;
  onImageMessage?: (message: ImageMessage) => Promise<void>;
  onVideoMessage?: (message: VideoMessage) => Promise<void>;
  onAudioMessage?: (message: AudioMessage) => Promise<void>;
  onDocumentMessage?: (message: DocumentMessage) => Promise<void>;
  onButtonClick?: (message: ButtonMessage) => Promise<void>;
  onListSelect?: (message: ListMessage) => Promise<void>;
  onReactionMessage?: (message: ReactionMessage) => Promise<void>;
  onReplyMessage?: (message: ReplyMessage) => Promise<void>;
  onLocationMessage?: (message: LocationMessage) => Promise<void>;
  onContactMessage?: (message: ContactMessage) => Promise<void>;
  onMessageStatusUpdate?: (status: MessageStatus) => Promise<void>;
  onError?: (error: Error, message?: any) => Promise<void>;
  enableMessageBuffering?: boolean;
  bufferDelay?: number;
}): WebhookProcessor

interface WebhookProcessor {
  processWebhook(body: any, query?: any): Promise<ProcessedWebhookResult>;
}
```

**Example:**
```typescript
const processor = client.createWebhookProcessor({
  onTextMessage: async (message) => {
    console.log(`Text from ${message.from}: ${message.text.body}`);

    // Send response
    await client.sendText(message.from, `You said: ${message.text.body}`);
  },

  onReactionMessage: async (message) => {
    console.log(`Reaction: ${message.reaction.emoji} to message ${message.reaction.message_id}`);
  },

  onMessageStatusUpdate: async (status) => {
    console.log(`Message ${status.id} is now ${status.status}`);
    // Status: sent | delivered | read | failed
  },

  onError: async (error) => {
    console.error('Webhook error:', error);
  }
});

// In your API route
export async function POST(req: Request) {
  const body = await req.json();
  await processor.processWebhook(body);
  return new Response('OK', { status: 200 });
}
```

### verifyWebhook()

Verify webhook GET request (initial setup).

```typescript
verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): { status: number; body: string }
```

**Example:**
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const result = client.verifyWebhook(mode!, token!, challenge!);
  return new Response(result.body, { status: result.status });
}
```

---

## Message Status

### getMessageStatus()

Get current status of a sent message.

```typescript
async getMessageStatus(
  messageId: string
): Promise<MessageStatusResponse>

interface MessageStatusResponse {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: number;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}
```

---

## Type Definitions

### Common Types

```typescript
// Incoming message types
interface TextMessage {
  from: string;           // Sender phone number
  id: string;            // Message ID
  timestamp: string;
  text: {
    body: string;
  };
  type: 'text';
}

interface ImageMessage {
  from: string;
  id: string;
  timestamp: string;
  image: {
    id: string;          // Media ID
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  type: 'image';
}

interface ReactionMessage {
  from: string;
  id: string;
  timestamp: string;
  reaction: {
    message_id: string;  // Message being reacted to
    emoji: string;       // Emoji used (empty string = removed)
  };
  type: 'reaction';
}

interface ButtonMessage {
  from: string;
  id: string;
  timestamp: string;
  interactive: {
    type: 'button_reply';
    button_reply: {
      id: string;        // Button ID from sendButtons
      title: string;
    };
  };
  type: 'interactive';
}

interface ListMessage {
  from: string;
  id: string;
  timestamp: string;
  interactive: {
    type: 'list_reply';
    list_reply: {
      id: string;        // Row ID from sendList
      title: string;
      description?: string;
    };
  };
  type: 'interactive';
}
```

### Error Types

```typescript
class WhatsAppApiError extends Error {
  code: number;
  type: string;
  details?: any;
}

class RateLimitError extends WhatsAppApiError {
  retryAfter?: number; // Seconds until retry allowed
}

class MessageValidationError extends Error {
  field: string;
  constraint: string;
}
```

---

## Rate Limits

WhatsApp Business API enforces the following limits:

- **80 messages/second** per phone number
- **1,000 messages/minute** per phone number
- **100,000 messages/day** (varies by tier)

The SDK's broadcast methods handle rate limiting automatically.

---

## Best Practices

### 1. Message IDs
Always store message IDs for tracking:
```typescript
const response = await client.sendText('1234567890', 'Hello');
const messageId = response.messages[0]?.id;
// Store messageId in database for status tracking
```

### 2. Error Handling
```typescript
try {
  await client.sendText('1234567890', 'Hello');
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof WhatsAppApiError) {
    console.error(`API error ${error.code}: ${error.message}`);
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 3. Typing Indicators
Show typing before processing:
```typescript
await client.sendTypingIndicator(phoneNumber);
const response = await generateAIResponse(message); // Takes 3s
await client.sendText(phoneNumber, response);
```

### 4. Reactions for Acknowledgment
```typescript
// Quick acknowledgment while processing
await client.reactWithCheck(from, messageId);

// Process request...
await client.sendText(from, 'Your request is complete!');
```

---

## Migration from Direct API

### Before (Direct API)
```typescript
await fetch(`https://graph.facebook.com/v18.0/${PHONE_ID}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: phoneNumber,
    text: { body: message }
  })
});
```

### After (SDK)
```typescript
await client.sendText(phoneNumber, message);
```

---

## Next Steps

- **[Edge Compatibility Guide](./edge-compatibility-wrapper.md)** - Adapt these patterns for Edge Runtime
- **[Features to Adopt](./features-to-adopt.md)** - Priority implementation guide
- **[Comparison](./comparison.md)** - SDK vs current implementation

---

**Version**: SDK v1.6.0
**Last Updated**: 2025-01-XX
