# Architecture

System design and technical architecture for migue.ai.

## Overview

migue.ai is built on a modern serverless architecture leveraging:
- **Next.js 15** with App Router
- **Vercel Edge Functions** for low-latency responses
- **Supabase** for database and authentication
- **OpenAI** for AI processing (GPT-4o, Whisper, Embeddings)
- **WhatsApp Business API** for messaging

## Documentation

### Core Architecture
- **[overview.md](./overview.md)** - High-level system design and diagrams
- **[components.md](./components.md)** - System components and services
- **[flows.md](./flows.md)** - User flows and message processing

### Technical Details
- **[data-model.md](./data-model.md)** - Database schema and relationships
- **[security.md](./security.md)** - Security policies and RLS
- **[nfrs.md](./nfrs.md)** - Non-functional requirements (performance, scalability)

## Key Architectural Decisions

### Edge Runtime
All API routes use Vercel Edge Functions for:
- Low latency (<100ms cold starts)
- Global distribution
- Automatic scaling

### Stateless Design
- No server-side sessions
- All state in Supabase
- WebSocket-free (webhook-based)

### Modular Features
Each feature is self-contained:
- Audio transcription
- RAG knowledge base
- Calendar reminders
- Streaming responses

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 15 App Router | Web interface (future) |
| **API** | Vercel Edge Functions | Webhook handlers |
| **Database** | Supabase (PostgreSQL) | Data persistence |
| **AI** | OpenAI (GPT-4o, Whisper) | Conversation & transcription |
| **Messaging** | WhatsApp Business API | User communication |
| **Hosting** | Vercel Edge Network | Global deployment |

## Related Documentation

- [API Reference](../03-api-reference/README.md) - API endpoints and schemas
- [Deployment](../05-deployment/README.md) - Deployment architecture
- [WhatsApp Integration](../06-whatsapp/README.md) - Messaging architecture

---

**Last Updated**: 2025-10-03
