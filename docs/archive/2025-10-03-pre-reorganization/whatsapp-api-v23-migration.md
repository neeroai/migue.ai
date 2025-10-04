# WhatsApp Cloud API v23.0 - Migration Guide

**Last Updated:** October 2025
**From Versions:** v19.0 - v22.0
**To Version:** v23.0
**Edge Runtime Compatible:** ✅ Yes

---

## Table of Contents

1. [Overview](#overview)
2. [What's New in v23.0](#whats-new-in-v230)
3. [Breaking Changes](#breaking-changes)
4. [2025 Pricing Changes](#2025-pricing-changes)
5. [Migration Checklist](#migration-checklist)
6. [Code Migration Examples](#code-migration-examples)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)

---

## Overview

WhatsApp Cloud API v23.0 introduces significant new features and important pricing model changes for 2025. This guide helps you migrate from older API versions while minimizing disruption.

### Migration Timeline

| Date | Change | Action Required |
|------|--------|-----------------|
| **October 2025** | v23.0 available | Update endpoint URLs |
| **April 1, 2025** | US marketing restrictions | Switch to utility templates |
| **July 1, 2025** | Per-message pricing | Update billing logic |
| **September 2025** | OBO deprecation | Migrate to system user tokens |

### Migration Complexity

- **Low Complexity**: Text messages, reactions, read receipts
- **Medium Complexity**: Interactive messages, media handling
- **High Complexity**: Template messages, pricing calculations, flows

---

## What's New in v23.0

### 1. WhatsApp Business Calling API ✨ NEW

Enable voice calls within WhatsApp conversations.

**Features:**
- User-initiated calls (accept/reject/terminate)
- Business-initiated calls (request permission)
- Call icon visibility control

**Implementation:**

```typescript
// Request permission to call user
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

**Webhook Events:**

```typescript
interface CallEvent {
  type: 'call_initiated' | 'call_accepted' | 'call_rejected';
  call_id: string;
  from: string;
  timestamp: string;
}
```

### 2. Block API ✨ NEW

Manage spam by blocking/unblocking phone numbers.

**Block a Number:**

```typescript
async function blockPhoneNumber(blockedNumber: string): Promise<void> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${process.env.WHATSAPP_PHONE_ID}/block`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        phone_number: blockedNumber
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to block ${blockedNumber}`);
  }
}
```

**Unblock a Number:**

```typescript
async function unblockPhoneNumber(blockedNumber: string): Promise<void> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${process.env.WHATSAPP_PHONE_ID}/block/${blockedNumber}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to unblock ${blockedNumber}`);
  }
}
```

### 3. Native Typing Indicators

Now officially supported (previously unofficial).

```typescript
// Mark as read with typing indicator
const response = await fetch(
  `${GRAPH_BASE_URL}/${phoneId}/messages`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: {
        type: 'text'
      }
    })
  }
);
```

**Already Implemented in migue.ai:**

```typescript
// lib/whatsapp.ts:232
export async function markAsReadWithTyping(
  to: string,
  messageId: string
) {
  // Implementation already compatible with v23.0
}
```

### 4. Multi-Solution Conversations (Beta)

Use multiple WhatsApp Business Solution Providers on the same phone number.

**Benefits:**
- Redundancy and failover
- Load balancing across providers
- Specialized providers for different use cases

**Configuration:**
- Requires Business Manager approval
- Contact Meta support to enable
- Test thoroughly before production

### 5. Embedded Signup v3

Simplified registration with new features:

- Automatic event tracking
- Marketing Messages Lite API support
- App-only installation option
- Improved onboarding flow

### 6. New Webhook Events

**Account Update Event:**

```typescript
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "BUSINESS_ACCOUNT_ID",
    "changes": [{
      "field": "account_update",
      "value": {
        "event": "AD_ACCOUNT_LINKED",
        "ad_account_id": "123456789"
      }
    }]
  }]
}
```

**Handle in Webhook:**

```typescript
if (change.field === 'account_update') {
  const event = change.value.event;

  if (event === 'AD_ACCOUNT_LINKED') {
    console.log('Ad account linked:', change.value.ad_account_id);
    // Handle ad account linking
  }
}
```

### 7. Template Message Enhancements

- **Template groups**: Organize templates into groups
- **Group analytics**: Track performance by template group
- **Simplified categories**: Reduced from 4 to 3 categories

---

## Breaking Changes

### 1. Template Category Simplification

**Old (v19.0-v22.0):**
```typescript
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'OTP';
```

**New (v23.0):**
```typescript
type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
```

**Migration:**
- `OTP` category merged into `AUTHENTICATION`
- Update template creation code
- Existing OTP templates continue to work

### 2. Removed `allow_category_change` Property

**Old:**
```typescript
{
  "name": "template_name",
  "language": "en_US",
  "components": [...],
  "allow_category_change": true  // ❌ Removed in v23.0
}
```

**New:**
```typescript
{
  "name": "template_name",
  "language": "en_US",
  "components": [...]
}
```

**Action:** Remove `allow_category_change` from template creation requests.

### 3. On-Behalf-Of (OBO) Deprecation

**Timeline:** September 2025

**Current:**
```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'On-Behalf-Of': business_id  // Deprecated
}
```

**Migration:**
- Use system user tokens instead
- Update authentication in Meta Business Manager
- Test before September 2025 deadline

**New Approach:**
```typescript
// Use system user access token directly
headers: {
  'Authorization': `Bearer ${systemUserToken}`
}
```

### 4. Error Code Changes

Some error codes have been consolidated or changed:

| Old Code | New Code | Description |
|----------|----------|-------------|
| 131009 | 131051 | Unsupported message type |
| 368 | 131026 | Rate limit exceeded |

**Migration:**

```typescript
// Old
if (error.code === 368) {
  // Handle rate limit
}

// New
if (error.code === 131026) {
  // Handle rate limit
}
```

---

## 2025 Pricing Changes

### Per-Message Pricing (July 1, 2025)

**OLD MODEL (Before July 1, 2025):**
- Charged per 24-hour conversation window
- First message opens a conversation ($0.005 - $0.040 depending on category)
- Subsequent messages within 24 hours are free

**NEW MODEL (After July 1, 2025):**
- Charged per template message delivered
- Marketing, Utility, Authentication templates are billable
- Service messages (within customer service window) remain FREE

**Pricing Comparison:**

| Scenario | Old Model | New Model |
|----------|-----------|-----------|
| 1 template message | $0.01 (conversation) | $0.01 (message) |
| 5 messages in 24hrs | $0.01 (conversation) | $0.05 (if all templates) |
| Active conversation | Free after first msg | Free (service messages) |

**Cost Optimization Strategies:**

1. **Maximize Service Messages:**
```typescript
// Respond within 24 hours = FREE
async function replyToUser(from: string, text: string) {
  // Check if customer service window is open
  const isWindowOpen = await checkServiceWindow(from);

  if (isWindowOpen) {
    // Free service message
    return sendWhatsAppText(from, text);
  } else {
    // Use template (billable after July 1, 2025)
    return sendTemplate(from, 're_engagement', { text });
  }
}
```

2. **Batch Notifications:**
```typescript
// Combine multiple updates into one template
const summary = `
New order #123: $50
Shipped: Expected delivery tomorrow
Track: https://example.com/track/123
`;

await sendTemplate(from, 'order_summary', { summary });
```

3. **Use Utility Templates:**
```typescript
// Utility templates typically cheaper than Marketing
const template = {
  name: 'appointment_reminder',  // UTILITY category
  category: 'UTILITY',
  components: [...]
};
```

**Update Billing Logic:**

```typescript
// Old
interface ConversationPricing {
  conversationId: string;
  category: 'service' | 'utility' | 'marketing' | 'authentication';
  price: number;
}

// New (July 1, 2025)
interface MessagePricing {
  messageId: string;
  category: 'service' | 'utility' | 'marketing' | 'authentication';
  price: number;
  billable: boolean;  // false for service messages
}

async function trackMessageCost(status: StatusUpdate) {
  if (status.pricing) {
    await db.insert('message_costs', {
      message_id: status.id,
      category: status.pricing.category,
      billable: status.pricing.billable,
      price: status.pricing.billable ? await getMessagePrice(status.pricing.category) : 0,
      timestamp: new Date()
    });
  }
}
```

### US Marketing Template Restrictions (April 1, 2025)

**Restriction:**
- Marketing template messages to US phone numbers are temporarily paused
- Affects templates with category = `MARKETING`
- No timeline for re-enablement

**Workarounds:**

1. **Convert to Utility Templates:**
```typescript
// Old (MARKETING)
{
  "name": "weekly_promotion",
  "category": "MARKETING",  // ❌ Blocked for US numbers
  "components": [
    {
      "type": "BODY",
      "text": "Get 20% off this week! Use code SAVE20"
    }
  ]
}

// New (UTILITY)
{
  "name": "account_update",
  "category": "UTILITY",  // ✅ Allowed for US numbers
  "components": [
    {
      "type": "BODY",
      "text": "Your account has been updated with new benefits. View details: {{1}}"
    }
  ]
}
```

2. **Wait for Customer Service Window:**
```typescript
async function sendToUSNumber(to: string, message: string) {
  const isUS = to.startsWith('1');  // US country code
  const windowOpen = await checkServiceWindow(to);

  if (isUS && !windowOpen) {
    // Can't send marketing template to US number
    // Queue for when customer initiates conversation
    await queueMessage(to, message);
    return null;
  }

  // Send service message (free)
  return sendWhatsAppText(to, message);
}
```

3. **Use Interactive Messages:**
```typescript
// Instead of marketing template, use interactive CTA
const payload = {
  messaging_product: 'whatsapp',
  to: usPhoneNumber,
  type: 'interactive',
  interactive: {
    type: 'cta_url',
    body: {
      text: 'Check out our latest products!'
    },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: 'Shop Now',
        url: 'https://example.com/shop'
      }
    }
  }
};
```

---

## Migration Checklist

### Pre-Migration

- [ ] **Audit Current API Usage**
  - List all API endpoints used
  - Identify template messages
  - Review error handling code
  - Check for deprecated features

- [ ] **Review Documentation**
  - Read [v23.0 reference](./whatsapp-api-v23-reference.md)
  - Understand new features
  - Review breaking changes
  - Plan pricing strategy

- [ ] **Set Up Test Environment**
  - Create test WhatsApp Business Account
  - Configure webhook endpoints
  - Prepare test phone numbers
  - Set up monitoring

### Migration Steps

- [ ] **Update API Endpoints**
  ```typescript
  // Old
  const BASE_URL = 'https://graph.facebook.com/v19.0';

  // New
  const BASE_URL = 'https://graph.facebook.com/v23.0';
  ```

- [ ] **Update TypeScript Types**
  ```typescript
  // Remove deprecated types
  type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

  // Add new event types
  type WebhookEvent = 'messages' | 'message_status' | 'account_update';
  ```

- [ ] **Implement New Features**
  - [ ] Block API for spam management
  - [ ] Call permission requests
  - [ ] Enhanced webhook handling
  - [ ] Template groups (if applicable)

- [ ] **Update Error Handling**
  ```typescript
  // Update error code checks
  switch (error.code) {
    case 131051:  // Was 131009
      console.error('Unsupported message type');
      break;
    case 131026:  // Was 368
      console.error('Rate limit exceeded');
      break;
  }
  ```

- [ ] **Prepare for Pricing Changes**
  - [ ] Update billing calculations
  - [ ] Implement message cost tracking
  - [ ] Optimize for service messages
  - [ ] Review US marketing templates

### Testing

- [ ] **Unit Tests**
  - Test all message type functions
  - Validate payload schemas
  - Test error handling
  - Check rate limiting

- [ ] **Integration Tests**
  - Send test messages
  - Verify webhook delivery
  - Test interactive messages
  - Validate template messages

- [ ] **End-to-End Tests**
  - Complete user journeys
  - Webhook event handling
  - Error recovery
  - Performance benchmarks

- [ ] **Production Readiness**
  - Load testing
  - Monitoring setup
  - Alerting configuration
  - Rollback procedures

### Post-Migration

- [ ] **Monitor Performance**
  - API latency
  - Error rates
  - Message delivery rates
  - Cost per message

- [ ] **Track Metrics**
  - Message volume
  - Template usage
  - Service vs template ratio
  - User engagement

- [ ] **Update Documentation**
  - Internal API docs
  - Team training materials
  - Incident playbooks
  - Cost optimization guides

---

## Code Migration Examples

### Example 1: Endpoint URL Update

**Before (v19.0):**

```typescript
const GRAPH_BASE_URL = 'https://graph.facebook.com/v19.0';

async function sendMessage(payload: any) {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${phoneId}/messages`,
    { method: 'POST', /* ... */ }
  );
  return response.json();
}
```

**After (v23.0):**

```typescript
export const GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0';

async function sendMessage(payload: any) {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${phoneId}/messages`,
    { method: 'POST', /* ... */ }
  );
  return response.json();
}
```

### Example 2: Template Category Update

**Before:**

```typescript
interface Template {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'OTP';
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

const template: Template = {
  name: 'otp_verification',
  category: 'OTP',  // ❌ Deprecated
  allow_category_change: true,  // ❌ Removed
  components: [...]
};
```

**After:**

```typescript
interface Template {
  name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: TemplateComponent[];
}

const template: Template = {
  name: 'otp_verification',
  category: 'AUTHENTICATION',  // ✅ Updated
  components: [...]
};
```

### Example 3: Webhook Event Handling

**Before:**

```typescript
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        // Handle messages only
        await handleMessages(change.value);
      }
    }
  }

  return new Response('OK', { status: 200 });
}
```

**After:**

```typescript
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      switch (change.field) {
        case 'messages':
          await handleMessages(change.value);
          break;

        case 'account_update':  // ✅ New in v23.0
          await handleAccountUpdate(change.value);
          break;

        default:
          console.log(`Unknown field: ${change.field}`);
      }
    }
  }

  return new Response('OK', { status: 200 });
}

async function handleAccountUpdate(value: any) {
  if (value.event === 'AD_ACCOUNT_LINKED') {
    console.log('Ad account linked:', value.ad_account_id);
    // Update database, send notification, etc.
  }
}
```

### Example 4: Pricing Calculation Update

**Before (Conversation-based):**

```typescript
interface ConversationCost {
  conversationId: string;
  category: string;
  startTime: Date;
  endTime: Date;
  cost: number;
}

async function calculateCost(status: StatusUpdate) {
  if (status.conversation) {
    const price = getPriceByCategory(status.conversation.origin.type);

    await db.insert('costs', {
      conversation_id: status.conversation.id,
      category: status.conversation.origin.type,
      cost: price
    });
  }
}
```

**After (Message-based):**

```typescript
interface MessageCost {
  messageId: string;
  category: string;
  billable: boolean;
  cost: number;
  timestamp: Date;
}

async function calculateCost(status: StatusUpdate) {
  if (status.pricing) {
    const price = status.pricing.billable
      ? getPriceByCategory(status.pricing.category)
      : 0;  // Service messages are free

    await db.insert('costs', {
      message_id: status.id,
      category: status.pricing.category,
      billable: status.pricing.billable,
      cost: price,
      timestamp: new Date()
    });
  }
}
```

---

## Testing Strategy

### Unit Testing

```typescript
import { describe, it, expect } from '@jest/globals';
import { sendWhatsAppText, sendInteractiveButtons } from '@/lib/whatsapp';

describe('WhatsApp API v23.0', () => {
  it('should use v23.0 endpoint', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_123' }] })
    });

    global.fetch = mockFetch;

    await sendWhatsAppText('1234567890', 'Test message');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v23.0/'),
      expect.any(Object)
    );
  });

  it('should handle new error codes', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 131051,  // New error code
          message: 'Unsupported message type'
        }
      })
    });

    global.fetch = mockFetch;

    await expect(
      sendWhatsAppText('1234567890', 'Test')
    ).rejects.toThrow('Unsupported message type');
  });
});
```

### Integration Testing

```typescript
describe('Webhook Integration', () => {
  it('should handle account_update events', async () => {
    const webhookPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'ACCOUNT_ID',
        changes: [{
          field: 'account_update',
          value: {
            event: 'AD_ACCOUNT_LINKED',
            ad_account_id: '123456'
          }
        }]
      }]
    };

    const response = await fetch('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    expect(response.status).toBe(200);
  });
});
```

### Performance Testing

```typescript
describe('Performance', () => {
  it('should respond within 100ms', async () => {
    const startTime = Date.now();
    await sendWhatsAppText('1234567890', 'Test');
    const latency = Date.now() - startTime;

    expect(latency).toBeLessThan(100);
  });
});
```

---

## Rollback Plan

### Version Pinning

If issues arise, you can temporarily rollback to v22.0:

```typescript
// Rollback to v22.0
export const GRAPH_BASE_URL = 'https://graph.facebook.com/v22.0';
```

### Feature Flags

Use feature flags to gradually enable v23.0 features:

```typescript
const USE_V23_FEATURES = process.env.ENABLE_V23 === 'true';

async function sendMessage(to: string, text: string) {
  if (USE_V23_FEATURES) {
    // Use v23.0 endpoint and features
    return sendWhatsAppTextV23(to, text);
  } else {
    // Fallback to v22.0
    return sendWhatsAppTextV22(to, text);
  }
}
```

### Monitoring

Set up alerts for migration issues:

```typescript
// Monitor error rate increase
if (errorRate > baseline * 1.5) {
  alert('High error rate detected after v23.0 migration');
  // Consider automatic rollback
}

// Monitor latency
if (p95Latency > 200) {
  alert('Latency increased after v23.0 migration');
}
```

---

## Summary

### Key Takeaways

1. ✅ **Update endpoint URLs** to v23.0
2. ✅ **Implement Block API** for spam management
3. ✅ **Prepare for pricing changes** (July 1, 2025)
4. ✅ **Handle US marketing restrictions** (April 1, 2025)
5. ✅ **Update error handling** for new error codes
6. ✅ **Test thoroughly** before production deployment
7. ✅ **Monitor performance** and costs post-migration

### Timeline

- **Now**: Update to v23.0 endpoints
- **April 2025**: US marketing template restrictions take effect
- **July 2025**: Per-message pricing begins
- **September 2025**: OBO deprecation deadline

### Resources

- [v23.0 API Reference](./whatsapp-api-v23-reference.md)
- [Advanced Features Guide](./whatsapp-api-v23-advanced.md)
- [WhatsApp Flows Documentation](./whatsapp-api-v23-flows.md)
- [Meta Official Changelog](https://developers.facebook.com/docs/whatsapp/business-platform/changelog/)

---

**Need Help?**
- Review the [Troubleshooting Guide](./whatsapp-api-v23-advanced.md#troubleshooting)
- Check [migue.ai Architecture](../CLAUDE.md)
- Contact Meta Support for Business Account issues
