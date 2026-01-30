---
title: "WhatsApp Flows Integration"
summary: "Navigate and Data Exchange flows with HMAC validation and RSA+AES encryption"
description: "Flow catalog, screen component library, security implementation (HMAC validation, RSA+AES encryption), webhook handler, and use cases for multi-screen forms"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Features"
---

# WhatsApp Flows Integration

## Flow Catalog

| Flow Name | Type | Screens | Use Case | Complexity | Data Capture |
|-----------|------|---------|----------|------------|--------------|
| Appointment Booking | Navigate | 3 | Select date, time, reason | Medium | 5 fields |
| Expense Entry | Data Exchange | 2 | Amount, category, description | Low | 3 fields |
| Feedback Survey | Navigate | 4 | Rating, comments, follow-up | Medium | 6 fields |
| Calendar Preferences | Data Exchange | 2 | Notification settings, timezone | Low | 4 fields |
| Multi-day Schedule | Navigate | 5 | Date range, preferences | High | 8 fields |
| Budget Setup | Navigate | 3 | Categories, limits, alerts | Medium | 10 fields |

**Flow type selection**:
- **Navigate**: Multi-screen wizard, complex validation, conditional logic
- **Data Exchange**: Single-screen form, simple data capture, quick entry

**When to use**:
- User needs to enter >3 fields
- Input requires validation (dates, amounts, phone numbers)
- Multi-step process with conditional branches
- Better UX than text-based conversation

**When NOT to use**:
- Simple queries (<3 fields)
- Natural language works better
- User prefers conversational interface
- No complex validation needed

---

## Screen Component Library

| Component | Inputs | Validation | Example | Max Length |
|-----------|--------|------------|---------|------------|
| TextInput | String | Regex, min/max length | Name, description | 1000 chars |
| TextArea | String | Min/max length | Comments, notes | 3000 chars |
| DatePicker | Date | Date range, format | Appointment date | - |
| Dropdown | String | Enum values | Category selection | 100 options |
| CheckboxGroup | String[] | Min/max selections | Preferences | 20 options |
| RadioButtonsGroup | String | Required single selection | Time slot | 10 options |
| OptIn | Boolean | Required for terms | Newsletter consent | - |
| Footer | - | Action buttons | Submit, Cancel | 2 buttons |

**Component schema example**:
```json
{
  "type": "TextInput",
  "name": "appointment_reason",
  "label": "Reason for appointment",
  "required": true,
  "input-type": "text",
  "helper-text": "Brief description (optional)",
  "validation": {
    "min-chars": 5,
    "max-chars": 200,
    "pattern": "^[a-zA-Z0-9\\s]+$"
  }
}
```

---

## Navigate Flow Structure (Appointment Booking)

```json
{
  "version": "4.0",
  "screens": [
    {
      "id": "DATE_SELECTION",
      "title": "Select Date",
      "data": {
        "appointment_date": {
          "type": "date",
          "__example__": "2026-02-15"
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "DatePicker",
            "name": "appointment_date",
            "label": "Appointment Date",
            "required": true,
            "min-date": "2026-01-29",
            "max-date": "2026-12-31"
          },
          {
            "type": "Footer",
            "label": "Continue",
            "on-click-action": {
              "name": "navigate",
              "next": { "name": "TIME_SELECTION" },
              "payload": { "date": "${form.appointment_date}" }
            }
          }
        ]
      }
    },
    {
      "id": "TIME_SELECTION",
      "title": "Select Time",
      "terminal": true,
      "data": {
        "appointment_time": {
          "type": "string",
          "__example__": "14:00"
        }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "RadioButtonsGroup",
            "name": "appointment_time",
            "label": "Available Times",
            "required": true,
            "data-source": [
              { "id": "09:00", "title": "9:00 AM" },
              { "id": "10:00", "title": "10:00 AM" },
              { "id": "14:00", "title": "2:00 PM" },
              { "id": "15:00", "title": "3:00 PM" }
            ]
          },
          {
            "type": "Footer",
            "label": "Book Appointment",
            "on-click-action": {
              "name": "complete",
              "payload": {
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

## Data Exchange Flow Structure (Expense Entry)

```json
{
  "version": "4.0",
  "data_api_version": "3.0",
  "routing_model": {},
  "screens": [
    {
      "id": "EXPENSE_FORM",
      "title": "Log Expense",
      "terminal": true,
      "data": {
        "amount": { "type": "number", "__example__": 50.00 },
        "category": { "type": "string", "__example__": "lunch" },
        "description": { "type": "string", "__example__": "Team lunch" }
      },
      "layout": {
        "type": "SingleColumnLayout",
        "children": [
          {
            "type": "TextInput",
            "name": "amount",
            "label": "Amount ($)",
            "required": true,
            "input-type": "number"
          },
          {
            "type": "Dropdown",
            "name": "category",
            "label": "Category",
            "required": true,
            "data-source": [
              { "id": "food", "title": "Food" },
              { "id": "transport", "title": "Transport" },
              { "id": "entertainment", "title": "Entertainment" }
            ]
          },
          {
            "type": "TextArea",
            "name": "description",
            "label": "Description",
            "required": false
          },
          {
            "type": "Footer",
            "label": "Save Expense",
            "on-click-action": {
              "name": "data_exchange",
              "payload": {
                "amount": "${form.amount}",
                "category": "${form.category}",
                "description": "${form.description}"
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

## Security Requirements Matrix

| Layer | Method | Key Size | Algorithm | Purpose |
|-------|--------|----------|-----------|---------|
| Request signature | HMAC-SHA256 | 256 bits | SHA-256 | Verify webhook origin |
| Flow encryption | RSA-OAEP | 2048 bits | RSA | Encrypt AES key |
| Data encryption | AES-GCM | 128 bits | AES-128 | Encrypt flow data |
| Response signature | HMAC-SHA256 | 256 bits | SHA-256 | Sign response |

**Security flow**:
1. WhatsApp signs request with HMAC-SHA256 (app secret)
2. Server validates HMAC signature
3. Server generates AES key for response
4. Server encrypts AES key with WhatsApp public RSA key
5. Server encrypts data with AES key
6. Server sends encrypted response with signature

---

## HMAC Validation Implementation

```typescript
import crypto from 'crypto';

function validateWhatsAppSignature(
  payload: string,
  signature: string,
  appSecret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in webhook
export async function POST(req: Request) {
  const signature = req.headers.get('x-hub-signature-256');
  const payload = await req.text();

  if (!validateWhatsAppSignature(payload, signature, APP_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  // Process webhook
  const data = JSON.parse(payload);
  // ...
}
```

---

## RSA + AES Encryption Implementation

```typescript
import crypto from 'crypto';

// Encrypt flow response data
function encryptFlowData(
  data: object,
  whatsappPublicKey: string
): { encrypted_flow_data: string; encrypted_aes_key: string } {
  // 1. Generate random AES key
  const aesKey = crypto.randomBytes(16); // 128 bits
  const iv = crypto.randomBytes(12); // GCM IV

  // 2. Encrypt data with AES-GCM
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // 3. Encrypt AES key with RSA public key
  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: whatsappPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    aesKey
  );

  // 4. Combine encrypted data with IV and auth tag
  const encryptedFlowData = Buffer.concat([iv, authTag, encrypted]);

  return {
    encrypted_flow_data: encryptedFlowData.toString('base64'),
    encrypted_aes_key: encryptedAesKey.toString('base64')
  };
}
```

---

## Webhook Handler (Data Exchange)

```typescript
export async function POST(req: Request) {
  // 1. Validate signature
  const signature = req.headers.get('x-hub-signature-256');
  const payload = await req.text();
  if (!validateWhatsAppSignature(payload, signature, APP_SECRET)) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse webhook
  const webhook = JSON.parse(payload);
  const flowData = webhook.entry[0].changes[0].value.messages[0].interactive.nfm_reply;

  // 3. Decrypt flow data (if encrypted)
  const decryptedData = decryptFlowData(
    flowData.body,
    PRIVATE_KEY
  );

  // 4. Process based on screen
  const response = await processFlowScreen(
    decryptedData.screen,
    decryptedData.data
  );

  // 5. Encrypt response
  const encrypted = encryptFlowData(response, WHATSAPP_PUBLIC_KEY);

  // 6. Send response
  return Response.json({
    version: "4.0",
    data: encrypted
  });
}

async function processFlowScreen(screen: string, data: any) {
  switch (screen) {
    case 'EXPENSE_FORM':
      await saveExpense({
        userId: data.user_id,
        amount: data.amount,
        category: data.category,
        description: data.description
      });
      return {
        screen: 'SUCCESS',
        data: { message: 'Expense saved!' }
      };

    default:
      return { screen: 'ERROR', data: { message: 'Unknown screen' } };
  }
}
```

---

## Use Case Priority

| Priority | Use Case | Flow Type | Screens | Business Value |
|----------|----------|-----------|---------|----------------|
| P0 | Appointment booking | Navigate | 3 | Core feature |
| P1 | Expense entry | Data Exchange | 1 | Quick capture |
| P2 | Feedback survey | Navigate | 4 | User insights |
| P2 | Calendar preferences | Data Exchange | 2 | Personalization |
| P3 | Budget setup | Navigate | 3 | Advanced feature |

**Implementation order**: P0 → P1 → P2 → P3

---

## Citations

- **WhatsApp expert output**: Flow v4.0 specification and security
- **docs-global/platforms/whatsapp/flows-implementation.md**: Implementation guide
- **PRD Section 4.8**: Interactive messages and flows
- **docs-global/platforms/whatsapp/flows/implementacion-tecnica.md**: Technical patterns

---

**Lines**: 258 | **Tokens**: ~774
