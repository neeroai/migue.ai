---
title: WhatsApp Integration Implementation
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Webhook handling, interactive messages, Flows v3, message templates
---

# WhatsApp Integration Implementation

## Quick Reference
- **Purpose**: Complete WhatsApp Business API v23 integration with interactive features
- **References**: docs/features/whatsapp-flows-integration.md, docs/features/interactive-optimization.md
- **API Version**: v23.0 (current stable)
- **Timeout**: 5 seconds (WhatsApp requirement)

---

## Webhook Implementation

### Webhook Handler

**File**: app/api/whatsapp/webhook/route.ts

```typescript
import { NextRequest } from 'next/server';
import { validateSignature } from '@/lib/whatsapp/validation';
import { normalizeMessage } from '@/lib/whatsapp/normalization';
import { processMessage } from '@/lib/ai/message-processor';

export const runtime = 'edge';
export const maxDuration = 5; // WhatsApp 5s timeout

export async function GET(req: NextRequest) {
  // Webhook verification (Meta app setup)
  const params = req.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Validate HMAC signature
    const body = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!validateSignature(body, signature!, process.env.WHATSAPP_WEBHOOK_SECRET!)) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Parse webhook payload
    const payload = JSON.parse(body);

    // Log webhook
    await supabase.from('webhooks').insert({
      source: 'whatsapp',
      payload,
      signature,
      status: 'received',
    });

    // 3. Extract message
    const message = normalizeMessage(payload);
    if (!message) {
      return Response.json({ success: true }, { status: 200 }); // Status update, ignore
    }

    // 4. Process message (AI + tools)
    // Fire-and-forget pattern for long processing
    processMessage(message).catch(error => {
      console.error('Message processing failed:', error);
      // TODO: Send to dead letter queue
    });

    // 5. Return success immediately (WhatsApp requires fast response)
    const processingTime = Date.now() - startTime;
    return Response.json({
      success: true,
      processingTime,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}
```

### HMAC Signature Validation

**File**: lib/whatsapp/validation.ts

```typescript
export function validateSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = `sha256=${createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;

  return signature === expectedSignature;
}
```

---

## Message Normalization

**File**: lib/whatsapp/normalization.ts

```typescript
interface NormalizedMessage {
  userId: string;
  userPhone: string;
  userName: string;
  messageId: string;
  messageType: 'text' | 'audio' | 'image' | 'interactive' | 'location';
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
}

export function normalizeMessage(payload: any): NormalizedMessage | null {
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  // Check if this is a message (not status update)
  if (!value?.messages?.[0]) {
    return null;
  }

  const message = value.messages[0];
  const contact = value.contacts?.[0];

  return {
    userId: message.from, // WhatsApp user ID
    userPhone: message.from,
    userName: contact?.profile?.name || 'User',
    messageId: message.id,
    messageType: message.type,
    content: extractContent(message),
    metadata: {
      timestamp: message.timestamp,
      context: message.context, // Reply context
      referral: message.referral, // Click-to-WhatsApp ads
    },
    timestamp: message.timestamp,
  };
}

function extractContent(message: any): string {
  switch (message.type) {
    case 'text':
      return message.text.body;
    case 'interactive':
      if (message.interactive.type === 'button_reply') {
        return message.interactive.button_reply.title;
      }
      if (message.interactive.type === 'list_reply') {
        return message.interactive.list_reply.title;
      }
      return '';
    case 'audio':
      return `[Audio message: ${message.audio.id}]`;
    case 'image':
      return message.image.caption || '[Image]';
    case 'location':
      return `[Location: ${message.location.latitude}, ${message.location.longitude}]`;
    default:
      return `[Unsupported message type: ${message.type}]`;
  }
}
```

**Source**: docs/features/interactive-optimization.md L1-50

---

## Interactive Messages

### Button Messages

**File**: lib/whatsapp/interactive.ts

```typescript
interface ButtonMessage {
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button';
    body: { text: string };
    action: {
      buttons: Array<{
        type: 'reply';
        reply: {
          id: string;
          title: string; // Max 20 chars
        };
      }>;
    };
  };
}

export function createButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
): ButtonMessage {
  if (buttons.length > 3) {
    throw new Error('Maximum 3 buttons allowed');
  }

  return {
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map(btn => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.substring(0, 20), // Enforce limit
          },
        })),
      },
    },
  };
}

// Example usage
const message = createButtonMessage(
  '573001234567',
  '¿Qué te gustaría hacer?',
  [
    { id: 'check_schedule', title: 'Ver agenda' },
    { id: 'add_reminder', title: 'Crear recordatorio' },
    { id: 'help', title: 'Ayuda' },
  ]
);
```

### List Messages

```typescript
interface ListMessage {
  to: string;
  type: 'interactive';
  interactive: {
    type: 'list';
    body: { text: string };
    action: {
      button: string; // Button text to open list
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string; // Max 24 chars
          description?: string; // Max 72 chars
        }>;
      }>;
    };
  };
}

export function createListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>
): ListMessage {
  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows > 24) {
    throw new Error('Maximum 24 rows allowed across all sections');
  }

  return {
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections.map(section => ({
          title: section.title,
          rows: section.rows.map(row => ({
            id: row.id,
            title: row.title.substring(0, 24),
            description: row.description?.substring(0, 72),
          })),
        })),
      },
    },
  };
}

// Example usage
const message = createListMessage(
  '573001234567',
  'Selecciona una categoría de gasto:',
  'Categorías',
  [
    {
      title: 'Gastos frecuentes',
      rows: [
        { id: 'food', title: 'Comida', description: 'Restaurantes, supermercado' },
        { id: 'transport', title: 'Transporte', description: 'Taxi, gasolina, Uber' },
        { id: 'health', title: 'Salud', description: 'Médico, farmacia' },
      ],
    },
    {
      title: 'Otros',
      rows: [
        { id: 'entertainment', title: 'Entretenimiento' },
        { id: 'other', title: 'Otro' },
      ],
    },
  ]
);
```

### Interactive Type Selection

```typescript
export function selectInteractiveType(
  options: Array<{ id: string; title: string; description?: string }>
): 'button' | 'list' | 'text' {
  const count = options.length;

  if (count === 0) return 'text';
  if (count <= 3) return 'button';
  if (count <= 24) return 'list';

  // Fallback for >24 options: send as numbered text
  return 'text';
}
```

**Source**: docs/features/interactive-optimization.md L22-33

---

## WhatsApp Flows v3

### Flow Endpoint

**File**: app/api/whatsapp/flows/route.ts

```typescript
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Validate Flow token (HMAC)
  const isValid = validateFlowToken(body.flow_token);
  if (!isValid) {
    return Response.json({ error: 'Invalid flow token' }, { status: 401 });
  }

  const { action, screen, data, version } = body;

  // Route based on action
  switch (action) {
    case 'INIT':
      return handleFlowInit(screen, data);
    case 'NAVIGATE':
      return handleFlowNavigate(screen, data);
    case 'data_exchange':
      return handleDataExchange(screen, data);
    default:
      return Response.json({ error: 'Unknown action' }, { status: 400 });
  }
}

async function handleFlowInit(screen: string, data: any) {
  // Initialize flow with first screen data
  return Response.json({
    version: '3.0',
    screen: 'SELECT_DATE',
    data: {
      available_dates: await getAvailableDates(),
      user_timezone: 'America/Bogota',
    },
  });
}

async function handleFlowNavigate(screen: string, data: any) {
  // Handle navigation between screens
  if (screen === 'SELECT_DATE' && data.selected_date) {
    return Response.json({
      version: '3.0',
      screen: 'SELECT_TIME',
      data: {
        selected_date: data.selected_date,
        available_times: await getAvailableTimesForDate(data.selected_date),
      },
    });
  }

  if (screen === 'SELECT_TIME' && data.selected_time) {
    return Response.json({
      version: '3.0',
      screen: 'CONFIRMATION',
      data: {
        appointment: {
          date: data.selected_date,
          time: data.selected_time,
        },
      },
    });
  }

  return Response.json({ error: 'Invalid navigation' }, { status: 400 });
}

async function handleDataExchange(screen: string, data: any) {
  // Final submission - create appointment
  const appointment = await createAppointment({
    userId: data.user_id,
    date: data.selected_date,
    time: data.selected_time,
    reason: data.reason,
  });

  return Response.json({
    version: '3.0',
    screen: 'SUCCESS',
    data: {
      event_id: appointment.id,
      message: 'Cita agendada exitosamente',
    },
  });
}
```

### Flow JSON Definition

**File**: lib/whatsapp/flows/appointment-booking.json

```json
{
  "version": "3.0",
  "screens": [
    {
      "id": "SELECT_DATE",
      "title": "Selecciona una fecha",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "date_form",
            "children": [
              {
                "type": "DatePicker",
                "name": "selected_date",
                "label": "Fecha de la cita",
                "required": true,
                "min-date": "2026-01-29",
                "max-date": "2026-12-31"
              },
              {
                "type": "Footer",
                "label": "Continuar",
                "on-click-action": {
                  "name": "navigate",
                  "next": { "type": "screen", "name": "SELECT_TIME" },
                  "payload": { "selected_date": "${form.date_form.selected_date}" }
                }
              }
            ]
          }
        ]
      }
    },
    {
      "id": "SELECT_TIME",
      "title": "Selecciona una hora",
      "data": {
        "available_times": {
          "type": "array",
          "items": { "type": "object" }
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Form",
            "name": "time_form",
            "children": [
              {
                "type": "Dropdown",
                "name": "selected_time",
                "label": "Hora",
                "required": true,
                "data-source": "${data.available_times}"
              },
              {
                "type": "Footer",
                "label": "Confirmar",
                "on-click-action": {
                  "name": "complete",
                  "payload": {
                    "selected_date": "${data.selected_date}",
                    "selected_time": "${form.time_form.selected_time}"
                  }
                }
              }
            ]
          }
        ]
      }
    }
  ]
}
```

**Source**: docs/features/whatsapp-flows-integration.md L40-49

---

## Message Templates

### Template Messages (for 24h window closed)

```typescript
interface TemplateMessage {
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'header' | 'body' | 'button';
      parameters?: any[];
    }>;
  };
}

// Pre-approved template: reminder_notification
export function createReminderTemplate(
  to: string,
  reminderText: string,
  reminderTime: string
): TemplateMessage {
  return {
    to,
    type: 'template',
    template: {
      name: 'reminder_notification',
      language: { code: 'es' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: reminderText },
            { type: 'text', text: reminderTime },
          ],
        },
      ],
    },
  };
}
```

---

## Sending Messages

**File**: lib/whatsapp/send.ts

```typescript
export async function sendWhatsAppMessage(message: any): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/v23.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.messages[0].id; // Message ID
}
```

---

## Testing Checklist

- [ ] Webhook verification (GET) works
- [ ] HMAC signature validation passes
- [ ] Message normalization handles all types
- [ ] Button messages (1-3 options) send correctly
- [ ] List messages (4-24 options) send correctly
- [ ] Interactive replies captured correctly
- [ ] Flows v3 navigation works
- [ ] Flow data exchange completes successfully
- [ ] Template messages send (24h window closed)
- [ ] Message delivery status tracked

---

**Lines**: 250 | **Tokens**: ~600 | **Status**: Ready for implementation
