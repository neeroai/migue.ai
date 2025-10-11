# WhatsApp Flows - Complete Guide (v23.0)

**Last Updated:** October 2025
**API Version:** v23.0
**Data API Version:** 3.0
**Edge Runtime Compatible:** ✅ Yes

---

## Table of Contents

1. [Overview](#overview)
2. [Flow Architecture](#flow-architecture)
3. [Flow Types](#flow-types)
4. [Flow JSON Structure](#flow-json-structure)
5. [Components Reference](#components-reference)
6. [Navigate Flows](#navigate-flows-self-contained)
7. [Data Exchange Flows](#data-exchange-flows-dynamic)
8. [Endpoint Implementation](#endpoint-implementation)
9. [Security & Encryption](#security--encryption)
10. [Use Cases & Examples](#use-cases--examples)
11. [Testing & Debugging](#testing--debugging)
12. [Best Practices](#best-practices)

---

## Overview

WhatsApp Flows enable rich, interactive experiences within WhatsApp conversations. Build multi-screen forms, collect structured data, and create dynamic user journeys—all without leaving the chat.

### What are Flows?

Flows are interactive message experiences that allow you to:
- Create form-based interfaces
- Collect structured user input
- Guide users through multi-step processes
- Exchange data with your backend in real-time
- Provide dynamic, personalized experiences

### Key Features

- **Visual Flow Builder**: Design flows in Meta Business Manager
- **JSON Configuration**: Define screens programmatically
- **Navigate Mode**: Self-contained flows with predefined screens
- **Data Exchange Mode**: Dynamic flows with backend integration
- **Rich Components**: Text inputs, dropdowns, date pickers, checkboxes, etc.
- **Validation**: Built-in and custom validation rules
- **Encryption**: End-to-end encrypted data exchange

---

## Flow Architecture

### Flow Lifecycle

```
1. Flow Creation (Meta Business Manager)
   ↓
2. Flow JSON Configuration
   ↓
3. Flow Trigger (via API)
   ↓
4. User Interaction
   ↓
5. Data Exchange (optional)
   ↓
6. Flow Completion
   ↓
7. Webhook Notification
```

### Components

```
┌─────────────────────────────────────┐
│     Meta Business Manager           │
│  (Flow Builder + Configuration)     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         Flow JSON Schema            │
│  (Screens, Components, Actions)     │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      WhatsApp Cloud API             │
│   (Send Flow Messages)              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│         User's WhatsApp             │
│    (Interactive Experience)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│      Your Backend Endpoint          │
│  (Data Exchange - Optional)         │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│          Webhook Handler            │
│     (Flow Completion Event)         │
└─────────────────────────────────────┘
```

---

## Flow Types

### 1. Navigate Flows (Self-Contained)

**Best For:**
- Lead generation forms
- Surveys and feedback
- Simple data collection
- Static multi-step processes

**Characteristics:**
- All screens defined upfront in Flow JSON
- No backend data exchange during flow
- User navigates through predetermined screens
- Data submitted at the end

**Example Use Cases:**
- Contact form collection
- Product interest surveys
- Newsletter signup
- Basic registration forms

### 2. Data Exchange Flows (Dynamic)

**Best For:**
- Real-time validation
- Dynamic dropdown options
- Availability checks
- Complex business logic

**Characteristics:**
- Connects to your backend endpoint
- Real-time data validation
- Dynamic screen content
- Conditional navigation

**Example Use Cases:**
- Appointment booking (check availability)
- Order placement (inventory checks)
- Authentication flows (OTP verification)
- Dynamic product selection

---

## Flow JSON Structure

### Basic Structure

```json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://example.com/api/whatsapp/flow-endpoint",
  "routing_model": {
    "SURVEY_FORM": ["SCREEN_1", "SCREEN_2", "SUCCESS"]
  },
  "screens": [
    {
      "id": "SCREEN_1",
      "title": "Welcome",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          // Components here
        ]
      }
    }
  ]
}
```

### Key Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `version` | string | Yes | Flow JSON version (current: "5.0") |
| `data_api_version` | string | Yes | Data exchange API version ("3.0") |
| `data_channel_uri` | string | No | Backend endpoint URL (for data exchange) |
| `routing_model` | object | No | Defines flow paths |
| `screens` | array | Yes | Array of screen objects |

---

## Components Reference

### Form Components

#### 1. TextInput

```json
{
  "type": "TextInput",
  "name": "full_name",
  "label": "Full Name",
  "input-type": "text",
  "required": true,
  "helper-text": "Enter your full name as it appears on your ID"
}
```

**Input Types:**
- `text`: General text
- `email`: Email validation
- `number`: Numeric input
- `phone`: Phone number
- `password`: Masked input
- `passcode`: PIN code

#### 2. TextArea

```json
{
  "type": "TextArea",
  "name": "comments",
  "label": "Additional Comments",
  "required": false,
  "helper-text": "Share any additional information"
}
```

#### 3. Dropdown

```json
{
  "type": "Dropdown",
  "name": "service_type",
  "label": "Select Service",
  "required": true,
  "data-source": [
    {
      "id": "consultation",
      "title": "Consultation"
    },
    {
      "id": "checkup",
      "title": "Check-up"
    },
    {
      "id": "treatment",
      "title": "Treatment"
    }
  ]
}
```

#### 4. CheckboxGroup

```json
{
  "type": "CheckboxGroup",
  "name": "preferences",
  "label": "Select your preferences",
  "data-source": [
    {
      "id": "email_updates",
      "title": "Email updates",
      "description": "Receive updates via email"
    },
    {
      "id": "sms_reminders",
      "title": "SMS reminders"
    }
  ],
  "required": false
}
```

#### 5. RadioButtonsGroup

```json
{
  "type": "RadioButtonsGroup",
  "name": "contact_method",
  "label": "Preferred contact method",
  "data-source": [
    {
      "id": "email",
      "title": "Email"
    },
    {
      "id": "phone",
      "title": "Phone"
    },
    {
      "id": "whatsapp",
      "title": "WhatsApp"
    }
  ],
  "required": true
}
```

#### 6. DatePicker

```json
{
  "type": "DatePicker",
  "name": "appointment_date",
  "label": "Select Date",
  "required": true,
  "min-date": "2025-01-01",
  "max-date": "2025-12-31",
  "unavailable-dates": ["2025-12-25", "2025-01-01"]
}
```

#### 7. OptIn

```json
{
  "type": "OptIn",
  "name": "terms_accepted",
  "label": "I agree to the terms and conditions",
  "required": true,
  "on-click-action": {
    "name": "open_url",
    "payload": {
      "url": "https://example.com/terms"
    }
  }
}
```

### Display Components

#### 8. TextHeading

```json
{
  "type": "TextHeading",
  "text": "Appointment Booking"
}
```

#### 9. TextSubheading

```json
{
  "type": "TextSubheading",
  "text": "Please fill in your details"
}
```

#### 10. TextBody

```json
{
  "type": "TextBody",
  "text": "All fields marked with * are required"
}
```

#### 11. TextCaption

```json
{
  "type": "TextCaption",
  "text": "Your information is secure and encrypted"
}
```

#### 12. Image

```json
{
  "type": "Image",
  "src": "https://example.com/images/logo.png",
  "alt-text": "Company Logo",
  "scale-type": "cover"
}
```

### Layout Components

#### 13. Footer

```json
{
  "type": "Footer",
  "label": "Continue",
  "on-click-action": {
    "name": "navigate",
    "next": {
      "type": "screen",
      "name": "SCREEN_2"
    },
    "payload": {}
  }
}
```

#### 14. EmbeddedLink

```json
{
  "type": "EmbeddedLink",
  "text": "View our privacy policy",
  "on-click-action": {
    "name": "open_url",
    "payload": {
      "url": "https://example.com/privacy"
    }
  }
}
```

---

## Navigate Flows (Self-Contained)

### Simple Lead Generation Form

```json
{
  "version": "5.0",
  "screens": [
    {
      "id": "CONTACT_FORM",
      "title": "Contact Information",
      "data": {},
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Get in Touch"
          },
          {
            "type": "TextBody",
            "text": "Fill in your details and we'll get back to you soon."
          },
          {
            "type": "TextInput",
            "name": "full_name",
            "label": "Full Name *",
            "input-type": "text",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "email",
            "label": "Email *",
            "input-type": "email",
            "required": true
          },
          {
            "type": "TextInput",
            "name": "phone",
            "label": "Phone Number",
            "input-type": "phone",
            "required": false
          },
          {
            "type": "TextArea",
            "name": "message",
            "label": "Your Message *",
            "required": true,
            "helper-text": "Tell us how we can help"
          },
          {
            "type": "OptIn",
            "name": "consent",
            "label": "I agree to be contacted",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Submit",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### Send Navigate Flow

```typescript
interface FlowMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'flow';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      name: 'flow';
      parameters: {
        flow_message_version: '3';
        flow_token: string;
        flow_id: string;
        flow_cta: string;
        flow_action: 'navigate';
        flow_action_payload: {
          screen: string;
          data?: Record<string, any>;
        };
      };
    };
  };
}

export async function sendFlow(
  to: string,
  flowId: string,
  screenId: string,
  ctaText: string,
  bodyText: string,
  initialData?: Record<string, any>
): Promise<string | null> {
  const flowToken = crypto.randomUUID();  // Unique token for this flow session

  const payload: FlowMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: {
        text: bodyText
      },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: flowToken,
          flow_id: flowId,
          flow_cta: ctaText,
          flow_action: 'navigate',
          flow_action_payload: {
            screen: screenId,
            data: initialData || {}
          }
        }
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage
await sendFlow(
  '1234567890',
  'FLOW_ID_FROM_META',
  'CONTACT_FORM',
  'Get Started',
  'Share your details with us!'
);
```

### Handle Flow Completion

```typescript
interface FlowCompletionEvent {
  type: 'flow_completion';
  flow_token: string;
  response: Record<string, any>;
}

// Webhook handler
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.value.messages) {
        for (const message of change.value.messages) {
          if (message.type === 'interactive' &&
              message.interactive?.type === 'nfm_reply') {

            const flowData: FlowCompletionEvent = {
              type: 'flow_completion',
              flow_token: message.interactive.nfm_reply.response_json,
              response: JSON.parse(message.interactive.nfm_reply.body)
            };

            await handleFlowCompletion(message.from, flowData);
          }
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
}

async function handleFlowCompletion(
  from: string,
  flowData: FlowCompletionEvent
) {
  const data = flowData.response;

  // Store lead in database
  await db.insert('leads', {
    phone: from,
    full_name: data.full_name,
    email: data.email,
    phone_number: data.phone,
    message: data.message,
    consent: data.consent,
    created_at: new Date()
  });

  // Send confirmation
  await sendWhatsAppText(
    from,
    `Thank you, ${data.full_name}! We've received your message and will get back to you soon. ✅`
  );

  // Notify team
  await notifyTeam({
    type: 'new_lead',
    name: data.full_name,
    email: data.email,
    message: data.message
  });
}
```

---

## Data Exchange Flows (Dynamic)

### Appointment Booking with Real-Time Availability

**Flow JSON:**

```json
{
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://example.com/api/whatsapp/flow-endpoint",
  "screens": [
    {
      "id": "SELECT_SERVICE",
      "title": "Select Service",
      "data": {
        "services": {
          "type": "array",
          "__example__": [
            {"id": "consultation", "title": "Consultation", "price": "$50"}
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "Book an Appointment"
          },
          {
            "type": "Dropdown",
            "name": "selected_service",
            "label": "Select Service",
            "required": true,
            "data-source": "${data.services}"
          },
          {
            "type": "Footer",
            "label": "Next",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "service_id": "${form.selected_service}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "SELECT_DATE",
      "title": "Select Date & Time",
      "data": {
        "available_dates": {
          "type": "array",
          "__example__": ["2025-01-15", "2025-01-16"]
        },
        "available_times": {
          "type": "array",
          "__example__": [
            {"id": "09:00", "title": "9:00 AM"},
            {"id": "10:00", "title": "10:00 AM"}
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "DatePicker",
            "name": "appointment_date",
            "label": "Select Date",
            "required": true,
            "available-dates": "${data.available_dates}"
          },
          {
            "type": "Dropdown",
            "name": "appointment_time",
            "label": "Select Time",
            "required": true,
            "data-source": "${data.available_times}"
          },
          {
            "type": "Footer",
            "label": "Confirm",
            "on-click-action": {
              "name": "complete",
              "payload": {
                "service_id": "${form.selected_service}",
                "date": "${form.appointment_date}",
                "time": "${form.appointment_time}"
              }
            }
          }
        ]
      }
    }
  ]
}
```

---

## Endpoint Implementation

### Flow Endpoint Structure

Your backend endpoint receives encrypted requests and must respond with encrypted data.

```typescript
// app/api/whatsapp/flow-endpoint/route.ts
export const runtime = 'edge';

interface FlowRequest {
  version: string;
  screen: string;
  data: Record<string, any>;
  flow_token: string;
}

interface FlowResponse {
  version: string;
  screen: string;
  data: Record<string, any>;
}

export async function POST(req: Request) {
  try {
    // 1. Decrypt request
    const encryptedBody = await req.text();
    const decrypted = await decryptFlowRequest(encryptedBody);
    const flowRequest: FlowRequest = JSON.parse(decrypted);

    // 2. Process request based on screen
    let responseData: Record<string, any> = {};
    let nextScreen: string = flowRequest.screen;

    switch (flowRequest.screen) {
      case 'SELECT_SERVICE':
        // Fetch available services
        const services = await getAvailableServices();
        responseData = {
          services: services.map(s => ({
            id: s.id,
            title: s.name,
            description: `${s.duration} min - $${s.price}`
          }))
        };
        break;

      case 'SELECT_DATE':
        // Fetch available dates/times for selected service
        const serviceId = flowRequest.data.service_id;
        const availability = await getServiceAvailability(serviceId);

        responseData = {
          available_dates: availability.dates,
          available_times: availability.times.map(t => ({
            id: t.time,
            title: formatTime(t.time)
          }))
        };
        nextScreen = 'SELECT_DATE';
        break;

      default:
        return new Response('Unknown screen', { status: 400 });
    }

    // 3. Build response
    const response: FlowResponse = {
      version: flowRequest.version,
      screen: nextScreen,
      data: responseData
    };

    // 4. Encrypt response
    const encrypted = await encryptFlowResponse(JSON.stringify(response));

    return new Response(encrypted, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Flow endpoint error:', error);
    return new Response('Internal error', { status: 500 });
  }
}
```

### Helper Functions

```typescript
async function getAvailableServices() {
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name');

  return data || [];
}

async function getServiceAvailability(serviceId: string) {
  const service = await supabase
    .from('services')
    .select('duration')
    .eq('id', serviceId)
    .single();

  if (!service.data) {
    throw new Error('Service not found');
  }

  // Get available dates (next 30 days, excluding weekends)
  const dates: string[] = [];
  const startDate = new Date();

  for (let i = 0; i < 30; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // Skip weekends
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(date.toISOString().split('T')[0]!);
    }
  }

  // Get available times (9 AM - 5 PM, hourly)
  const times = [];
  for (let hour = 9; hour < 17; hour++) {
    times.push({
      time: `${hour.toString().padStart(2, '0')}:00`,
      available: await checkSlotAvailability(serviceId, hour)
    });
  }

  return {
    dates,
    times: times.filter(t => t.available)
  };
}

async function checkSlotAvailability(
  serviceId: string,
  hour: number
): Promise<boolean> {
  // Check if slot is already booked
  const { count } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('service_id', serviceId)
    .eq('hour', hour);

  return (count || 0) === 0;
}

function formatTime(time: string): string {
  const [hour] = time.split(':');
  const h = parseInt(hour!);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}
```

---

## Security & Encryption

### WhatsApp Business Encryption

All flow data exchange is encrypted using asymmetric encryption.

### Generate Key Pair

```bash
# Generate private key
openssl ecparam -genkey -name prime256v1 -noout -out private_key.pem

# Extract public key
openssl ec -in private_key.pem -pubout -out public_key.pem

# Get public key in base64
cat public_key.pem | grep -v "BEGIN\|END" | tr -d '\n'
```

### Upload Public Key to Meta

```typescript
async function uploadPublicKey(publicKeyBase64: string) {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${process.env.WHATSAPP_BUSINESS_ID}/subscribed_apps`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        business_public_key: publicKeyBase64
      })
    }
  );

  if (!response.ok) {
    throw new Error('Failed to upload public key');
  }

  return response.json();
}
```

### Decrypt Flow Request

```typescript
import crypto from 'crypto';

export function decryptFlowRequest(encrypted: string): string {
  const privateKey = process.env.FLOW_PRIVATE_KEY!;

  const parts = encrypted.split('.');
  const encryptedAESKey = Buffer.from(parts[0]!, 'base64');
  const iv = Buffer.from(parts[1]!, 'base64');
  const encryptedData = Buffer.from(parts[2]!, 'base64');
  const tag = Buffer.from(parts[3]!, 'base64');

  // Decrypt AES key using private key
  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    encryptedAESKey
  );

  // Decrypt data using AES
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedData, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Encrypt Flow Response

```typescript
export function encryptFlowResponse(data: string): string {
  const publicKey = process.env.FLOW_PUBLIC_KEY!;

  // Generate random AES key
  const aesKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  // Encrypt data with AES
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  let encrypted = cipher.update(data, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Encrypt AES key with public key
  const encryptedKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    aesKey
  );

  // Combine: encryptedKey.iv.encryptedData.tag
  return [
    encryptedKey.toString('base64'),
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64')
  ].join('.');
}
```

---

## Use Cases & Examples

### 1. Customer Feedback Survey

```json
{
  "version": "5.0",
  "screens": [
    {
      "id": "FEEDBACK",
      "title": "Feedback",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextHeading",
            "text": "How was your experience?"
          },
          {
            "type": "RadioButtonsGroup",
            "name": "satisfaction",
            "label": "Overall Satisfaction",
            "required": true,
            "data-source": [
              {"id": "5", "title": "Excellent ⭐⭐⭐⭐⭐"},
              {"id": "4", "title": "Good ⭐⭐⭐⭐"},
              {"id": "3", "title": "Average ⭐⭐⭐"},
              {"id": "2", "title": "Poor ⭐⭐"},
              {"id": "1", "title": "Very Poor ⭐"}
            ]
          },
          {
            "type": "TextArea",
            "name": "comments",
            "label": "Additional Comments",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Submit Feedback",
            "on-click-action": {
              "name": "complete",
              "payload": {}
            }
          }
        ]
      }
    }
  ]
}
```

### 2. Product Order Form

```typescript
// Dynamic product selection with inventory checks
const orderFlowJSON = {
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://example.com/api/whatsapp/order-flow",
  "screens": [
    {
      "id": "SELECT_PRODUCT",
      "title": "Select Product",
      "data": {
        "products": {
          "type": "array",
          "__example__": [
            {
              "id": "prod_1",
              "title": "Product 1",
              "description": "$99.99 - In Stock"
            }
          ]
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "Dropdown",
            "name": "product",
            "label": "Select Product",
            "required": true,
            "data-source": "${data.products}"
          },
          {
            "type": "TextInput",
            "name": "quantity",
            "label": "Quantity",
            "input-type": "number",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Add to Cart",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "product_id": "${form.product}",
                "quantity": "${form.quantity}"
              }
            }
          }
        ]
      }
    }
  ]
};
```

### 3. Authentication Flow (OTP)

```typescript
// Two-step authentication with OTP verification
const authFlowJSON = {
  "version": "5.0",
  "data_api_version": "3.0",
  "data_channel_uri": "https://example.com/api/whatsapp/auth-flow",
  "screens": [
    {
      "id": "REQUEST_OTP",
      "title": "Verify Your Number",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "phone",
            "label": "Phone Number",
            "input-type": "phone",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Send Code",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "action": "request_otp",
                "phone": "${form.phone}"
              }
            }
          }
        ]
      }
    },
    {
      "id": "VERIFY_OTP",
      "title": "Enter Code",
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "otp",
            "label": "Verification Code",
            "input-type": "passcode",
            "required": true
          },
          {
            "type": "Footer",
            "label": "Verify",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "action": "verify_otp",
                "otp": "${form.otp}"
              }
            }
          }
        ]
      }
    }
  ]
};
```

---

## Testing & Debugging

### Test Flow in WhatsApp

```typescript
// Send test flow to your own number
async function testFlow() {
  const testNumber = process.env.TEST_PHONE_NUMBER!;

  await sendFlow(
    testNumber,
    process.env.FLOW_ID!,
    'SCREEN_1',
    'Start Test',
    'This is a test flow. Please complete and verify.'
  );

  console.log('Test flow sent to', testNumber);
}
```

### Debug Flow Endpoint

```typescript
// Log all flow requests for debugging
export async function POST(req: Request) {
  const body = await req.text();

  console.log('Flow request received:', {
    timestamp: new Date().toISOString(),
    bodyLength: body.length
  });

  try {
    const decrypted = await decryptFlowRequest(body);
    console.log('Decrypted request:', decrypted);

    const flowRequest = JSON.parse(decrypted);
    console.log('Parsed flow request:', flowRequest);

    // ... process request

  } catch (error) {
    console.error('Flow endpoint error:', error);
    return new Response('Error', { status: 500 });
  }
}
```

### Common Issues

**1. Encryption Errors**
- Verify public key uploaded to Meta
- Check private key format (PEM)
- Ensure key pair matches

**2. Screen Not Loading**
- Check screen ID in flow JSON
- Verify data schema matches
- Test with simple static data first

**3. Data Exchange Fails**
- Check endpoint URL accessibility
- Verify response encryption
- Test endpoint independently

---

## Best Practices

### 1. User Experience

- ✅ Keep flows short (max 3-4 screens)
- ✅ Use clear, concise labels
- ✅ Provide helpful helper text
- ✅ Show progress indicators
- ✅ Enable back navigation where possible
- ❌ Don't ask for unnecessary information
- ❌ Don't use complex validation rules

### 2. Performance

- ✅ Cache static dropdown data
- ✅ Minimize data exchange calls
- ✅ Use pagination for long lists
- ✅ Optimize endpoint response time (<2s)
- ❌ Don't fetch all data upfront
- ❌ Don't make synchronous external API calls

### 3. Security

- ✅ Validate all user input
- ✅ Sanitize data before database insertion
- ✅ Use HTTPS for endpoint
- ✅ Rotate encryption keys periodically
- ✅ Implement rate limiting
- ❌ Don't trust client-side validation alone
- ❌ Don't store sensitive data in flow state

### 4. Error Handling

```typescript
// Graceful error handling in flow endpoint
export async function POST(req: Request) {
  try {
    const flowRequest = await parseFlowRequest(req);

    const response = await processFlowRequest(flowRequest);

    return encryptedResponse(response);

  } catch (error) {
    console.error('Flow error:', error);

    // Return error screen
    return encryptedResponse({
      screen: 'ERROR',
      data: {
        error_message: 'Something went wrong. Please try again.'
      }
    });
  }
}
```

---

## Summary

WhatsApp Flows enable powerful interactive experiences:

- ✅ **Navigate Flows**: Self-contained forms and surveys
- ✅ **Data Exchange**: Real-time backend integration
- ✅ **Rich Components**: 14+ input and display components
- ✅ **Security**: End-to-end encrypted data exchange
- ✅ **Flexibility**: Custom business logic and validation

### Key Takeaways

1. Use **Navigate mode** for simple data collection
2. Use **Data Exchange mode** for dynamic, real-time flows
3. Always **encrypt** sensitive data
4. Keep flows **short and focused** (3-4 screens max)
5. **Test thoroughly** before production
6. **Monitor performance** and user completion rates

### Related Documentation

- [API Reference](./whatsapp-api-v23-reference.md) - Complete API documentation
- [Advanced Features](./whatsapp-api-v23-advanced.md) - Advanced patterns
- [Migration Guide](./whatsapp-api-v23-migration.md) - Upgrade to v23.0
- [Meta Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)

---

**Last Updated:** October 2025
**Version:** 1.0.0
