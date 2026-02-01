---
title: Database Schema & Migrations
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: ready
scope: Complete Supabase PostgreSQL schema with 14 tables, indexes, RLS policies
---

# Database Schema & Migrations

## Quick Reference
- **Purpose**: Complete database schema for migue.ai with 14 tables, indexes, RLS policies, triggers
- **References**: docs/architecture/memory-rag-system.md, docs-global/platforms/supabase/platform-supabase.md
- **Database**: Supabase PostgreSQL 15.8 with pgvector extension
- **Tables**: 14 (users, messages, conversations, reminders, calendar_events, expenses, user_memory, etc.)

---

## Database Overview

| Table | Purpose | Rows (estimate) | Storage | RLS | Indexes |
|-------|---------|-----------------|---------|-----|---------|
| users | User profiles | 10K | Low | Yes | 2 |
| conversations | Conversation metadata | 100K | Low | Yes | 3 |
| messages | Message history | 1M+ | High | Yes | 4 |
| reminders | User reminders | 50K | Low | Yes | 3 |
| calendar_events | Calendar integration | 100K | Medium | Yes | 4 |
| expenses | Expense tracking | 200K | Medium | Yes | 4 |
| user_memory | Semantic memory (pgvector) | 50K | High | Yes | 3 |
| messaging_windows | WhatsApp 24h windows | 10K | Low | Yes | 2 |
| ai_requests | AI usage tracking | 500K | Medium | Yes | 3 |
| tool_executions | Tool call logs | 1M+ | High | Yes | 3 |
| rate_limits | Rate limiting state | 10K | Low | No | 2 |
| webhooks | Webhook audit log | 1M+ | High | No | 2 |
| flows_state | WhatsApp Flows state | 10K | Low | Yes | 2 |
| dead_letter_queue | Failed operations | 5K | Low | No | 2 |

**Total storage estimate**: 5-10GB first year (free tier: 500MB, upgrade to Pro $25/mo)

**Source**: docs/architecture/memory-rag-system.md L1-50, docs-global/platforms/supabase/platform-supabase.md L1-50

---

## Table: users

**Purpose**: User profiles and preferences

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE, -- WhatsApp phone number (E.164 format)
  whatsapp_name TEXT, -- Name from WhatsApp profile
  display_name TEXT, -- User-preferred name
  language TEXT DEFAULT 'es', -- ISO 639-1 code
  timezone TEXT DEFAULT 'America/Bogota', -- IANA timezone
  preferences JSONB DEFAULT '{}', -- User preferences (notification settings, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ, -- Last interaction timestamp
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}' -- Additional user metadata
);

-- Indexes
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_last_message ON users(last_message_at DESC);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger: Update updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Table: conversations

**Purpose**: Conversation grouping and metadata

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ, -- NULL = active conversation
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  context_summary TEXT, -- AI-generated summary for context
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_active ON conversations(user_id, ended_at) WHERE ended_at IS NULL;

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON conversations
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: messages

**Purpose**: Complete message history with WhatsApp metadata

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT UNIQUE, -- WhatsApp message ID
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'audio', 'image', 'interactive', 'button', 'location', 'system')),
  content TEXT, -- Message content
  media_url TEXT, -- URL for media messages
  media_mime_type TEXT,
  metadata JSONB DEFAULT '{}', -- WhatsApp metadata (contacts, interactive reply, etc.)
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ, -- When sent to WhatsApp
  delivered_at TIMESTAMPTZ, -- Status update timestamp
  read_at TIMESTAMPTZ -- Status update timestamp
);

-- Indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id, created_at DESC);
CREATE INDEX idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX idx_messages_type ON messages(message_type, created_at DESC);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON messages
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: reminders

**Purpose**: User reminders with scheduling

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  retry_count INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_scheduled ON reminders(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_reminders_status ON reminders(status, scheduled_for);

-- RLS Policies
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON reminders
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: calendar_events

**Purpose**: Google Calendar integration

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  google_event_id TEXT, -- Google Calendar event ID
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'tentative', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- Attendees, recurrence, etc.
);

-- Indexes
CREATE INDEX idx_calendar_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_start_time ON calendar_events(start_time);
CREATE INDEX idx_calendar_google_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_user_time ON calendar_events(user_id, start_time);

-- RLS Policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON calendar_events
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Table: expenses

**Purpose**: Expense tracking with categories

```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP',
  category TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- Payment method, tags, etc.
);

-- Indexes
CREATE INDEX idx_expenses_user ON expenses(user_id);
CREATE INDEX idx_expenses_date ON expenses(date DESC);
CREATE INDEX idx_expenses_category ON expenses(category, date DESC);
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date DESC);

-- RLS Policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON expenses
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Table: user_memory

**Purpose**: Semantic memory with pgvector embeddings

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('preference', 'fact', 'context', 'pattern')),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small (1536 dimensions)
  importance NUMERIC(3, 2) DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_user_memory_user ON user_memory(user_id);
CREATE INDEX idx_user_memory_type ON user_memory(memory_type);
CREATE INDEX idx_user_memory_embedding ON user_memory USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RLS Policies
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON user_memory
  FOR ALL USING (auth.role() = 'service_role');
```

**Source**: docs/architecture/memory-rag-system.md L1-50

---

## Table: messaging_windows

**Purpose**: Track WhatsApp 24-hour messaging windows

```sql
CREATE TABLE messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- 24 hours from opened_at
  is_open BOOLEAN DEFAULT true,
  last_user_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messaging_windows_user ON messaging_windows(user_id, is_open);
CREATE INDEX idx_messaging_windows_expires ON messaging_windows(expires_at) WHERE is_open = true;

-- RLS Policies
ALTER TABLE messaging_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON messaging_windows
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: ai_requests

**Purpose**: Track AI provider usage and costs

```sql
CREATE TABLE ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'claude')),
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10, 6) NOT NULL,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}' -- Model config, temperature, etc.
);

-- Indexes
CREATE INDEX idx_ai_requests_user ON ai_requests(user_id, created_at DESC);
CREATE INDEX idx_ai_requests_provider ON ai_requests(provider, created_at DESC);
CREATE INDEX idx_ai_requests_date ON ai_requests(created_at::date);

-- RLS Policies
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON ai_requests
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: tool_executions

**Purpose**: Track tool calls for debugging and analytics

```sql
CREATE TABLE tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  inputs JSONB NOT NULL,
  outputs JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout')),
  latency_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tool_executions_user ON tool_executions(user_id, created_at DESC);
CREATE INDEX idx_tool_executions_tool ON tool_executions(tool_name, created_at DESC);
CREATE INDEX idx_tool_executions_status ON tool_executions(status) WHERE status = 'error';

-- RLS Policies
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON tool_executions
  FOR ALL USING (auth.role() = 'service_role');
```

---

## Table: rate_limits

**Purpose**: Track rate limiting state

```sql
CREATE TABLE rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE, -- user_id or IP address
  endpoint TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rate_limits_key ON rate_limits(key, endpoint);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_end) WHERE window_end > NOW();

-- No RLS (service-only table)
```

---

## Table: webhooks

**Purpose**: Audit log for webhook events

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('whatsapp', 'cron')),
  payload JSONB NOT NULL,
  signature TEXT,
  status TEXT NOT NULL CHECK (status IN ('received', 'processed', 'failed')),
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhooks_created ON webhooks(created_at DESC);
CREATE INDEX idx_webhooks_status ON webhooks(status, created_at DESC);

-- No RLS (service-only table)
```

---

## Table: flows_state

**Purpose**: WhatsApp Flows state management

```sql
CREATE TABLE flows_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  current_screen TEXT NOT NULL,
  flow_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes'
);

-- Indexes
CREATE INDEX idx_flows_state_user ON flows_state(user_id);
CREATE INDEX idx_flows_state_expires ON flows_state(expires_at) WHERE expires_at > NOW();

-- RLS Policies
ALTER TABLE flows_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON flows_state
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger
CREATE TRIGGER update_flows_state_updated_at
  BEFORE UPDATE ON flows_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Table: dead_letter_queue

**Purpose**: Failed operations for retry

```sql
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'success', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dlq_retry ON dead_letter_queue(next_retry_at, status) WHERE status = 'pending';
CREATE INDEX idx_dlq_type ON dead_letter_queue(operation_type, created_at DESC);

-- No RLS (service-only table)
```

---

## Database Functions

### Function: update_updated_at_column

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Function: search_memories (RAG)

```sql
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  memory_type TEXT,
  content TEXT,
  similarity FLOAT,
  importance NUMERIC,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.id,
    um.user_id,
    um.memory_type,
    um.content,
    1 - (um.embedding <=> query_embedding) AS similarity,
    um.importance,
    um.created_at
  FROM user_memory um
  WHERE um.user_id = match_user_id
    AND 1 - (um.embedding <=> query_embedding) > match_threshold
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Source**: docs/architecture/memory-rag-system.md L32-49

---

## Migration Strategy

### Phase 1: Core Tables (Week 1)

```sql
-- migrations/001_core_tables.sql
-- Create: users, conversations, messages, messaging_windows
```

### Phase 2: Features (Week 2)

```sql
-- migrations/002_features.sql
-- Create: reminders, calendar_events, expenses
```

### Phase 3: AI & Memory (Week 2-3)

```sql
-- migrations/003_ai_memory.sql
-- Create: ai_requests, tool_executions, user_memory (with pgvector)
```

### Phase 4: Ops Tables (Week 3)

```sql
-- migrations/004_ops.sql
-- Create: rate_limits, webhooks, flows_state, dead_letter_queue
```

---

## RLS Security Summary

**ALL user-data tables have RLS enabled** with service role access only.

**Why service_role only**: migue.ai uses server-side AI agent, no direct client access to database. All queries go through Edge Functions with service role.

**Tables with RLS**:
- users, conversations, messages, reminders, calendar_events, expenses, user_memory, messaging_windows, ai_requests, tool_executions, flows_state

**Tables without RLS** (service-only):
- rate_limits, webhooks, dead_letter_queue

**Source**: docs-global/platforms/supabase/platform-supabase.md L42-44

---

## Testing Checklist

- [ ] All tables created successfully
- [ ] Indexes exist on all foreign keys and query fields
- [ ] RLS policies prevent unauthorized access
- [ ] pgvector extension installed and working
- [ ] Triggers update timestamps correctly
- [ ] Functions execute without errors
- [ ] Migration rollback works correctly

---

**Lines**: 350 | **Tokens**: ~840 | **Status**: Ready for implementation
