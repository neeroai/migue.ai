# WhatsApp API v23.0 Integration Plan

**API Version:** v23.0 (2025)
**Last Updated:** October 2025
**Status:** Production Ready

Step-by-step guide to integrate advanced WhatsApp interactive features into migue.ai using WhatsApp Cloud API v23.0.

## Table of Contents

- [Overview](#overview)
- [Phase 1: CTA Buttons (Priority: HIGH)](#phase-1-cta-buttons-priority-high)
- [Phase 2: Location & Call Requests (Priority: HIGH)](#phase-2-location--call-requests-priority-high)
- [Phase 3: Product Catalogs (Priority: MEDIUM)](#phase-3-product-catalogs-priority-medium)
- [Phase 4: WhatsApp Flows (Priority: MEDIUM)](#phase-4-whatsapp-flows-priority-medium)
- [Testing Strategy](#testing-strategy)
- [Database Schema Updates](#database-schema-updates)
- [Deployment Checklist](#deployment-checklist)

---

## Overview

This integration plan prioritizes features based on:
- **Implementation complexity** (Low → High)
- **Business value** (High → Low)
- **Edge Runtime compatibility** (All features are compatible)
- **Maintenance overhead** (Minimal → Significant)

**Estimated Total Timeline:** 7-12 days (depending on parallel work)

### v23.0 Key Updates

- ✨ **WhatsApp Business Calling API**: Voice calls within conversations
- ✨ **Block API**: Spam management capabilities
- ✨ **Enhanced Typing Indicators**: Native support (already implemented)
- ⚠️ **2025 Pricing Changes**: Per-message billing (July 1, 2025)
- ⚠️ **US Marketing Restrictions**: Temporary pause (April 1, 2025)

### Prerequisites

- ✅ TypeScript 5.9+ with strict mode
- ✅ Next.js 15 App Router
- ✅ Vercel Edge Functions
- ✅ Supabase for persistence
- ✅ WhatsApp Cloud API v23.0 credentials
- ✅ Meta Business Manager access

### Related Documentation

- [v23.0 API Reference](./whatsapp-api-v23-reference.md) - Complete API documentation
- [Migration Guide](./whatsapp-api-v23-migration.md) - Upgrade from older versions
- [Advanced Features](./whatsapp-api-v23-advanced.md) - Advanced patterns & optimization
- [WhatsApp Flows](./whatsapp-api-v23-flows.md) - Interactive flows deep dive

---

## Phase 1: CTA Buttons (Priority: HIGH)

**Timeline:** 1-2 days
**Complexity:** Low
**Value:** High

### Step 1.1: Add TypeScript Types

**File:** `types/whatsapp.ts` (create if doesn't exist)

```typescript
/**
 * WhatsApp CTA Button types
 */
export interface CTAButtonOptions {
  header?: string;
  footer?: string;
  replyToMessageId?: string;
}

export interface CTAButtonPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'cta_url';
    body: { text: string };
    action: {
      name: 'cta_url';
      parameters: {
        display_text: string;
        url: string;
      };
    };
    header?: { type: 'text'; text: string };
    footer?: { text: string };
  };
  context?: { message_id: string };
}
```

### Step 1.2: Implement in lib/whatsapp.ts

Add the following function after existing interactive functions:

```typescript
/**
 * Send a Call-to-Action (CTA) button with URL
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Main message text
 * @param buttonText - Button label (max 20 characters)
 * @param url - URL to open when button is tapped
 * @param options - Optional header, footer, and reply-to message ID
 * @returns Message ID or null on error
 */
export async function sendCTAButton(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  options?: CTAButtonOptions
): Promise<string | null> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return null;
  }

  // Validate button text length
  if (buttonText.length > 20) {
    console.error('Button text exceeds 20 characters');
    return null;
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.error('Invalid URL format');
    return null;
  }

  try {
    const payload: CTAButtonPayload = {
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
      console.error('WhatsApp CTA button error:', error);
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

### Step 1.3: Add Zod Schema for Webhook Validation

**File:** `types/schemas.ts`

Add after existing interactive schemas:

```typescript
/**
 * CTA Button Reply Schema
 */
const CTAButtonReplySchema = z.object({
  type: z.literal('button_reply'),
  button_reply: z.object({
    id: z.string(),
    title: z.string()
  })
});

// Update InteractiveMessageSchema to include CTA
const InteractiveMessageSchema = z.object({
  type: z.literal('interactive'),
  interactive: z.union([
    ButtonReplySchema,
    ListReplySchema,
    CTAButtonReplySchema, // Add this line
    z.object({
      type: z.string()
    })
  ])
});
```

### Step 1.4: Create Unit Tests

**File:** `tests/unit/whatsapp-cta.test.ts` (new file)

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { sendCTAButton } from '@/lib/whatsapp';

describe('sendCTAButton', () => {
  beforeEach(() => {
    // Mock environment variables
    process.env.WHATSAPP_TOKEN = 'test_token';
    process.env.PHONE_NUMBER_ID = 'test_phone_id';
  });

  it('should send CTA button with valid URL', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg_123' }] })
      })
    ) as jest.Mock;

    const result = await sendCTAButton(
      '1234567890',
      'Check out our website',
      'Visit Now',
      'https://example.com'
    );

    expect(result).toBe('msg_123');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/messages'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    );
  });

  it('should reject button text longer than 20 characters', async () => {
    const result = await sendCTAButton(
      '1234567890',
      'Body text',
      'This button text is way too long',
      'https://example.com'
    );

    expect(result).toBeNull();
  });

  it('should reject invalid URL format', async () => {
    const result = await sendCTAButton(
      '1234567890',
      'Body text',
      'Click',
      'not-a-valid-url'
    );

    expect(result).toBeNull();
  });

  it('should include optional header and footer', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg_123' }] })
      })
    ) as jest.Mock;

    await sendCTAButton(
      '1234567890',
      'Body text',
      'Click',
      'https://example.com',
      {
        header: 'Header Text',
        footer: 'Footer Text'
      }
    );

    const callArgs = (fetch as jest.Mock).mock.calls[0]!;
    const payload = JSON.parse(callArgs[1].body);

    expect(payload.interactive.header).toEqual({
      type: 'text',
      text: 'Header Text'
    });
    expect(payload.interactive.footer).toEqual({
      text: 'Footer Text'
    });
  });
});
```

### Step 1.5: Update Webhook Handler

**File:** `app/api/whatsapp/webhook/route.ts`

Add handling for CTA button taps:

```typescript
// Inside the message handling logic
if (message.type === 'interactive') {
  const interactive = message.interactive;

  if (interactive?.type === 'button_reply') {
    const buttonId = interactive.button_reply?.id;
    const buttonTitle = interactive.button_reply?.title;

    // Handle CTA button tap
    if (buttonId === 'cta_url') {
      await markAsRead(messageId);
      await reactWithCheck(from, messageId);

      // Log the interaction
      console.log(`User ${from} tapped CTA button: ${buttonTitle}`);

      // Optional: Save to database
      await supabase.from('user_interactions').insert({
        phone_number: from,
        interaction_type: 'cta_button_tap',
        button_title: buttonTitle,
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

### Step 1.6: AI Integration Example

**File:** `lib/response.ts`

Add CTA suggestions to AI responses:

```typescript
export async function generateResponseWithCTA(
  message: string,
  context: ConversationHistory[]
): Promise<{ text: string; shouldSendCTA?: boolean; ctaConfig?: any }> {
  const systemPrompt = `
You are a helpful AI assistant. When appropriate, suggest using a CTA button
to direct users to external resources.

If the user asks about:
- Website/online resources → Suggest CTA to website
- Store locations → Suggest CTA to Google Maps
- Support documentation → Suggest CTA to help center

Format your response as JSON:
{
  "text": "your response text",
  "shouldSendCTA": true/false,
  "ctaConfig": {
    "buttonText": "Visit Website",
    "url": "https://example.com",
    "header": "Optional header"
  }
}
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      ...context.map(c => ({ role: c.role, content: c.content })),
      { role: 'user', content: message }
    ],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0]!.message.content!);
}
```

**Usage in webhook:**

```typescript
const aiResponse = await generateResponseWithCTA(messageText, history);

// Send text response
await sendMessage(from, aiResponse.text);

// Send CTA if suggested
if (aiResponse.shouldSendCTA && aiResponse.ctaConfig) {
  await sendCTAButton(
    from,
    aiResponse.text,
    aiResponse.ctaConfig.buttonText,
    aiResponse.ctaConfig.url,
    {
      header: aiResponse.ctaConfig.header
    }
  );
}
```

---

## Phase 2: Location & Call Requests (Priority: HIGH)

**Timeline:** 1-2 days
**Complexity:** Low
**Value:** High

### Step 2.1: Add Location Request Function

**File:** `lib/whatsapp.ts`

```typescript
/**
 * Request user's location with permission
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Message explaining why location is needed
 * @param options - Optional footer and reply-to message ID
 * @returns Message ID or null on error
 */
export async function requestLocation(
  to: string,
  bodyText: string,
  options?: {
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return null;
  }

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

### Step 2.2: Add Call Permission Function

**File:** `lib/whatsapp.ts`

```typescript
/**
 * Request permission to call user
 * @param to - Phone number in WhatsApp format
 * @param bodyText - Message explaining why call is needed
 * @param options - Optional footer and reply-to message ID
 * @returns Message ID or null on error
 */
export async function requestCallPermission(
  to: string,
  bodyText: string,
  options?: {
    footer?: string;
    replyToMessageId?: string;
  }
): Promise<string | null> {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return null;
  }

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

### Step 2.3: Update Webhook Handler for Location

**File:** `app/api/whatsapp/webhook/route.ts`

```typescript
// Handle location messages
if (message.type === 'location') {
  const location = message.location;

  if (location) {
    await markAsRead(messageId);
    await reactWithCheck(from, messageId);

    // Save location to database
    await supabase.from('user_locations').insert({
      phone_number: from,
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      address: location.address,
      timestamp: new Date().toISOString()
    });

    // Generate AI response with location context
    const response = await generateResponse(
      `User shared their location: ${location.address || `${location.latitude}, ${location.longitude}`}`,
      conversationHistory
    );

    await sendMessage(from, response);
  }
}
```

### Step 2.4: Database Schema for Locations

**File:** `supabase/schema.sql` (add to existing schema)

```sql
-- User locations table
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  name TEXT,
  address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);

-- Index for quick lookups
CREATE INDEX idx_user_locations_phone ON user_locations(phone_number);
CREATE INDEX idx_user_locations_timestamp ON user_locations(timestamp DESC);

-- RLS Policies
ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert user locations"
  ON user_locations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow select user locations"
  ON user_locations FOR SELECT
  USING (true);
```

---

## Phase 3: Product Catalogs (Priority: MEDIUM)

**Timeline:** 2-3 days
**Complexity:** Medium
**Value:** Medium (High if e-commerce needed)

### Prerequisites
- Product catalog created in Meta Commerce Manager
- Products uploaded and approved
- Catalog ID obtained from Commerce Manager

### Step 3.1: Add Product Functions

**File:** `lib/whatsapp.ts`

```typescript
/**
 * Send a single product message
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
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return null;
  }

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

/**
 * Send a multi-product list
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
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('WhatsApp credentials not configured');
    return null;
  }

  // Validate sections (max 10 sections, max 30 products per section)
  if (sections.length > 10) {
    console.error('Maximum 10 sections allowed');
    return null;
  }

  for (const section of sections) {
    if (section.productIds.length > 30) {
      console.error('Maximum 30 products per section allowed');
      return null;
    }
  }

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

---

## Phase 4: WhatsApp Flows (Priority: MEDIUM)

**Timeline:** 3-5 days
**Complexity:** High
**Value:** High (for complex user journeys)

### Prerequisites
- Flow created in Meta Business Manager
- Flow approved by Meta
- Flow ID obtained
- Understanding of Flow JSON schema

### Step 4.1: Database Schema for Flows

**File:** `supabase/schema.sql`

```sql
-- Flow sessions table
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('navigate', 'data_exchange')),
  session_data JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);

-- Indexes
CREATE INDEX idx_flow_sessions_token ON flow_sessions(flow_token);
CREATE INDEX idx_flow_sessions_phone ON flow_sessions(phone_number);
CREATE INDEX idx_flow_sessions_status ON flow_sessions(status);

-- RLS Policies
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert flow sessions"
  ON flow_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow select flow sessions"
  ON flow_sessions FOR SELECT
  USING (true);

CREATE POLICY "Allow update flow sessions"
  ON flow_sessions FOR UPDATE
  USING (true);
```

### Step 4.2: Implementation

See `WHATSAPP-INTERACTIVE-FEATURES.md` for complete Flow implementations.

---

## Testing Strategy

### Unit Tests Coverage

**Minimum 80% coverage required:**

```bash
# Run tests
npm run test:unit

# Run with coverage
npm run test -- --coverage
```

**Test files to create:**
- `tests/unit/whatsapp-cta.test.ts` ✅
- `tests/unit/whatsapp-location.test.ts` 🆕
- `tests/unit/whatsapp-call-permission.test.ts` 🆕
- `tests/unit/whatsapp-products.test.ts` 🆕
- `tests/unit/whatsapp-flows.test.ts` 🆕

### Integration Tests

**File:** `tests/integration/whatsapp-features.test.ts`

```typescript
import { describe, it, expect } from '@jest/globals';

describe('WhatsApp Interactive Features Integration', () => {
  it('should handle complete CTA button flow', async () => {
    // 1. Send CTA button
    const messageId = await sendCTAButton(
      'test_phone',
      'Visit our site',
      'Click',
      'https://example.com'
    );
    expect(messageId).toBeDefined();

    // 2. Simulate webhook response
    const webhook = createMockWebhook('cta_button_tap');
    const response = await POST(createMockRequest(webhook));
    expect(response.status).toBe(200);
  });

  it('should save location to database', async () => {
    const webhook = createLocationWebhook({
      latitude: 37.7749,
      longitude: -122.4194
    });

    await POST(createMockRequest(webhook));

    // Verify database entry
    const { data } = await supabase
      .from('user_locations')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(data?.[0]?.latitude).toBe(37.7749);
  });
});
```

### E2E Tests with Playwright

**File:** `tests/e2e/whatsapp-cta.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('should send CTA button via webhook', async ({ request }) => {
  const response = await request.post('/api/whatsapp/webhook', {
    data: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: 'test_phone',
              text: { body: 'show me your website' }
            }]
          }
        }]
      }]
    }
  });

  expect(response.status()).toBe(200);
  // Verify CTA button was sent (check logs or mock)
});
```

---

## Database Schema Updates

### Required Tables

```sql
-- user_interactions (for CTA tracking)
CREATE TABLE IF NOT EXISTS user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  button_title TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);

-- user_locations (for location tracking)
CREATE TABLE IF NOT EXISTS user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  name TEXT,
  address TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);

-- flow_sessions (for flow tracking)
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL,
  session_data JSONB,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (phone_number) REFERENCES conversations(phone_number)
);
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All unit tests passing (≥80% coverage)
- [ ] Integration tests passing
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] Type checking successful (`npm run typecheck`)
- [ ] Edge Runtime compatibility verified
- [ ] Environment variables documented in `.env.example`
- [ ] Database migrations tested in staging
- [ ] Code review completed
- [ ] Documentation updated

### Deployment Steps

1. **Staging Deployment:**
   ```bash
   git checkout staging
   git merge feature/whatsapp-interactive
   git push origin staging
   # Vercel auto-deploys to staging
   ```

2. **Staging Verification:**
   - [ ] Test CTA buttons with real WhatsApp account
   - [ ] Test location requests
   - [ ] Verify database entries
   - [ ] Check error logging

3. **Production Deployment:**
   ```bash
   git checkout main
   git merge staging
   git push origin main
   # Vercel auto-deploys to production
   ```

4. **Post-Deployment:**
   - [ ] Monitor error logs (Vercel Dashboard)
   - [ ] Test features in production
   - [ ] Monitor database performance
   - [ ] Check Edge Function metrics

### Rollback Plan

If issues occur:

```bash
# Revert to previous deployment
vercel rollback

# Or revert Git commit
git revert HEAD
git push origin main
```

---

## Maintenance & Monitoring

### Monitoring

**Vercel Analytics:**
- Edge Function duration (target: <100ms)
- Error rate (target: <1%)
- Request volume

**Supabase Metrics:**
- Database query performance
- Storage usage
- Connection pool status

**Custom Logging:**
```typescript
// Add to lib/monitoring.ts
export async function logFeatureUsage(
  feature: string,
  phoneNumber: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from('feature_usage').insert({
    feature,
    phone_number: phoneNumber,
    metadata,
    timestamp: new Date().toISOString()
  });
}
```

### Performance Optimization

**Edge Function Caching:**
```typescript
// Cache frequently accessed data
const catalogCache = new Map<string, ProductCatalog>();

export async function getCatalog(catalogId: string): Promise<ProductCatalog> {
  if (catalogCache.has(catalogId)) {
    return catalogCache.get(catalogId)!;
  }

  const catalog = await fetchCatalog(catalogId);
  catalogCache.set(catalogId, catalog);
  return catalog;
}
```

---

## References

### Official Documentation

- [WhatsApp Cloud API v23.0](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Flows](https://developers.facebook.com/docs/whatsapp/flows)
- [WhatsApp Business Calling API](https://business.whatsapp.com/products/business-calling-api)
- [Meta Commerce Manager](https://business.facebook.com/commerce)

### migue.ai Documentation

- [v23.0 API Reference](./whatsapp-api-v23-reference.md) - Complete API documentation
- [Migration Guide](./whatsapp-api-v23-migration.md) - Upgrade from older versions
- [Advanced Features](./whatsapp-api-v23-advanced.md) - Advanced patterns & optimization
- [WhatsApp Flows](./whatsapp-api-v23-flows.md) - Interactive flows deep dive
- [WHATSAPP-INTERACTIVE-FEATURES.md](./WHATSAPP-INTERACTIVE-FEATURES.md) - Legacy guide

### Platform Documentation

- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Supabase Database](https://supabase.com/docs/guides/database)
- [Next.js 15 App Router](https://nextjs.org/docs/app)

### v23.0 Updates & Changelog

- [WhatsApp Business Platform Changelog](https://developers.facebook.com/docs/whatsapp/business-platform/changelog)
- [2025 Pricing Updates](https://business.whatsapp.com/products/platform-pricing)

---

## Version History

### v2.0.0 (October 2025)
- ✅ Updated to WhatsApp Cloud API v23.0
- ✅ Added Block API integration
- ✅ Added WhatsApp Business Calling API
- ✅ Updated pricing information (2025 changes)
- ✅ Added US marketing restrictions notes
- ✅ Comprehensive v23.0 documentation added

### v1.0.0 (January 2025)
- ✅ Initial integration plan
- ✅ CTA buttons, location requests, call permissions
- ✅ Product catalogs
- ✅ WhatsApp Flows basic implementation

---

**Last Updated:** October 2025
**Version:** 2.0.0 (v23.0)
**Status:** Production Ready
**API Version:** WhatsApp Cloud API v23.0
