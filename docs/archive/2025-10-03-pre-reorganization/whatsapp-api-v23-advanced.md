# WhatsApp Cloud API v23.0 - Advanced Features Guide

**Last Updated:** October 2025
**API Version:** v23.0
**Edge Runtime Compatible:** ✅ Yes
**Target Audience:** Advanced developers

---

## Table of Contents

1. [WhatsApp Business Calling API](#whatsapp-business-calling-api)
2. [Product Catalogs & Commerce](#product-catalogs--commerce)
3. [Block API & Spam Management](#block-api--spam-management)
4. [Advanced Interactive Features](#advanced-interactive-features)
5. [Template Message Optimization](#template-message-optimization)
6. [Media Handling & Processing](#media-handling--processing)
7. [Broadcast Messaging](#broadcast-messaging)
8. [Performance Optimization](#performance-optimization)
9. [Security Best Practices](#security-best-practices)
10. [AI Integration Patterns](#ai-integration-patterns)
11. [Analytics & Monitoring](#analytics--monitoring)
12. [Troubleshooting Guide](#troubleshooting-guide)

---

## WhatsApp Business Calling API

The WhatsApp Business Calling API enables businesses to create end-to-end messaging journeys where customers can call and message all in the same WhatsApp thread.

### Features

- **User-Initiated Calls**: Accept, reject, or terminate calls
- **Business-Initiated Calls**: Request permission for outbound calls
- **Call Icon Control**: Enable/disable call icon visibility
- **Call Quality**: HD audio, end-to-end encryption
- **Integration**: Seamless with existing WhatsApp conversations

### Request Call Permission

Before making a business-initiated call, request permission:

```typescript
export async function requestCallPermission(
  to: string,
  reason: string
): Promise<string | null> {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'call_permission_request',
      body: {
        text: reason || 'May we call you to discuss your inquiry?'
      },
      action: {
        name: 'request_call_permission'
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage
await requestCallPermission(
  '1234567890',
  'We need to discuss your recent order. Can we call you?'
);
```

### Handle Call Webhook Events

```typescript
// types/webhooks.ts
interface CallEvent {
  type: 'call_initiated' | 'call_accepted' | 'call_rejected' | 'call_ended';
  call_id: string;
  from: string;
  to: string;
  timestamp: string;
  duration?: number;  // Call duration in seconds (for call_ended)
  reason?: 'user_declined' | 'user_busy' | 'timeout';
}

// app/api/whatsapp/webhook/route.ts
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.field === 'call_events') {
        const callEvent: CallEvent = change.value;

        switch (callEvent.type) {
          case 'call_accepted':
            await handleCallAccepted(callEvent);
            break;

          case 'call_rejected':
            await handleCallRejected(callEvent);
            break;

          case 'call_ended':
            await trackCallDuration(callEvent);
            break;
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
}

async function handleCallAccepted(event: CallEvent) {
  // Log call acceptance
  await db.insert('call_logs', {
    call_id: event.call_id,
    from: event.from,
    to: event.to,
    status: 'accepted',
    timestamp: new Date(event.timestamp)
  });

  // Initiate actual call via VoIP provider
  await initiateCall(event.call_id, event.to);
}

async function handleCallRejected(event: CallEvent) {
  // Send follow-up message
  await sendWhatsAppText(
    event.from,
    `We understand you can't talk now. Please let us know when it's a good time to call. 📞`
  );

  // Schedule callback
  await scheduleCallback(event.from, '1 hour');
}

async function trackCallDuration(event: CallEvent) {
  if (event.duration) {
    await db.update('call_logs', {
      where: { call_id: event.call_id },
      data: {
        duration: event.duration,
        ended_at: new Date()
      }
    });
  }
}
```

### Control Call Icon Visibility

```typescript
async function setCallIconVisibility(
  phoneNumberId: string,
  visible: boolean
): Promise<void> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${phoneNumberId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      },
      body: JSON.stringify({
        calling: {
          enabled: visible
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update call icon visibility');
  }
}

// Disable call icon during off-hours
const isBusinessHours = () => {
  const hour = new Date().getUTCHours();
  return hour >= 9 && hour < 17;  // 9 AM - 5 PM UTC
};

if (!isBusinessHours()) {
  await setCallIconVisibility(phoneNumberId, false);
}
```

### Best Practices

- ✅ Always request permission before business-initiated calls
- ✅ Provide clear reason for call in request
- ✅ Handle rejections gracefully with follow-up options
- ✅ Disable call icon during off-hours to manage expectations
- ✅ Track call analytics (duration, outcome, follow-ups)
- ❌ Don't call without explicit permission
- ❌ Don't enable call icon if you can't handle incoming calls

---

## Product Catalogs & Commerce

Enable product discovery and sales directly in WhatsApp conversations.

### Commerce Manager Setup

1. **Create Catalog** in Meta Commerce Manager
2. **Add Products** with images, descriptions, prices
3. **Link Catalog** to WhatsApp Business Account
4. **Enable Shopping** in WhatsApp Business Profile

### Single Product Message

```typescript
interface ProductMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'product';
    body?: { text: string };
    footer?: { text: string };
    action: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
}

export async function sendProduct(
  to: string,
  productId: string,
  message?: string
): Promise<string | null> {
  const catalogId = process.env.WHATSAPP_CATALOG_ID;
  if (!catalogId) {
    throw new Error('WHATSAPP_CATALOG_ID not configured');
  }

  const payload: ProductMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'product',
      body: message ? { text: message } : undefined,
      footer: { text: 'Powered by migue.ai' },
      action: {
        catalog_id: catalogId,
        product_retailer_id: productId
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage: Send product recommendation based on AI analysis
const userIntent = await classifyIntent(userMessage);
if (userIntent === 'browse_products') {
  await sendProduct(
    from,
    'PRODUCT_SKU_123',
    'Based on your interest, check out this product! 🛍️'
  );
}
```

### Multi-Product List

```typescript
interface ProductListMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'product_list';
    header: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: {
      catalog_id: string;
      sections: Array<{
        title: string;
        product_items: Array<{
          product_retailer_id: string;
        }>;
      }>;
    };
  };
}

export async function sendProductList(
  to: string,
  products: Array<{ categoryName: string; productIds: string[] }>,
  header: string,
  body: string
): Promise<string | null> {
  const catalogId = process.env.WHATSAPP_CATALOG_ID!;

  const payload: ProductListMessage = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'product_list',
      header: { type: 'text', text: header },
      body: { text: body },
      footer: { text: 'Tap to view details' },
      action: {
        catalog_id: catalogId,
        sections: products.map(category => ({
          title: category.categoryName,
          product_items: category.productIds.map(id => ({
            product_retailer_id: id
          }))
        }))
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage: AI-powered product recommendations
const recommendations = await getProductRecommendations(userProfile);
await sendProductList(
  from,
  [
    {
      categoryName: 'Recommended for You',
      productIds: recommendations.slice(0, 10)
    }
  ],
  'Personalized Picks',
  'We selected these products based on your preferences.'
);
```

### Catalog Message (Full Catalog View)

```typescript
export async function sendCatalog(
  to: string,
  body: string
): Promise<string | null> {
  const catalogId = process.env.WHATSAPP_CATALOG_ID!;

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'catalog_message',
      body: { text: body },
      action: {
        name: 'catalog_message',
        parameters: {
          thumbnail_product_retailer_id: 'FEATURED_PRODUCT_ID'
        }
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage
await sendCatalog(
  from,
  'Browse our complete catalog and find the perfect product! 🛒'
);
```

### Handle Product Inquiries

```typescript
interface ProductInquiry {
  type: 'product_inquiry';
  catalog_id: string;
  product_retailer_id: string;
}

// Webhook handler
async function handleProductInquiry(
  from: string,
  inquiry: ProductInquiry
) {
  // Fetch product details
  const product = await getProductDetails(
    inquiry.catalog_id,
    inquiry.product_retailer_id
  );

  // Check inventory
  const inStock = await checkInventory(product.sku);

  if (inStock) {
    await sendInteractiveButtons(
      from,
      `${product.name} is in stock! Price: $${product.price}\n\nWould you like to proceed?`,
      [
        { id: 'add_to_cart', title: 'Add to Cart' },
        { id: 'more_info', title: 'More Info' },
        { id: 'similar', title: 'Similar Items' }
      ],
      { header: product.name }
    );
  } else {
    await sendWhatsAppText(
      from,
      `Sorry, ${product.name} is currently out of stock. We'll notify you when it's available! 📦`
    );
    await subscribeToStockNotification(from, product.sku);
  }
}
```

### Cart Abandonment Flow

```typescript
interface Cart {
  userId: string;
  items: Array<{ productId: string; quantity: number }>;
  lastUpdated: Date;
}

// Cron job: Every hour, check for abandoned carts
export async function checkAbandonedCarts() {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  const abandonedCarts = await db.query<Cart>(`
    SELECT * FROM carts
    WHERE last_updated < $1
    AND status = 'active'
    AND reminder_sent = false
  `, [threshold]);

  for (const cart of abandonedCarts) {
    await sendCartReminder(cart);
  }
}

async function sendCartReminder(cart: Cart) {
  const user = await getUser(cart.userId);

  // Calculate total value
  const total = await calculateCartTotal(cart.items);

  // Send reminder with product list
  const productIds = cart.items.map(item => item.productId);
  await sendProductList(
    user.phone,
    [{ categoryName: 'Your Cart', productIds }],
    'Don\'t forget your items!',
    `You have ${cart.items.length} items waiting. Total: $${total.toFixed(2)}`
  );

  // Mark reminder as sent
  await db.update('carts', {
    where: { id: cart.id },
    data: { reminder_sent: true }
  });
}
```

---

## Block API & Spam Management

The Block API (new in v23.0) helps manage spam and unwanted messages.

### Block a Phone Number

```typescript
export async function blockPhoneNumber(
  phoneNumber: string,
  reason?: string
): Promise<void> {
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
        phone_number: phoneNumber
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to block ${phoneNumber}: ${error}`);
  }

  // Log block event
  await db.insert('blocked_numbers', {
    phone_number: phoneNumber,
    reason: reason || 'spam',
    blocked_at: new Date()
  });

  console.log(`Blocked ${phoneNumber}: ${reason}`);
}
```

### Unblock a Phone Number

```typescript
export async function unblockPhoneNumber(
  phoneNumber: string
): Promise<void> {
  const response = await fetch(
    `${GRAPH_BASE_URL}/${process.env.WHATSAPP_PHONE_ID}/block/${phoneNumber}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to unblock ${phoneNumber}`);
  }

  // Remove from blocked list
  await db.delete('blocked_numbers', {
    where: { phone_number: phoneNumber }
  });

  console.log(`Unblocked ${phoneNumber}`);
}
```

### Automatic Spam Detection

```typescript
interface MessageMetrics {
  from: string;
  messageCount: number;
  lastMessageTime: Date;
  spamScore: number;
}

async function detectSpam(from: string, message: string): Promise<boolean> {
  // Get recent message metrics
  const metrics = await getMessageMetrics(from);

  let spamScore = 0;

  // Rate-based detection: Too many messages in short time
  if (metrics.messageCount > 10) {
    const timeDiff = Date.now() - metrics.lastMessageTime.getTime();
    if (timeDiff < 60000) {  // 10 messages in 1 minute
      spamScore += 50;
    }
  }

  // Content-based detection: Spam keywords
  const spamKeywords = [
    'win free',
    'click here now',
    'limited time offer',
    'act now',
    'congratulations you won'
  ];

  const lowerMessage = message.toLowerCase();
  for (const keyword of spamKeywords) {
    if (lowerMessage.includes(keyword)) {
      spamScore += 20;
    }
  }

  // AI-based spam detection
  if (spamScore < 70) {
    const aiSpamScore = await detectSpamWithAI(message);
    spamScore += aiSpamScore;
  }

  // Update spam score
  await db.update('message_metrics', {
    where: { from },
    data: { spam_score: spamScore }
  });

  return spamScore >= 70;
}

async function detectSpamWithAI(message: string): Promise<number> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a spam detector. Rate messages 0-100 based on spam likelihood. Only respond with a number.'
      },
      {
        role: 'user',
        content: `Rate this message: "${message}"`
      }
    ],
    max_tokens: 10
  });

  return parseInt(response.choices[0]?.message?.content || '0');
}

// Webhook handler with spam detection
export async function POST(req: Request) {
  const body = await req.json();

  for (const entry of body.entry) {
    for (const change of entry.changes) {
      if (change.value.messages) {
        for (const message of change.value.messages) {
          const isSpam = await detectSpam(
            message.from,
            message.text?.body || ''
          );

          if (isSpam) {
            await blockPhoneNumber(
              message.from,
              'Automatic spam detection'
            );
            continue;  // Don't process spam messages
          }

          // Process legitimate message
          await handleMessage(message);
        }
      }
    }
  }

  return new Response('OK', { status: 200 });
}
```

### User Management Integration

```typescript
interface BlockedUser {
  phoneNumber: string;
  reason: string;
  blockedAt: Date;
  unblockAt?: Date;  // Temporary blocks
}

// Temporary block (e.g., rate limit violation)
export async function temporaryBlock(
  phoneNumber: string,
  durationHours: number
): Promise<void> {
  await blockPhoneNumber(phoneNumber, 'Rate limit exceeded');

  const unblockAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

  await db.update('blocked_numbers', {
    where: { phone_number: phoneNumber },
    data: { unblock_at: unblockAt }
  });

  // Schedule unblock
  setTimeout(async () => {
    await unblockPhoneNumber(phoneNumber);
  }, durationHours * 60 * 60 * 1000);
}

// Check if user is blocked before sending
export async function sendMessageSafe(
  to: string,
  message: string
): Promise<string | null> {
  const blocked = await db.findOne('blocked_numbers', {
    where: { phone_number: to }
  });

  if (blocked) {
    console.warn(`Cannot send to blocked number: ${to}`);
    return null;
  }

  return sendWhatsAppText(to, message);
}
```

---

## Advanced Interactive Features

### Dynamic Button Generation

Generate buttons based on user context:

```typescript
interface ButtonConfig {
  id: string;
  title: string;
  condition?: (userContext: any) => boolean;
}

async function sendContextualButtons(
  to: string,
  body: string,
  buttonConfigs: ButtonConfig[],
  userContext: any
): Promise<string | null> {
  // Filter buttons based on conditions
  const availableButtons = buttonConfigs
    .filter(config => !config.condition || config.condition(userContext))
    .slice(0, 3)  // Max 3 buttons
    .map(({ id, title }) => ({ id, title }));

  if (availableButtons.length === 0) {
    // Fallback to text message
    return sendWhatsAppText(to, body);
  }

  return sendInteractiveButtons(to, body, availableButtons);
}

// Usage: Show different buttons based on user state
const user = await getUser(from);

await sendContextualButtons(
  from,
  'What would you like to do?',
  [
    {
      id: 'book_appointment',
      title: 'Book Appointment',
      condition: (u) => !u.hasActiveAppointment
    },
    {
      id: 'view_appointment',
      title: 'View Appointment',
      condition: (u) => u.hasActiveAppointment
    },
    {
      id: 'reschedule',
      title: 'Reschedule',
      condition: (u) => u.hasActiveAppointment
    },
    {
      id: 'cancel',
      title: 'Cancel',
      condition: (u) => u.hasActiveAppointment
    }
  ],
  user
);
```

### Multi-Step Conversations with State

```typescript
interface ConversationState {
  userId: string;
  step: string;
  data: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

async function getConversationState(
  userId: string
): Promise<ConversationState | null> {
  return db.findOne('conversation_states', {
    where: {
      user_id: userId,
      expires_at: { $gt: new Date() }
    }
  });
}

async function updateConversationState(
  userId: string,
  step: string,
  data: Record<string, any>
): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);  // 30 minutes

  await db.upsert('conversation_states', {
    where: { user_id: userId },
    update: { step, data, expires_at: expiresAt },
    create: { user_id: userId, step, data, expires_at: expiresAt }
  });
}

// Example: Multi-step appointment booking
async function handleAppointmentFlow(
  from: string,
  message: string
): Promise<void> {
  const state = await getConversationState(from);

  if (!state) {
    // Start flow
    await sendInteractiveList(
      from,
      'Select a service:',
      'View Services',
      [
        { id: 'consultation', title: 'Consultation', description: '30 min' },
        { id: 'checkup', title: 'Check-up', description: '60 min' },
        { id: 'treatment', title: 'Treatment', description: '90 min' }
      ]
    );

    await updateConversationState(from, 'select_service', {});
    return;
  }

  switch (state.step) {
    case 'select_service':
      // User selected a service
      const service = message;  // From list reply
      await updateConversationState(from, 'select_date', { service });

      await sendWhatsAppText(
        from,
        'Great! When would you like to schedule?'
      );
      // Send date picker or available slots
      break;

    case 'select_date':
      const date = parseDate(message);
      await updateConversationState(from, 'confirm', {
        ...state.data,
        date
      });

      await sendInteractiveButtons(
        from,
        `Confirm appointment:\nService: ${state.data.service}\nDate: ${date}`,
        [
          { id: 'confirm', title: 'Confirm' },
          { id: 'change_date', title: 'Change Date' },
          { id: 'cancel', title: 'Cancel' }
        ]
      );
      break;

    case 'confirm':
      if (message === 'confirm') {
        // Create appointment
        await createAppointment(from, state.data);
        await sendWhatsAppText(
          from,
          `✅ Appointment confirmed!\nService: ${state.data.service}\nDate: ${state.data.date}`
        );

        // Clear state
        await db.delete('conversation_states', { where: { user_id: from } });
      }
      break;
  }
}
```

### CTA URL Buttons with Dynamic Parameters

```typescript
export async function sendDynamicCTA(
  to: string,
  body: string,
  ctaText: string,
  baseUrl: string,
  params: Record<string, string>
): Promise<string | null> {
  // Build URL with query parameters
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: body },
      action: {
        name: 'cta_url',
        parameters: {
          display_text: ctaText,
          url: url.toString()
        }
      }
    }
  };

  const result = await sendWhatsAppRequest(payload);
  return result?.messages?.[0]?.id ?? null;
}

// Usage: Personalized tracking links
await sendDynamicCTA(
  from,
  'Track your order #12345',
  'Track Now',
  'https://example.com/track',
  {
    order_id: '12345',
    user_id: userId,
    utm_source: 'whatsapp',
    utm_campaign: 'order_tracking'
  }
);
```

---

## Template Message Optimization

### Template Design Best Practices

**1. Clear and Concise:**
```typescript
// ❌ Too verbose
const template = {
  name: 'appointment_reminder_verbose',
  body: 'Dear valued customer, we would like to remind you that you have an upcoming appointment scheduled with us on {{1}} at {{2}}. Please make sure to arrive 15 minutes early...'
};

// ✅ Concise and actionable
const template = {
  name: 'appointment_reminder',
  body: 'Reminder: Appointment on {{1}} at {{2}}. Please arrive 15 min early. Reply YES to confirm.'
};
```

**2. Personalization:**
```typescript
// Use customer data for personalization
const template = {
  name: 'personalized_offer',
  components: [
    {
      type: 'header',
      parameters: [
        { type: 'text', text: customer.firstName }
      ]
    },
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customer.lastPurchase },
        { type: 'text', text: recommendedProduct }
      ]
    }
  ]
};
```

### Template Caching Strategy

```typescript
interface TemplateCache {
  name: string;
  language: string;
  components: any[];
  cachedAt: Date;
}

const templateCache = new Map<string, TemplateCache>();

async function getTemplate(
  name: string,
  language: string = 'en_US'
): Promise<TemplateCache> {
  const cacheKey = `${name}_${language}`;
  const cached = templateCache.get(cacheKey);

  if (cached && (Date.now() - cached.cachedAt.getTime()) < 3600000) {
    return cached;
  }

  // Fetch from Meta API
  const template = await fetchTemplateFromMeta(name, language);

  const cacheEntry: TemplateCache = {
    name: template.name,
    language: template.language,
    components: template.components,
    cachedAt: new Date()
  };

  templateCache.set(cacheKey, cacheEntry);
  return cacheEntry;
}
```

### A/B Testing Templates

```typescript
interface TemplateVariant {
  name: string;
  weight: number;  // 0-100
  conversions: number;
  sends: number;
}

async function sendTemplateWithABTest(
  to: string,
  variants: TemplateVariant[],
  parameters: any[]
): Promise<string | null> {
  // Select variant based on weight
  const selected = selectVariant(variants);

  // Send template
  const messageId = await sendTemplate(to, selected.name, parameters);

  // Track send
  await db.increment('template_variants', {
    where: { name: selected.name },
    field: 'sends'
  });

  return messageId;
}

function selectVariant(variants: TemplateVariant[]): TemplateVariant {
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;

  for (const variant of variants) {
    random -= variant.weight;
    if (random <= 0) {
      return variant;
    }
  }

  return variants[0]!;  // Fallback
}

// Track conversions
async function trackTemplateConversion(messageId: string) {
  const message = await db.findOne('sent_messages', {
    where: { message_id: messageId }
  });

  if (message?.template_name) {
    await db.increment('template_variants', {
      where: { name: message.template_name },
      field: 'conversions'
    });
  }
}
```

### 2025 Pricing Optimization

```typescript
// Optimize for new per-message pricing model
async function optimizeCostPerMessage(
  to: string,
  messages: string[]
): Promise<void> {
  const windowOpen = await checkServiceWindow(to);

  if (windowOpen) {
    // Send as service messages (FREE)
    for (const message of messages) {
      await sendWhatsAppText(to, message);
      await new Promise(r => setTimeout(r, 100));  // Avoid rate limits
    }
  } else {
    // Combine into single template message (ONE charge)
    const combined = messages.join('\n\n');
    await sendTemplate(to, 'multi_update', {
      body: combined
    });
  }
}
```

---

## Media Handling & Processing

### Efficient Media Upload

```typescript
export async function uploadMedia(
  file: Buffer,
  mimeType: string,
  filename?: string
): Promise<string> {
  const formData = new FormData();

  const blob = new Blob([file], { type: mimeType });
  formData.append('file', blob, filename);
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

  if (!response.ok) {
    throw new Error('Media upload failed');
  }

  const data = await response.json();
  return data.id;
}
```

### Media Caching with Supabase Storage

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!
);

async function cacheMedia(
  mediaId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const extension = mimeType.split('/')[1];
  const filename = `${mediaId}.${extension}`;

  const { data, error } = await supabase.storage
    .from('whatsapp-media')
    .upload(filename, buffer, {
      contentType: mimeType,
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    throw new Error(`Media cache failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from('whatsapp-media')
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

async function getCachedMedia(mediaId: string): Promise<string | null> {
  // Check if media exists in cache
  const { data } = await supabase.storage
    .from('whatsapp-media')
    .list('', { search: mediaId });

  if (data && data.length > 0) {
    const { data: urlData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(data[0]!.name);

    return urlData.publicUrl;
  }

  return null;
}
```

### Image Optimization

```typescript
import sharp from 'sharp';  // Note: Not Edge-compatible, use in API route

async function optimizeImage(
  buffer: Buffer,
  maxWidth: number = 1600
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside'
    })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
}

// Usage in API route (Node.js runtime)
export const config = { runtime: 'nodejs' };  // NOT edge

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('image') as File;

  const buffer = Buffer.from(await file.arrayBuffer());
  const optimized = await optimizeImage(buffer);

  const mediaId = await uploadMedia(optimized, 'image/jpeg');

  return Response.json({ mediaId });
}
```

### Audio Transcription with Whisper

```typescript
import { openai } from '@/lib/openai';

async function transcribeAudio(
  mediaId: string
): Promise<string> {
  // Download audio from WhatsApp
  const audioBuffer = await downloadMedia(mediaId);

  // Create file from buffer
  const audioFile = new File(
    [audioBuffer],
    'audio.ogg',
    { type: 'audio/ogg' }
  );

  // Transcribe with Whisper
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'es'  // Spanish for migue.ai
  });

  return transcription.text;
}

// Webhook handler for audio messages
if (message.type === 'audio') {
  const transcript = await transcribeAudio(message.audio.id);

  // Process transcript with AI
  const response = await generateResponse(from, transcript, context);

  await sendWhatsAppText(from, response);
}
```

### Download Media Helper

```typescript
async function downloadMedia(mediaId: string): Promise<Buffer> {
  // Get media URL
  const urlResponse = await fetch(
    `${GRAPH_BASE_URL}/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
      }
    }
  );

  const urlData = await urlResponse.json();

  // Download media
  const mediaResponse = await fetch(urlData.url, {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`
    }
  });

  return Buffer.from(await mediaResponse.arrayBuffer());
}
```

---

## Broadcast Messaging

### Batch Processing Strategy

```typescript
interface BroadcastMessage {
  id: string;
  recipients: string[];
  template: string;
  parameters: Record<string, any>;
  scheduledFor: Date;
}

async function sendBroadcast(
  broadcast: BroadcastMessage
): Promise<void> {
  const batchSize = 200;  // Under 250 msg/sec limit
  const delayMs = 1000;  // 1 second between batches

  for (let i = 0; i < broadcast.recipients.length; i += batchSize) {
    const batch = broadcast.recipients.slice(i, i + batchSize);

    // Send batch concurrently
    await Promise.all(
      batch.map(recipient =>
        sendTemplate(
          recipient,
          broadcast.template,
          broadcast.parameters
        ).catch(error => {
          console.error(`Failed to send to ${recipient}:`, error);
          // Log failure but continue with other recipients
        })
      )
    );

    // Rate limit compliance
    if (i + batchSize < broadcast.recipients.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}
```

### Segmentation Strategies

```typescript
interface Segment {
  name: string;
  filter: (user: User) => boolean;
  priority: number;
}

const segments: Segment[] = [
  {
    name: 'High Value Customers',
    filter: (u) => u.lifetimeValue > 1000,
    priority: 1
  },
  {
    name: 'Recent Purchasers',
    filter: (u) => {
      const daysSinceLastPurchase =
        (Date.now() - u.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastPurchase < 30;
    },
    priority: 2
  },
  {
    name: 'Inactive Users',
    filter: (u) => {
      const daysSinceLastMessage =
        (Date.now() - u.lastMessageDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceLastMessage > 90;
    },
    priority: 3
  }
];

async function segmentUsers(
  users: User[],
  segment: Segment
): Promise<User[]> {
  return users.filter(segment.filter);
}

// Send targeted broadcast
async function sendTargetedBroadcast(
  segmentName: string,
  template: string
) {
  const segment = segments.find(s => s.name === segmentName);
  if (!segment) {
    throw new Error(`Segment not found: ${segmentName}`);
  }

  const allUsers = await getAllUsers();
  const targetUsers = await segmentUsers(allUsers, segment);

  await sendBroadcast({
    id: crypto.randomUUID(),
    recipients: targetUsers.map(u => u.phone),
    template,
    parameters: {},
    scheduledFor: new Date()
  });
}
```

Continuando con el archivo whatsapp-api-v23-advanced.md...

---

## Performance Optimization

### Sub-100ms Response Targets

```typescript
// Track and optimize API latency
export async function sendWhatsAppRequest(
  payload: WhatsAppPayload
): Promise<any> {
  const startTime = Date.now();

  try {
    await rateLimit();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        // Edge caching with stale-while-revalidate
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400'
      },
      body: JSON.stringify(payload)
    });

    const latency = Date.now() - startTime;

    // Log slow requests
    if (latency > 100) {
      console.warn(`WhatsApp API slow response: ${latency}ms`, {
        type: payload.type,
        to: payload.to
      });
    }

    // Track metrics
    await trackMetric('whatsapp_api_latency', latency);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`WhatsApp API error after ${latency}ms:`, error);
    throw error;
  }
}
```

### Edge Caching Strategies

```typescript
// Message deduplication cache
const messageCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 3600 * 1000;  // 1 hour

async function sendWithDeduplication(
  payload: WhatsAppPayload
): Promise<any> {
  const cacheKey = JSON.stringify(payload);
  const cached = messageCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log('Cache hit - skipping duplicate message');
    return cached.data;
  }

  const data = await sendWhatsAppRequest(payload);

  messageCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  // Cleanup old cache entries
  if (messageCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of messageCache) {
      if (now - value.timestamp > CACHE_TTL) {
        messageCache.delete(key);
      }
    }
  }

  return data;
}
```

### Database Query Optimization

```typescript
// Add indexes for common queries
// supabase/migrations/20250101_optimize_queries.sql
CREATE INDEX idx_messages_user_timestamp
  ON messages(user_id, created_at DESC);

CREATE INDEX idx_messages_status
  ON messages(status, created_at);

CREATE INDEX idx_conversation_states_user_expires
  ON conversation_states(user_id, expires_at);

// Use efficient queries
async function getRecentConversation(
  userId: string,
  limit: number = 10
): Promise<Message[]> {
  // Optimized query with index
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}
```

### Lazy Loading Patterns

```typescript
// Load conversation history on demand
async function getConversationContext(
  userId: string
): Promise<string> {
  // Start with minimal context
  const recentMessages = await getRecentConversation(userId, 5);

  // If needed, load more context
  if (requiresDeepContext(recentMessages)) {
    const fullHistory = await getRecentConversation(userId, 20);
    return formatContext(fullHistory);
  }

  return formatContext(recentMessages);
}

function requiresDeepContext(messages: Message[]): boolean {
  // Check if conversation needs more context
  const hasComplexQuery = messages.some(m =>
    m.content.length > 200 ||
    m.content.includes('previous') ||
    m.content.includes('earlier')
  );

  return hasComplexQuery;
}
```

### Connection Pooling for Supabase

```typescript
import { createClient } from '@supabase/supabase-js';

// Single client instance with connection pooling
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_KEY!,
  {
    db: {
      schema: 'public'
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        'x-application-name': 'migue.ai'
      }
    }
  }
);

// Reuse connection across requests
export function getSupabaseServerClient() {
  return supabase;
}
```

---

## Security Best Practices

### Webhook Signature Validation

```typescript
import crypto from 'crypto';

export function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}

// Webhook handler with validation
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256');

  if (!validateWebhookSignature(
    rawBody,
    signature,
    process.env.WHATSAPP_APP_SECRET!
  )) {
    return new Response('Invalid signature', { status: 403 });
  }

  const body = JSON.parse(rawBody);
  // Process webhook...
}
```

### Access Token Management

```typescript
interface TokenConfig {
  accessToken: string;
  expiresAt: Date;
  refreshToken?: string;
}

class TokenManager {
  private token: TokenConfig | null = null;

  async getValidToken(): Promise<string> {
    if (this.token && this.token.expiresAt > new Date()) {
      return this.token.accessToken;
    }

    // Refresh or get new token
    await this.refreshToken();
    return this.token!.accessToken;
  }

  private async refreshToken(): Promise<void> {
    // Implement token refresh logic
    // For system user tokens, rotation is less frequent
    const newToken = process.env.WHATSAPP_TOKEN!;

    this.token = {
      accessToken: newToken,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)  // 90 days
    };
  }
}

export const tokenManager = new TokenManager();
```

### Phone Number Verification

```typescript
function validatePhoneNumber(phone: string): boolean {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Must be 10-15 digits (international format)
  if (cleaned.length < 10 || cleaned.length > 15) {
    return false;
  }

  // Additional validation rules
  // - Must start with country code
  // - No repeated patterns
  return true;
}

async function sendToVerifiedNumber(
  phone: string,
  message: string
): Promise<string | null> {
  if (!validatePhoneNumber(phone)) {
    throw new Error('Invalid phone number format');
  }

  // Check if number is registered on WhatsApp
  const isRegistered = await checkWhatsAppRegistration(phone);
  if (!isRegistered) {
    console.warn(`Phone not on WhatsApp: ${phone}`);
    return null;
  }

  return sendWhatsAppText(phone, message);
}
```

### PII Handling Compliance

```typescript
// Encrypt sensitive data before storing
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY!,
  'hex'
);

function encryptPII(data: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

function decryptPII(encrypted: string): string {
  const [ivHex, data] = encrypted.split(':');
  const iv = Buffer.from(ivHex!, 'hex');

  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);

  let decrypted = decipher.update(data!, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Store user data with encryption
async function storeUserData(user: {
  phone: string;
  name: string;
  email?: string;
}) {
  await db.insert('users', {
    phone: user.phone,  // Not encrypted (needed for lookup)
    name: encryptPII(user.name),
    email: user.email ? encryptPII(user.email) : null,
    created_at: new Date()
  });
}
```

### Rate Limiting for Abuse Prevention

```typescript
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimits = new Map<string, number[]>();

function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): boolean {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Get user's recent requests
  let requests = rateLimits.get(userId) || [];

  // Remove old requests
  requests = requests.filter(time => time > windowStart);

  // Check limit
  if (requests.length >= config.maxRequests) {
    return false;  // Rate limit exceeded
  }

  // Add current request
  requests.push(now);
  rateLimits.set(userId, requests);

  return true;  // Within limit
}

// Apply rate limiting in webhook
async function handleMessage(message: Message) {
  const allowed = checkRateLimit(message.from, {
    windowMs: 60000,  // 1 minute
    maxRequests: 10   // 10 messages per minute
  });

  if (!allowed) {
    await sendWhatsAppText(
      message.from,
      'You\'re sending messages too quickly. Please wait a moment.'
    );
    return;
  }

  // Process message...
}
```

---

## AI Integration Patterns

### GPT-4o for Intent Classification

```typescript
import { openai } from '@/lib/openai';

interface Intent {
  type: string;
  confidence: number;
  entities: Record<string, any>;
}

export async function classifyIntent(
  message: string,
  context?: string
): Promise<Intent> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an intent classifier. Analyze messages and respond with JSON:
{
  "type": "appointment_booking" | "question" | "complaint" | "feedback" | "other",
  "confidence": 0.0-1.0,
  "entities": { extracted entities }
}

Available intents:
- appointment_booking: User wants to schedule
- question: User asking for information
- complaint: User has an issue
- feedback: User providing feedback
- other: Unclear intent`
      },
      ...(context ? [{ role: 'assistant', content: context }] : []),
      {
        role: 'user',
        content: message
      }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3
  });

  return JSON.parse(response.choices[0]?.message?.content || '{}');
}

// Usage in webhook
async function handleMessage(message: Message) {
  const context = await getConversationContext(message.from);
  const intent = await classifyIntent(message.text.body, context);

  switch (intent.type) {
    case 'appointment_booking':
      await handleAppointmentFlow(message.from, message.text.body);
      break;

    case 'question':
      const answer = await generateResponse(
        message.from,
        message.text.body,
        context
      );
      await sendWhatsAppText(message.from, answer);
      break;

    case 'complaint':
      await escalateToHuman(message.from, message.text.body);
      break;
  }
}
```

### Contextual Response Generation

```typescript
export async function generateResponse(
  userId: string,
  message: string,
  context: string
): Promise<string> {
  const user = await getUser(userId);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are Migue, a helpful AI assistant for a business.

Business Context:
- Name: ${process.env.BUSINESS_NAME}
- Services: ${process.env.BUSINESS_SERVICES}
- Hours: ${process.env.BUSINESS_HOURS}

Guidelines:
- Be friendly and professional
- Keep responses concise (max 300 characters for WhatsApp)
- Use emojis sparingly
- Provide actionable next steps
- Escalate complex issues to human agents`
      },
      {
        role: 'assistant',
        content: context
      },
      {
        role: 'user',
        content: message
      }
    ],
    max_tokens: 150,
    temperature: 0.7,
    user: userId  // For usage tracking
  });

  return response.choices[0]?.message?.content ||
    'I apologize, I couldn\'t process that. Please try again.';
}
```

### Conversation Memory Management

```typescript
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

async function getConversationHistory(
  userId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  const messages = await db.query<Message>(`
    SELECT role, content, created_at as timestamp
    FROM messages
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return messages.reverse();  // Chronological order
}

function formatConversationContext(
  messages: ConversationMessage[]
): string {
  return messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
}

// Sliding window for token management
async function getOptimizedContext(
  userId: string
): Promise<string> {
  const messages = await getConversationHistory(userId, 20);

  // Estimate tokens (rough: 4 chars = 1 token)
  let totalChars = 0;
  const maxChars = 4000;  // ~1000 tokens
  const included: ConversationMessage[] = [];

  // Include most recent messages within token limit
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!;
    const msgChars = msg.content.length;

    if (totalChars + msgChars > maxChars) {
      break;
    }

    included.unshift(msg);
    totalChars += msgChars;
  }

  return formatConversationContext(included);
}
```

### Vector Embeddings for RAG

```typescript
import { openai } from '@/lib/openai';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });

  return response.data[0]?.embedding || [];
}

async function findSimilarDocuments(
  query: string,
  limit: number = 3
): Promise<any[]> {
  const queryEmbedding = await generateEmbedding(query);

  // Use pgvector in Supabase
  const { data } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: limit
  });

  return data || [];
}

// RAG-powered response
export async function generateRAGResponse(
  userId: string,
  question: string
): Promise<string> {
  // Find relevant documents
  const documents = await findSimilarDocuments(question);

  const context = documents
    .map(doc => doc.content)
    .join('\n\n');

  // Generate response with context
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Answer the question using the provided context.

Context:
${context}`
      },
      {
        role: 'user',
        content: question
      }
    ],
    temperature: 0.5
  });

  return response.choices[0]?.message?.content ||
    'I couldn\'t find relevant information.';
}
```

---

## Analytics & Monitoring

### Message Delivery Tracking

```typescript
interface MessageMetrics {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
}

async function getMessageMetrics(
  startDate: Date,
  endDate: Date
): Promise<MessageMetrics> {
  const { data } = await supabase.rpc('get_message_metrics', {
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString()
  });

  const metrics = data[0];

  return {
    ...metrics,
    deliveryRate: metrics.delivered / metrics.sent,
    readRate: metrics.read / metrics.delivered
  };
}

// SQL function for metrics
/*
CREATE OR REPLACE FUNCTION get_message_metrics(
  start_date timestamp,
  end_date timestamp
)
RETURNS TABLE (
  sent bigint,
  delivered bigint,
  read bigint,
  failed bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'sent') as sent,
    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
    COUNT(*) FILTER (WHERE status = 'read') as read,
    COUNT(*) FILTER (WHERE status = 'failed') as failed
  FROM message_status
  WHERE created_at BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;
*/
```

### User Engagement Metrics

```typescript
interface EngagementMetrics {
  activeUsers: number;
  messageVolume: number;
  avgResponseTime: number;  // milliseconds
  conversationStarts: number;
}

async function getEngagementMetrics(
  period: 'day' | 'week' | 'month'
): Promise<EngagementMetrics> {
  const startDate = getStartDate(period);

  const { data } = await supabase.rpc('get_engagement_metrics', {
    start_date: startDate.toISOString()
  });

  return data[0];
}

function getStartDate(period: 'day' | 'week' | 'month'): Date {
  const now = new Date();

  switch (period) {
    case 'day':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}
```

### Cost Analysis

```typescript
interface CostMetrics {
  totalCost: number;
  messageCount: number;
  costPerMessage: number;
  byCategory: Record<string, { count: number; cost: number }>;
}

async function getCostMetrics(
  startDate: Date,
  endDate: Date
): Promise<CostMetrics> {
  const { data } = await supabase
    .from('message_costs')
    .select('category, billable, price')
    .gte('timestamp', startDate.toISOString())
    .lte('timestamp', endDate.toISOString());

  const byCategory: Record<string, { count: number; cost: number }> = {};
  let totalCost = 0;
  let messageCount = 0;

  for (const row of data || []) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = { count: 0, cost: 0 };
    }

    byCategory[row.category]!.count++;
    byCategory[row.category]!.cost += row.billable ? row.price : 0;

    totalCost += row.billable ? row.price : 0;
    messageCount++;
  }

  return {
    totalCost,
    messageCount,
    costPerMessage: messageCount > 0 ? totalCost / messageCount : 0,
    byCategory
  };
}

// Monitor cost threshold
async function checkCostThreshold() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const metrics = await getCostMetrics(startOfMonth, today);

  const threshold = parseFloat(process.env.MONTHLY_COST_THRESHOLD || '1000');

  if (metrics.totalCost > threshold) {
    await sendAlert(
      `Monthly WhatsApp costs exceed threshold: $${metrics.totalCost.toFixed(2)}`
    );
  }
}
```

---

## Troubleshooting Guide

### Common Issues

#### 1. Messages Not Delivering

**Symptoms:**
- Messages stuck in "sent" status
- Error code 131000 or 131047

**Solutions:**

```typescript
async function troubleshootDelivery(messageId: string) {
  const message = await db.findOne('messages', {
    where: { message_id: messageId }
  });

  if (!message) {
    return 'Message not found in database';
  }

  // Check message status
  const status = await getMessageStatus(messageId);

  switch (status.status) {
    case 'failed':
      const error = status.errors?.[0];
      if (error?.code === 131000) {
        return 'User cannot receive messages (no WhatsApp or blocked)';
      }
      if (error?.code === 131047) {
        return '24-hour window expired - use template message';
      }
      return `Failed with error ${error?.code}: ${error?.message}`;

    case 'sent':
      const timeSinceSent = Date.now() - new Date(status.timestamp).getTime();
      if (timeSinceSent > 300000) {  // 5 minutes
        return 'Delivery delayed - user may be offline';
      }
      return 'Message sent, waiting for delivery';

    case 'delivered':
      return 'Message delivered successfully';

    case 'read':
      return 'Message read by user';
  }
}
```

#### 2. Webhook Not Receiving Events

**Checklist:**

```typescript
async function diagnoseWebhook() {
  const checks = [];

  // 1. Verify webhook URL is accessible
  try {
    const response = await fetch(process.env.WEBHOOK_URL + '/api/whatsapp/webhook');
    checks.push({
      test: 'Webhook URL accessible',
      passed: response.status === 200 || response.status === 405,
      details: `Status: ${response.status}`
    });
  } catch (error) {
    checks.push({
      test: 'Webhook URL accessible',
      passed: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 2. Check webhook configuration in Meta
  checks.push({
    test: 'Webhook URL matches Meta configuration',
    passed: true,  // Manual check
    details: 'Verify in Meta App Dashboard'
  });

  // 3. Check verify token
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  checks.push({
    test: 'Verify token configured',
    passed: !!verifyToken && verifyToken.length > 0,
    details: verifyToken ? 'Set' : 'Missing'
  });

  // 4. Test webhook verification
  const testUrl = `${process.env.WEBHOOK_URL}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test`;
  try {
    const response = await fetch(testUrl);
    const challenge = await response.text();
    checks.push({
      test: 'Webhook verification',
      passed: challenge === 'test',
      details: `Response: ${challenge}`
    });
  } catch (error) {
    checks.push({
      test: 'Webhook verification',
      passed: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  return checks;
}
```

#### 3. Rate Limit Errors

**Solution:**

```typescript
async function handleRateLimitError(error: any) {
  if (error.code === 131026 || error.code === 368) {
    // Exponential backoff
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      const delay = Math.pow(2, retries) * 1000;  // 1s, 2s, 4s, 8s, 16s

      console.log(`Rate limited, retrying in ${delay}ms (attempt ${retries + 1}/${maxRetries})`);

      await new Promise(r => setTimeout(r, delay));

      try {
        // Retry the request
        return await sendWhatsAppRequest(payload);
      } catch (retryError: any) {
        if (retryError.code !== 131026 && retryError.code !== 368) {
          throw retryError;  // Different error, don't retry
        }
        retries++;
      }
    }

    throw new Error('Max retries exceeded for rate limit');
  }

  throw error;  // Not a rate limit error
}
```

#### 4. Template Message Rejected

**Common Reasons:**

```typescript
interface TemplateRejectionReason {
  code: string;
  description: string;
  solution: string;
}

const rejectionReasons: TemplateRejectionReason[] = [
  {
    code: 'INVALID_FORMAT',
    description: 'Template format is incorrect',
    solution: 'Review WhatsApp template guidelines and fix formatting'
  },
  {
    code: 'ABUSIVE_CONTENT',
    description: 'Template contains abusive or inappropriate content',
    solution: 'Remove offensive language and resubmit'
  },
  {
    code: 'PROMOTIONAL',
    description: 'Template is too promotional (wrong category)',
    solution: 'Change category to MARKETING or make content more transactional'
  },
  {
    code: 'VARIABLE_MISMATCH',
    description: 'Variables don\'t match placeholders',
    solution: 'Ensure all {{1}}, {{2}}, etc. have corresponding parameters'
  }
];

async function diagnoseTemplateRejection(templateName: string) {
  // Fetch template status from Meta
  const template = await getTemplateStatus(templateName);

  if (template.status === 'REJECTED') {
    const reason = rejectionReasons.find(r =>
      template.rejectionReason?.includes(r.code)
    );

    return {
      template: templateName,
      status: 'REJECTED',
      reason: reason?.description || 'Unknown reason',
      solution: reason?.solution || 'Contact Meta support'
    };
  }

  return { template: templateName, status: template.status };
}
```

---

## Summary

This advanced guide covers:

- ✅ **WhatsApp Business Calling API**: Voice calls in conversations
- ✅ **Product Catalogs**: E-commerce integration
- ✅ **Block API**: Spam management
- ✅ **Advanced Interactive**: Dynamic buttons, multi-step flows
- ✅ **Template Optimization**: A/B testing, pricing optimization
- ✅ **Media Handling**: Upload, caching, transcription
- ✅ **Broadcasting**: Segmentation, batch processing
- ✅ **Performance**: Sub-100ms targets, caching strategies
- ✅ **Security**: Signature validation, PII encryption
- ✅ **AI Integration**: GPT-4o, embeddings, RAG
- ✅ **Analytics**: Metrics, cost tracking
- ✅ **Troubleshooting**: Common issues and solutions

### Related Documentation

- [API Reference](./whatsapp-api-v23-reference.md) - Complete API documentation
- [Migration Guide](./whatsapp-api-v23-migration.md) - Upgrade to v23.0
- [WhatsApp Flows](./whatsapp-api-v23-flows.md) - Interactive flows deep dive
- [migue.ai Architecture](../CLAUDE.md) - Project overview

---

**Last Updated:** October 2025
**Version:** 1.0.0
