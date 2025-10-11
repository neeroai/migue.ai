# Platforms

Platform-specific documentation for external services and integrations used by migue.ai.

## Overview

This section contains detailed documentation for each platform integration, including setup guides, API references, best practices, and troubleshooting.

## Platforms

### [WhatsApp](./whatsapp/README.md)
WhatsApp Business API integration (v23.0) for conversational AI messaging.

**Key Topics:**
- API v23 features and endpoints
- Interactive messages (buttons, lists)
- WhatsApp Flows implementation
- Message templates and pricing
- Service conversations management

### [Vercel](./vercel/README.md)
Deployment platform with Edge Functions for global, low-latency execution.

**Key Topics:**
- Edge Functions optimization
- Error handling and observability
- Security best practices
- Supabase integration
- Performance monitoring

### [Supabase](./supabase/README.md)
PostgreSQL database with pgvector, real-time features, and Edge Runtime support.

**Key Topics:**
- **Setup & Configuration** - Environment variables, TypeScript client, MCP server
- **Database Schema** - 14 tables, relationships, enums, constraints
- **pgvector Semantic Search** - 1536-dim embeddings, HNSW indexes
- **Row Level Security** - Production policies with 100x optimization
- **Custom Functions & Triggers** - PostgreSQL automation, state machines
- **WhatsApp 24h Windows** - Free messaging window management, cost savings
- **AI Cost Tracking** - Multi-provider analytics, budget management
- **WhatsApp v23 Tables** - Flows, calls, interactions, locations
- **Realtime & Storage** - Subscriptions, file uploads, CDN
- **Performance & Monitoring** - Query optimization, indexes, analytics
- **Migrations** - Idempotent patterns, rollback strategies

**13 Comprehensive Guides** covering production deployment, performance optimization, and advanced features.

### [AI Providers](./ai/README.md)
Multi-provider AI architecture optimized for cost and reliability.

**Providers:**
- **Gemini 2.5 Flash** - Primary (FREE tier, 1,500 req/day)
- **OpenAI GPT-4o-mini** - Fallback #1 (96% cheaper than Claude)
- **Claude Sonnet 4.5** - Emergency fallback (highest quality)
- **Groq Whisper** - Audio transcription (93% cheaper)

---

## Organization Philosophy

This structure follows patterns from industry-leading projects:

- **Supabase**: Uses `content/guides/` by topic (storage, auth, functions)
- **AWS**: Organizes by service/component (applications/, resources/)
- **Next.js**: Platform-agnostic core with platform-specific guides

### Why `platforms/`?

1. **Clear Separation**: Internal docs (guides, reference) vs external integrations
2. **Scalable**: Easy to add new platforms (Stripe, Twilio, etc.)
3. **Findability**: Developers instinctively know where to look for platform-specific info
4. **Maintenance**: Platform docs evolve with external API changes, isolated from core docs

---

**Related Documentation:**
- [Guides](../guides/README.md) - How-to guides and tutorials
- [Reference](../reference/README.md) - API references and specs
- [Architecture](../architecture/README.md) - System design and patterns
