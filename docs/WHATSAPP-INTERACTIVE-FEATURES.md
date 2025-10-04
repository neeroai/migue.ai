# WhatsApp Interactive Features - Advanced Implementation Guide

This document covers advanced WhatsApp Cloud API interactive features not yet implemented in migue.ai, based on analysis of the [whatsapp-api-js](https://github.com/Secreto31126/whatsapp-api-js) library and WhatsApp Cloud API documentation.

## Table of Contents

- [Currently Implemented Features](#currently-implemented-features)
- [Advanced Features to Implement](#advanced-features-to-implement)
  - [Call-to-Action (CTA) Buttons](#call-to-action-cta-buttons)
  - [Location Request Messages](#location-request-messages)
  - [Call Permission Requests](#call-permission-requests)
  - [WhatsApp Flows](#whatsapp-flows)
  - [Product Catalogs](#product-catalogs)
- [Implementation Priority Matrix](#implementation-priority-matrix)
- [Edge Runtime Compatibility](#edge-runtime-compatibility)

---

## Currently Implemented Features

✅ **Interactive Buttons** - Up to 3 reply buttons with IDs and titles
✅ **Interactive Lists** - Multiple selectable options with descriptions
✅ **Reactions** - Emoji reactions to messages
✅ **Typing Indicators** - Show "typing..." status
✅ **Read Receipts** - Mark messages as read
✅ **Text Messages** - Basic text with formatting
✅ **Media Messages** - Images, documents, audio, video

**Implementation:** See `lib/whatsapp.ts` for current implementations.

---

## Advanced Features to Implement

### Call-to-Action (CTA) Buttons

**What it is:** Interactive buttons that open external URLs when tapped.

**Use cases:**
- Link to website/landing page
- Open Google Maps location
- Direct to payment page
- Access external forms/resources

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "cta_url",
    "action": {
      "name": "cta_url",
      "parameters": {
        "display_text": "Visit Website",
        "url": "https://example.com"
      }
    },
    "body": {
      "text": "Check out our latest products!"
    },
    "header": {
      "type": "text",
      "text": "New Products Available"
    },
    "footer": {
      "text": "Powered by migue.ai"
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send a Call-to-Action (CTA) button message with a URL
 * Compatible with Edge Runtime
 */
export async function sendCTAButton(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  options?: {
    header?: string;
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonText,
            url
          }
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header }
        }),
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp CTA error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending CTA button:', error);
    return null;
  }
}
```

**Usage Example:**
```typescript
// Send CTA button with URL
await sendCTAButton(
  '1234567890',
  'Visit our website to see our latest products and special offers!',
  'Shop Now',
  'https://shop.example.com',
  {
    header: 'New Collection Available',
    footer: 'Limited time offer'
  }
);
```

**Webhook Response (when user taps button):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "type": "interactive",
          "interactive": {
            "type": "button_reply",
            "button_reply": {
              "id": "cta_url",
              "title": "Shop Now"
            }
          }
        }]
      }
    }]
  }]
}
```

**Zod Schema for Validation:**
```typescript
// Add to types/schemas.ts
const CTAButtonReplySchema = z.object({
  type: z.literal('button_reply'),
  button_reply: z.object({
    id: z.string(),
    title: z.string()
  })
});
```

---

### Location Request Messages

**What it is:** Interactive message requesting the user to share their location with permission.

**Use cases:**
- Delivery services - get user's address
- Service businesses - find nearby locations
- Event check-ins
- Store locators

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "location_request_message",
    "body": {
      "text": "Please share your location for delivery"
    },
    "action": {
      "name": "send_location"
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Request user's location with permission
 * Compatible with Edge Runtime
 */
export async function requestLocation(
  to: string,
  bodyText: string,
  options?: {
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: {
          name: 'send_location'
        },
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp location request error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error requesting location:', error);
    return null;
  }
}
```

**Usage Example:**
```typescript
// Request user location for delivery
await requestLocation(
  '1234567890',
  'To complete your order, please share your delivery location',
  { footer: 'Your location is secure and only used for this delivery' }
);
```

**Webhook Response (when user shares location):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "type": "location",
          "location": {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "name": "Market Street",
            "address": "123 Market St, San Francisco, CA"
          }
        }]
      }
    }]
  }]
}
```

**Zod Schema for Validation:**
```typescript
// Add to types/schemas.ts
const LocationMessageSchema = z.object({
  type: z.literal('location'),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional()
  })
});
```

---

### Call Permission Requests

**What it is:** Request permission to call the user via WhatsApp voice/video call.

**Use cases:**
- Customer support - urgent issues
- Consultation services
- Sales follow-ups
- Emergency notifications

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "call_permission_request",
    "body": {
      "text": "Can we call you to discuss your order?"
    },
    "action": {
      "name": "request_call_permission"
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Request permission to call user
 * Compatible with Edge Runtime
 */
export async function requestCallPermission(
  to: string,
  bodyText: string,
  options?: {
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        body: { text: bodyText },
        action: {
          name: 'request_call_permission'
        },
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp call permission error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error requesting call permission:', error);
    return null;
  }
}
```

**Usage Example:**
```typescript
// Request call permission for urgent support
await requestCallPermission(
  '1234567890',
  'We noticed an issue with your order. May we call you to resolve it quickly?',
  { footer: 'Call duration: approximately 5 minutes' }
);
```

**Webhook Response (when user grants permission):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "type": "interactive",
          "interactive": {
            "type": "call_permission_reply",
            "call_permission_reply": {
              "permission": "granted"
            }
          }
        }]
      }
    }]
  }]
}
```

---

### WhatsApp Flows

**What it is:** Rich, interactive multi-screen experiences for data collection and complex user journeys.

**Use cases:**
- Multi-step forms (registration, surveys, feedback)
- Appointment booking flows
- Product configuration
- Customer onboarding
- Order customization

**Prerequisites:**
- Flow must be created in Meta Business Manager
- Flow must be approved by Meta
- Requires Flow ID and configuration

**Types of Flows:**

#### 1. Navigate Flow
Guides users through multiple screens with data passing between screens.

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "flow",
    "body": {
      "text": "Complete your registration"
    },
    "action": {
      "name": "flow",
      "parameters": {
        "flow_message_version": "3",
        "flow_token": "UNIQUE_TOKEN_123",
        "flow_id": "123456789",
        "flow_cta": "Start Registration",
        "flow_action": "navigate",
        "flow_action_payload": {
          "screen": "WELCOME_SCREEN",
          "data": {
            "user_name": "John",
            "user_id": "12345"
          }
        }
      }
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send a Navigate Flow message
 * Compatible with Edge Runtime
 */
export async function sendNavigateFlow(
  to: string,
  bodyText: string,
  flowConfig: {
    flowId: string;
    flowCta: string;
    screen: string;
    flowToken: string;
    data?: Record<string, unknown>;
  },
  options?: {
    header?: string;
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowConfig.flowToken,
            flow_id: flowConfig.flowId,
            flow_cta: flowConfig.flowCta,
            flow_action: 'navigate',
            flow_action_payload: {
              screen: flowConfig.screen,
              ...(flowConfig.data && { data: flowConfig.data })
            }
          }
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header }
        }),
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp flow error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending navigate flow:', error);
    return null;
  }
}
```

#### 2. Data Exchange Flow
Collects structured data from users through forms.

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send a Data Exchange Flow message
 * Compatible with Edge Runtime
 */
export async function sendDataExchangeFlow(
  to: string,
  bodyText: string,
  flowConfig: {
    flowId: string;
    flowCta: string;
    flowToken: string;
  },
  options?: {
    header?: string;
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowConfig.flowToken,
            flow_id: flowConfig.flowId,
            flow_cta: flowConfig.flowCta,
            flow_action: 'data_exchange'
          }
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header }
        }),
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp data exchange flow error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending data exchange flow:', error);
    return null;
  }
}
```

**Usage Example:**
```typescript
// Registration flow
await sendNavigateFlow(
  '1234567890',
  'Welcome! Let\'s complete your profile in 3 easy steps.',
  {
    flowId: '987654321',
    flowCta: 'Start Registration',
    screen: 'PERSONAL_INFO',
    flowToken: crypto.randomUUID(),
    data: {
      user_id: '12345',
      session_id: 'abc123'
    }
  },
  {
    header: 'New User Registration',
    footer: 'This will take about 2 minutes'
  }
);

// Feedback form
await sendDataExchangeFlow(
  '1234567890',
  'We\'d love to hear your feedback about your recent purchase!',
  {
    flowId: '111222333',
    flowCta: 'Give Feedback',
    flowToken: crypto.randomUUID()
  },
  {
    header: 'Customer Feedback',
    footer: 'Your opinion matters to us'
  }
);
```

**Webhook Response (flow completion):**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "type": "interactive",
          "interactive": {
            "type": "nfm_reply",
            "nfm_reply": {
              "response_json": "{\"name\":\"John Doe\",\"email\":\"john@example.com\",\"phone\":\"+1234567890\"}",
              "body": "Form submitted successfully"
            }
          }
        }]
      }
    }]
  }]
}
```

**Database Considerations:**
```sql
-- Store flow sessions
CREATE TABLE flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL, -- 'navigate' or 'data_exchange'
  session_data JSONB,
  status TEXT NOT NULL, -- 'pending', 'completed', 'expired'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);

-- Index for quick lookups
CREATE INDEX idx_flow_sessions_token ON flow_sessions(flow_token);
CREATE INDEX idx_flow_sessions_phone ON flow_sessions(phone_number);
```

---

### Product Catalogs

**What it is:** Showcase products from your WhatsApp Business catalog.

**Prerequisites:**
- Product catalog must be created in Meta Commerce Manager
- Products must be uploaded and approved
- Catalog ID required

**Types:**

#### 1. Single Product Message

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "product",
    "body": {
      "text": "Check out this product"
    },
    "action": {
      "catalog_id": "123456789",
      "product_retailer_id": "PRODUCT_SKU_001"
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send a single product message
 * Compatible with Edge Runtime
 */
export async function sendSingleProduct(
  to: string,
  bodyText: string,
  catalogId: string,
  productId: string,
  options?: {
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'product',
        body: { text: bodyText },
        action: {
          catalog_id: catalogId,
          product_retailer_id: productId
        },
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp product message error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending product message:', error);
    return null;
  }
}
```

#### 2. Multi-Product Message

**API Structure:**
```json
{
  "type": "interactive",
  "interactive": {
    "type": "product_list",
    "header": {
      "type": "text",
      "text": "Our Products"
    },
    "body": {
      "text": "Browse our latest collection"
    },
    "action": {
      "catalog_id": "123456789",
      "sections": [
        {
          "title": "Featured Products",
          "product_items": [
            { "product_retailer_id": "SKU_001" },
            { "product_retailer_id": "SKU_002" }
          ]
        }
      ]
    }
  }
}
```

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send a multi-product list message
 * Compatible with Edge Runtime
 */
export async function sendProductList(
  to: string,
  bodyText: string,
  catalogId: string,
  sections: Array<{
    title: string;
    productIds: string[];
  }>,
  options?: {
    header?: string;
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'product_list',
        body: { text: bodyText },
        action: {
          catalog_id: catalogId,
          sections: sections.map(section => ({
            title: section.title,
            product_items: section.productIds.map(id => ({
              product_retailer_id: id
            }))
          }))
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header }
        }),
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp product list error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending product list:', error);
    return null;
  }
}
```

#### 3. Catalog Message (Full Catalog)

**Proposed TypeScript Implementation:**
```typescript
/**
 * Send full catalog message
 * Compatible with Edge Runtime
 */
export async function sendCatalog(
  to: string,
  bodyText: string,
  catalogId: string,
  options?: {
    header?: string;
    footer?: string;
    thumbnailProductId?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  try {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'catalog_message',
        body: { text: bodyText },
        action: {
          name: 'catalog_message',
          parameters: {
            ...(options?.thumbnailProductId && {
              thumbnail_product_retailer_id: options.thumbnailProductId
            })
          }
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header }
        }),
        ...(options?.footer && {
          footer: { text: options.footer }
        })
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId }
      })
    };

    const response = await fetch(
      `https://graph.facebook.com/v23.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('WhatsApp catalog error:', error);
      return null;
    }

    const data = await response.json();
    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending catalog:', error);
    return null;
  }
}
```

**Usage Examples:**
```typescript
// Single product
await sendSingleProduct(
  '1234567890',
  'Check out our best seller!',
  'CATALOG_ID_123',
  'PRODUCT_SKU_001',
  { footer: 'Free shipping on orders over $50' }
);

// Product list with sections
await sendProductList(
  '1234567890',
  'Browse our latest collection',
  'CATALOG_ID_123',
  [
    {
      title: 'New Arrivals',
      productIds: ['SKU_001', 'SKU_002', 'SKU_003']
    },
    {
      title: 'Best Sellers',
      productIds: ['SKU_100', 'SKU_101']
    }
  ],
  {
    header: 'Spring Collection 2025',
    footer: 'Limited stock available'
  }
);

// Full catalog
await sendCatalog(
  '1234567890',
  'View our complete product catalog',
  'CATALOG_ID_123',
  {
    header: 'Our Products',
    thumbnailProductId: 'SKU_FEATURED'
  }
);
```

---

## Implementation Priority Matrix

| Feature | Value | Complexity | Priority | Est. Time |
|---------|-------|------------|----------|-----------|
| **CTA Buttons** | High | Low | 🟢 HIGH | 1-2 days |
| **Location Request** | High | Low | 🟢 HIGH | 1 day |
| **Call Permission** | Medium | Low | 🟢 HIGH | 1 day |
| **WhatsApp Flows** | High | High | 🟡 MEDIUM | 3-5 days |
| **Product Catalogs** | Medium | Medium | 🟡 MEDIUM | 2-3 days |

**Recommended Implementation Order:**
1. ✅ CTA Buttons (quick win, high value)
2. ✅ Location Request (simple, useful for delivery)
3. ✅ Call Permission (simple, improves support)
4. ⚠️ Product Catalogs (if e-commerce needed)
5. ⚠️ WhatsApp Flows (complex setup, requires Meta approval)

---

## Edge Runtime Compatibility

All proposed implementations are **fully compatible** with Vercel Edge Functions:

✅ **Compatible:**
- Uses `fetch()` API (Edge Runtime native)
- No Node.js-specific APIs (`fs`, `path`, etc.)
- No dynamic imports
- Crypto operations use Web Crypto API (`crypto.randomUUID()`)
- All async operations use standard Promises

❌ **NOT Compatible (avoid these):**
- `require()` - Use ES imports only
- Node.js streams - Use Web Streams API
- File system operations - Use external storage (Supabase)
- Child processes - Not available in Edge Runtime

**TypeScript Configuration:**
All code follows strict mode requirements:
- `noUncheckedIndexedAccess: true` - Safe array access
- `exactOptionalPropertyTypes: true` - Explicit nullability
- No `any` types - Use proper typing

---

## Testing Strategy

### Unit Tests
```typescript
// tests/unit/whatsapp-cta.test.ts
describe('sendCTAButton', () => {
  it('should send CTA button with URL', async () => {
    const messageId = await sendCTAButton(
      'test_phone',
      'Visit our site',
      'Click Here',
      'https://example.com'
    );
    expect(messageId).toBeDefined();
  });

  it('should include optional header and footer', async () => {
    const messageId = await sendCTAButton(
      'test_phone',
      'Body text',
      'Button',
      'https://example.com',
      { header: 'Header', footer: 'Footer' }
    );
    expect(messageId).toBeDefined();
  });
});
```

### Integration Tests
```typescript
// tests/integration/whatsapp-features.test.ts
describe('WhatsApp Interactive Features', () => {
  it('should handle location request webhook', async () => {
    const webhook = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              type: 'location',
              location: {
                latitude: 37.7749,
                longitude: -122.4194
              }
            }]
          }
        }]
      }]
    };

    // Test webhook parsing
    const result = await handleWebhook(webhook);
    expect(result.type).toBe('location');
  });
});
```

---

## References

- [WhatsApp Cloud API Documentation](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [whatsapp-api-js Repository](https://github.com/Secreto31126/whatsapp-api-js)
- [Interactive Messages Guide](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages)
- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)
- [Commerce Manager for Catalogs](https://business.facebook.com/commerce/)

---

## Next Steps

1. Review this documentation
2. Choose features to implement from priority matrix
3. Follow implementation plan in `WHATSAPP-API-INTEGRATION-PLAN.md`
4. Add Zod schemas to `types/schemas.ts`
5. Create unit tests in `tests/unit/`
6. Update `lib/whatsapp.ts` with new functions
7. Update webhook handler in `app/api/whatsapp/webhook/route.ts`
8. Test in development before production deployment

---

**Last Updated:** 2025-01-03
**Version:** 1.0.0
**Compatibility:** Next.js 15, Edge Runtime, TypeScript 5.9+
