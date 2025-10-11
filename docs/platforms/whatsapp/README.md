# WhatsApp Integration

Complete WhatsApp Business API integration documentation for migue.ai.

## Overview

migue.ai integrates with WhatsApp Business API v23.0 for messaging, including support for:
- Text messages
- Interactive messages (buttons, lists)
- Audio transcription
- Reactions and typing indicators
- WhatsApp Flows (advanced forms)

## Documentation

### Core Integration
- **[api-v23-guide.md](./api-v23-guide.md)** - Comprehensive API v23 guide (migration, features, reference)
- **[integration-plan.md](./integration-plan.md)** - Integration architecture and implementation plan

### Pricing & Templates (2025) 💰
- **[pricing-guide-2025.md](./pricing-guide-2025.md)** - Complete pricing guide, 24h windows, cost optimization
- **[template-troubleshooting.md](./template-troubleshooting.md)** - Fix template categorization issues (UTILITY vs MARKETING)
- **[service-conversations.md](./service-conversations.md)** - FREE SERVICE templates (Nov 2024 update)

### Advanced Features
- **[flows-implementation.md](./flows-implementation.md)** - WhatsApp Flows implementation guide
- **[interactive-features.md](./interactive-features.md)** - Buttons, lists, and quick replies

### SaaS & Multi-Tenant 🚀
- **[multi-tenant-architecture.md](./multi-tenant-architecture.md)** - Complete guide for building multi-client chatbots with one Facebook app

## Quick Reference

### Send Text Message
```typescript
import { sendMessage } from '@/lib/whatsapp';

await sendMessage({
  to: phoneNumber,
  text: 'Hello from migue.ai!'
});
```

### Send Interactive Buttons
```typescript
import { sendInteractiveButtons } from '@/lib/whatsapp';

await sendInteractiveButtons({
  to: phoneNumber,
  body: 'Choose an option:',
  buttons: [
    { id: 'option1', title: 'Option 1' },
    { id: 'option2', title: 'Option 2' }
  ]
});
```

### Send Reaction
```typescript
import { sendReaction } from '@/lib/whatsapp';

await sendReaction({
  messageId: incomingMessageId,
  emoji: '👍'
});
```

## Key Features

| Feature | Status | Documentation |
|---------|--------|---------------|
| Text Messages | ✅ Implemented | [api-v23-guide.md](./api-v23-guide.md) |
| Interactive Buttons | ✅ Implemented | [interactive-features.md](./interactive-features.md) |
| Interactive Lists | ✅ Implemented | [interactive-features.md](./interactive-features.md) |
| Reactions | ✅ Implemented | [api-v23-guide.md](./api-v23-guide.md) |
| Typing Indicators | ✅ Implemented | [api-v23-guide.md](./api-v23-guide.md) |
| Read Receipts | ✅ Implemented | [api-v23-guide.md](./api-v23-guide.md) |
| WhatsApp Flows | 🔄 In Progress | [flows-implementation.md](./flows-implementation.md) |
| Media Messages | 🔄 In Progress | [api-v23-guide.md](./api-v23-guide.md) |

## API Limits

- **Messages per second**: 80 (Business API tier)
- **Message length**: 4096 characters
- **Buttons per message**: 3 (use lists for 4+)
- **List rows**: Up to 10 per section

## Pricing (2025 Update)

### 24-Hour Messaging Window ⭐
- **FREE**: All messages within 24h of user message
- **90%+ of conversations**: Stay within free window (migue.ai system)

### Template Messages (Outside 24h)
- **SERVICE**: $0.00 (FREE unlimited - use for support) 🆕
- **UTILITY**: $0.0125 (transactional)
- **MARKETING**: $0.0667 (promotional)
- **AUTHENTICATION**: $0.0100 (OTP codes)

**See**: [Pricing Guide 2025](./pricing-guide-2025.md) for complete details

## Best Practices

### Use Interactive Messages
Prefer buttons/lists over text for user choices:
- **Buttons**: 1-3 options
- **Lists**: 4+ options
- Better UX + structured responses

### Handle Rate Limits
```typescript
// Use exponential backoff for retries
const result = await sendMessageWithRetry(params);
```

### Error Handling
```typescript
try {
  await sendMessage(params);
} catch (error) {
  // Log to Supabase for monitoring
  await logError(error);
  // Fallback to basic message
  await sendMessage({ to, text: 'Sorry, something went wrong' });
}
```

## Related Documentation

- [Features: Interactive Messages](../04-features/interactive-messages.md)
- [API Reference](../03-api-reference/whatsapp-api.md)
- [WhatsApp SDK](../07-whatsapp-sdk/README.md) - Advanced SDK usage

## External Resources

- [WhatsApp Business API Documentation](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [WhatsApp Flows Documentation](https://developers.facebook.com/docs/whatsapp/flows)

---

**Last Updated**: 2025-10-08
**API Version**: v23.0
**Pricing Model**: Per-message templates (Jul 1, 2025)
