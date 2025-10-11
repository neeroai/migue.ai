# API Reference

Complete API documentation for migue.ai integrations.

## Overview

This section documents all external APIs and internal endpoints used by migue.ai.

## Documentation

### Edge Runtime & Performance
- **[edge-runtime-api.md](./edge-runtime-api.md)** - Complete Edge Runtime API reference
- **[whatsapp-webhook-spec.md](./whatsapp-webhook-spec.md)** - WhatsApp webhook specification (v23.0)
- **[api-performance-guide.md](./api-performance-guide.md)** - API performance optimization

### Internal APIs
- **[endpoints.md](./endpoints.md)** - Next.js API routes and webhook handlers

### External Integrations
- **[whatsapp-api.md](./whatsapp-api.md)** - WhatsApp Business API reference
- **[supabase-schema.md](./supabase-schema.md)** - Database schema and RLS policies
- **[openai-integration.md](./openai-integration.md)** - OpenAI API usage (GPT-4o, Whisper, Embeddings)

## Key Endpoints

### Webhook Handler
```
POST /api/whatsapp/webhook
```
Receives WhatsApp messages and processes AI responses.

### Cron Jobs
```
GET /api/cron/check-reminders
```
Daily reminder check (9 AM UTC).

## Authentication

- **WhatsApp**: Bearer token authentication
- **Supabase**: Service role key (server-side)
- **OpenAI**: API key authentication

## Rate Limits

| Service | Limit | Notes |
|---------|-------|-------|
| WhatsApp | 250 msg/sec | Cloud API tier (v23.0) |
| OpenAI | 10,000 TPM | Default tier |
| Supabase | Unlimited | Pro plan |
| Edge Functions | 25s timeout | 300s for streaming |

## Error Handling

All APIs follow consistent error response format:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## Related Documentation

- [Architecture](../02-architecture/README.md) - System design
- [WhatsApp Integration](../06-whatsapp/README.md) - WhatsApp-specific docs
- [Deployment](../05-deployment/README.md) - API deployment guides

---

**Last Updated**: 2025-10-03
