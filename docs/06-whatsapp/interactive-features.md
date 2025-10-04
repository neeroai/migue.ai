# WhatsApp Interactive Features

Interactive messaging features for enhanced user experience in migue.ai.

## Currently Implemented ✅

### Interactive Buttons (≤3 options)
```typescript
import { sendInteractiveButtons } from '@/lib/whatsapp';

await sendInteractiveButtons({
  to: phoneNumber,
  body: 'Choose an option:',
  buttons: [
    { id: 'option1', title: 'Option 1' },
    { id: 'option2', title: 'Option 2' },
    { id: 'option3', title: 'Option 3' }
  ]
});
```

### Interactive Lists (4+ options)
```typescript
import { sendInteractiveList } from '@/lib/whatsapp';

await sendInteractiveList({
  to: phoneNumber,
  body: 'Select from menu:',
  buttonLabel: 'View Options',
  rows: [
    { id: 'opt1', title: 'Option 1', description: 'Details' },
    { id: 'opt2', title: 'Option 2', description: 'Details' },
    // ... up to 10 rows per section
  ]
});
```

### Reactions
```typescript
import { sendReaction, reactWithCheck, reactWithThinking } from '@/lib/whatsapp';

// Emoji reaction
await sendReaction({ messageId, emoji: '👍' });

// Quick helpers
await reactWithCheck(messageId);      // ✅
await reactWithThinking(messageId);   // 🤔
```

### Typing Indicators
```typescript
import { createTypingManager } from '@/lib/whatsapp';

const typing = createTypingManager(phoneNumber);
await typing.startWithDuration(5);  // Show "typing..." for 5 seconds
```

### Read Receipts
```typescript
import { markAsRead } from '@/lib/whatsapp';

await markAsRead(messageId);
```

## Advanced Features (Not Yet Implemented)

### Call-to-Action (CTA) Buttons
Open external URLs from WhatsApp messages.

**Use cases**:
- Link to website/landing page
- Open Maps location
- Direct to payment page

**Payload**:
```typescript
{
  type: 'interactive',
  interactive: {
    type: 'cta_url',
    body: { text: 'Check out our products!' },
    action: {
      name: 'cta_url',
      parameters: {
        display_text: 'Visit Website',
        url: 'https://example.com'
      }
    }
  }
}
```

### Location Requests
Request user's current location.

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'location_request_message',
    body: { text: 'Share your location for delivery' },
    action: {
      name: 'send_location'
    }
  }
}
```

### Call Permission Requests
Request permission to call the user (v23.0).

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'call_permission_request',
    body: { text: 'May we call you?' },
    action: {
      name: 'request_call_permission'
    }
  }
}
```

### Product Catalogs
Display product catalogs from WhatsApp Business Manager.

```typescript
{
  type: 'interactive',
  interactive: {
    type: 'product',
    action: {
      catalog_id: 'YOUR_CATALOG_ID',
      product_retailer_id: 'PRODUCT_ID'
    }
  }
}
```

## Best Practices

### When to Use What

| Options | Use | Example |
|---------|-----|---------|
| 1-3 | Buttons | Yes/No, Choose A/B/C |
| 4-10 | Lists | Menu options, Categories |
| External action | CTA Buttons | Visit website, Make payment |

### Response Handling

```typescript
// Handle button responses
if (message.interactive?.type === 'button_reply') {
  const buttonId = message.interactive.button_reply.id;
  // Process button selection
}

// Handle list responses
if (message.interactive?.type === 'list_reply') {
  const selectedId = message.interactive.list_reply.id;
  // Process list selection
}
```

### Error Handling

```typescript
try {
  await sendInteractiveButtons(params);
} catch (error) {
  // Fallback to text message
  await sendMessage({
    to: phone,
    text: 'Please reply: 1 for Option 1, 2 for Option 2'
  });
}
```

## Implementation Priority

**High Priority** (Fase 2-3):
1. CTA Buttons - For payment links, booking links
2. Location Requests - For delivery/appointment scheduling

**Medium Priority** (Fase 3-4):
1. Product Catalogs - For e-commerce features
2. Call Permission - For complex support cases

**Low Priority**:
1. Advanced button combinations
2. Multi-product messages

## Edge Runtime Compatibility

All features are Edge Runtime compatible using standard `fetch()` API.

## Related Documentation

- [API v23 Guide](./api-v23-guide.md) - Core API reference
- [Flows Implementation](./flows-implementation.md) - WhatsApp Flows
- Implementation: `lib/whatsapp.ts`

## External Resources

- [WhatsApp Interactive Messages Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages#interactive-messages)
- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)

---

**Last Updated**: 2025-10-03
**Implementation**: See `lib/whatsapp.ts`
