# Supabase Platform Documentation

Comprehensive guide for migue.ai's Supabase PostgreSQL database integration.

## Overview

**migue.ai** uses Supabase as its primary database platform, leveraging PostgreSQL 15+ with advanced extensions for semantic search, real-time subscriptions, and cost-effective AI tracking.

**Project Details:**
- **Region**: us-east-2 (Ohio)
- **Project ID**: pdliixrgdvunoymxaxmw
- **Database**: PostgreSQL 15.8
- **Extensions**: pgvector, pg_trgm, pgcrypto
- **Type**: Production-ready with Edge Runtime compatibility

## Feature Matrix

| Feature | Status | Description |
|---------|--------|-------------|
| **Database Schema** | ✅ Production | 14 tables, 5 enums, 95 indexes |
| **pgvector Search** | ✅ Production | Semantic search with HNSW index |
| **RLS Security** | ✅ Production | Row-Level Security with 100x optimization |
| **Custom Functions** | ✅ Production | 12+ business logic functions |
| **Triggers** | ✅ Production | Auto-updating timestamps, state machines |
| **Messaging Windows** | ✅ Production | WhatsApp 24h window tracking |
| **AI Cost Tracking** | ✅ Production | Multi-provider usage analytics |
| **WhatsApp v23.0** | ✅ Production | Flows, calls, interactions |
| **Realtime** | ⚠️ Not Used | Available but not implemented |
| **Storage Buckets** | 📅 Planned | Audio files, documents |
| **Performance Monitoring** | ✅ Production | Analytics views, query optimization |
| **Migrations** | ✅ Production | 8 idempotent migrations |

## Documentation Index

### Getting Started
1. **[Setup & Configuration](./01-setup-configuration.md)** - Environment variables, TypeScript client, MCP integration
2. **[Database Schema](./02-database-schema.md)** - All 14 tables, relationships, constraints, ERD

### Core Features
3. **[pgvector Semantic Search](./03-pgvector-semantic-search.md)** - Vector embeddings, HNSW index, search functions
4. **[RLS Security](./04-rls-security.md)** - Row-Level Security policies, performance optimization
5. **[Custom Functions & Triggers](./05-custom-functions-triggers.md)** - Business logic, state machines, helpers

### WhatsApp Integration
6. **[Messaging Windows](./06-messaging-windows.md)** - 24h free window management, proactive limits
7. **[AI Cost Tracking](./07-ai-cost-tracking.md)** - Multi-provider usage analytics, budget management
8. **[WhatsApp v23.0 Tables](./08-whatsapp-v23-tables.md)** - Flows, calls, interactions, locations

### Advanced Topics
9. **[Realtime Subscriptions](./09-realtime-subscriptions.md)** - Postgres changes, SSE, Edge Runtime
10. **[Storage Buckets](./10-storage-buckets.md)** - File uploads, CDN, RLS policies
11. **[Monitoring & Performance](./11-monitoring-performance.md)** - Query optimization, index types, analytics
12. **[Migrations & Maintenance](./12-migrations-maintenance.md)** - Idempotent SQL, safety checks, rollback

## Tech Stack

**Database:**
- PostgreSQL 15.8 with Supavisor connection pooling
- pgvector 0.5.0 for semantic search (1536-dim embeddings)
- pg_trgm for fuzzy text search
- pgcrypto for UUID generation

**TypeScript Client:**
- @supabase/supabase-js v2.x
- Type-safe database schema (auto-generated)
- Edge Runtime compatible

**Tools:**
- Supabase CLI for migrations
- MCP server for AI-powered queries
- SQL Editor for ad-hoc queries

## Quick Start

### 1. Environment Setup
```bash
# .env.local
SUPABASE_URL=https://pdliixrgdvunoymxaxmw.supabase.co
SUPABASE_KEY=eyJhbGci...  # Service role key
```

### 2. TypeScript Client
```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

const supabase = getSupabaseServerClient()
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('phone_number', '+573001234567')
```

### 3. Run Migrations
```bash
# Via Supabase Dashboard SQL Editor
# Copy/paste from supabase/migrations/*.sql
```

## Architecture Highlights

### Data Model
- **14 tables**: users, conversations, messages_v2, reminders, messaging_windows, user_memory, ai_usage_tracking, flow_sessions, call_logs, user_interactions, user_locations, scheduled_messages, calendar_events, documents
- **5 enums**: msg_type, conv_status, reminder_status, flow_status, msg_direction
- **E.164 domain**: Type-safe phone number validation
- **95 indexes**: B-tree, GIN, HNSW, partial indexes

### Security Model
- **RLS enabled** on all tables
- **Permissive policies** for development (using service role)
- **Function wrapping** for 100x performance improvement
- **Security definer** functions for webhook ingestion

### Cost Optimization
- **WhatsApp 24h windows**: 90%+ messages free (vs $0.0667/template)
- **AI cost tracking**: Real-time monitoring across 4 providers
- **Gemini 2.5 Flash**: $0 within 1,500 req/day free tier
- **Connection pooling**: Supavisor reduces connection overhead

## Key Innovations

### 1. WhatsApp Window Management
Automatic tracking of WhatsApp's 24-hour free messaging windows with proactive message limits (4/day, 4h interval) to maximize free tier usage.

### 2. Semantic Search with pgvector
HNSW index for sub-millisecond similarity search across user memories using OpenAI text-embedding-3-small (1536 dimensions).

### 3. AI Cost Analytics
Real-time tracking of all AI provider usage (Gemini, GPT-4o-mini, Groq, Claude) with daily trends and budget alerts.

### 4. State Machine Triggers
PostgreSQL triggers enforce business rules like reminder status transitions and auto-generate idempotency tokens.

## Common Patterns

### Upsert with Conflict Resolution
```typescript
await supabase.from('messaging_windows').upsert(
  { phone_number, window_opened_at, window_expires_at },
  { onConflict: 'phone_number' }
)
```

### RPC Function Call
```typescript
const { data } = await supabase.rpc('search_user_memory', {
  query_embedding: vector,
  target_user_id: userId,
  match_threshold: 0.3,
  match_count: 10
})
```

### Transaction-Safe Insert
```sql
INSERT INTO messages_v2 (...)
VALUES (...)
ON CONFLICT (wa_message_id) DO NOTHING;
```

## Related Documentation

- **Official**: [Supabase Docs](https://supabase.com/docs)
- **Project**: [Supabase Access Guide](../../reference/supabase-access.md)
- **Project**: [Supabase Schema Reference](../../reference/supabase-schema.md)
- **Integration**: [Vercel + Supabase](../vercel/supabase-integration.md)
- **Quick Reference**: [CLAUDE.md](../../../CLAUDE.md)

## Support

**Issues?** Check the troubleshooting guides:
- [RLS Performance Issues](./04-rls-security.md#troubleshooting)
- [Migration Failures](./12-migrations-maintenance.md#common-pitfalls)
- [Vector Search Problems](./03-pgvector-semantic-search.md#troubleshooting)

**Last Updated**: 2025-10-11
