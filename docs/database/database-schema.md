# Database Schema

Complete database schema documentation for migue.ai, including 14 tables, relationships, enums, domains, and business constraints.

## Overview

- **Tables**: 14 (12 production + 2 legacy)
- **Indexes**: 95+ (optimized for Edge Runtime)
- **Extensions**: pgvector, pgcrypto, pg_trgm
- **Enums**: 5 (msg_type, msg_direction, conv_status, reminder_status, flow_status)
- **Domains**: 1 (e164 phone number)
- **Foreign Keys**: 28 relationships
- **Unique Constraints**: 15
- **Check Constraints**: 12

## Core Tables

### users

User profiles with E.164 phone numbers (WhatsApp identifier).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL, -- E.164 format: +573001234567
  name TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_phone_e164 CHECK (phone_number ~ '^[+][1-9][0-9]{7,14}$')
);

CREATE INDEX idx_users_phone ON users(phone_number);
```

**TypeScript**:
```typescript
type User = Tables<'users'>
// { id: string; phone_number: string; name: string | null; preferences: Json | null; created_at: string; updated_at: string }
```

### conversations

Active conversations between users and the AI assistant.

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wa_conversation_id VARCHAR(64), -- WhatsApp conversation ID
  status conv_status DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Business rule: one active conversation per user
CREATE UNIQUE INDEX uniq_active_conversation_per_user
  ON conversations(user_id) WHERE status = 'active';

CREATE UNIQUE INDEX uniq_wa_conversation_id
  ON conversations(wa_conversation_id) WHERE wa_conversation_id IS NOT NULL;
```

**Enums**:
```sql
CREATE TYPE conv_status AS ENUM ('active', 'archived', 'closed');
```

### messages_v2

All WhatsApp messages (inbound + outbound) with type safety.

```sql
CREATE TABLE messages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction msg_direction NOT NULL,
  type msg_type NOT NULL,
  content TEXT,
  media_url TEXT,
  wa_message_id VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_msg_content_or_media CHECK (
    (content IS NOT NULL) OR (media_url IS NOT NULL)
  )
);

CREATE UNIQUE INDEX uniq_wa_message ON messages_v2(wa_message_id);
CREATE INDEX idx_messages_v2_conv_ts ON messages_v2(conversation_id, timestamp DESC);
```

**Enums**:
```sql
CREATE TYPE msg_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE msg_type AS ENUM (
  'text', 'image', 'audio', 'sticker', 'video', 'document',
  'location', 'interactive', 'button', 'reaction', 'order',
  'contacts', 'system', 'unknown'
);
```

**TypeScript Usage**:
```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

const supabase = getSupabaseServerClient()

// Insert message with type safety
await supabase.from('messages_v2').insert({
  conversation_id: 'uuid',
  direction: 'inbound',
  type: 'text',
  content: 'Hello',
  timestamp: new Date().toISOString()
})
```

### reminders

User reminders with state machine validation.

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  send_token UUID, -- Idempotency token for sent reminders
  CONSTRAINT chk_reminder_future_on_insert CHECK (created_at <= scheduled_time)
);

CREATE UNIQUE INDEX uniq_reminders_send_token
  ON reminders(send_token) WHERE send_token IS NOT NULL;
```

**State Transitions** (enforced by trigger):
- `pending → sent` (✅)
- `pending → cancelled` (✅)
- `pending → failed` (✅)
- `failed → pending` (✅ retry)
- `failed → cancelled` (✅)
- `cancelled → pending` (✅ reschedule)
- All other transitions are **blocked**

**See**: [05 - Custom Functions & Triggers](./05-custom-functions-triggers.md) for state machine implementation

## WhatsApp Integration Tables

### messaging_windows

Tracks WhatsApp 24-hour free messaging windows.

```sql
CREATE TABLE messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  window_opened_at TIMESTAMPTZ NOT NULL,
  window_expires_at TIMESTAMPTZ NOT NULL,
  last_user_message_id TEXT,
  proactive_messages_sent_today INT NOT NULL DEFAULT 0,
  last_proactive_sent_at TIMESTAMPTZ,
  free_entry_point_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**See**: [06 - Messaging Windows](./06-messaging-windows.md)

### flow_sessions

WhatsApp Flows (v23.0) - Interactive multi-step forms.

```sql
CREATE TABLE flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('navigate', 'data_exchange')),
  session_data JSONB DEFAULT '{}'::jsonb,
  response_data JSONB,
  status flow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
```

**See**: [08 - WhatsApp v23.0 Tables](./08-whatsapp-v23-tables.md)

### call_logs

WhatsApp Business Calling API logs.

```sql
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  call_id TEXT NOT NULL UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL CHECK (status IN ('initiated', 'accepted', 'rejected', 'ended', 'failed')),
  duration_seconds INT,
  end_reason TEXT CHECK (end_reason IN ('user_declined', 'user_busy', 'timeout', 'completed')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### user_interactions

CTA button taps, flow completions, call actions.

```sql
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'cta_button_tap', 'flow_completion', 'call_accepted', 'call_rejected'
  )),
  button_title TEXT,
  button_url TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### user_locations

GPS coordinates from location messages.

```sql
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  name TEXT,
  address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_locations_coords ON user_locations(latitude, longitude);
```

## AI & Memory Tables

### user_memory

Semantic search with pgvector embeddings (1536-dim).

```sql
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'conversation')),
  content TEXT NOT NULL,
  category TEXT,
  relevance FLOAT DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
  embedding vector(1536), -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX user_memory_embedding_idx
  ON user_memory USING hnsw (embedding vector_ip_ops);
```

**See**: [03 - pgvector Semantic Search](./03-pgvector-semantic-search.md)

### ai_usage_tracking

Multi-provider AI cost monitoring.

```sql
CREATE TABLE ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'claude', 'groq', 'openai', 'tesseract')),
  task_type TEXT NOT NULL CHECK (task_type IN ('chat', 'audio_transcription', 'ocr', 'embeddings', 'image_analysis')),
  model TEXT,
  tokens_input INT,
  tokens_output INT,
  cost_usd DECIMAL(12, 8) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**See**: [07 - AI Cost Tracking](./07-ai-cost-tracking.md)

## Supporting Tables

### scheduled_messages

Scheduled message delivery queue.

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### webhook_failures

Dead letter queue for failed webhook processing.

```sql
CREATE TABLE webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  wa_message_id TEXT,
  raw_payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_code TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'abandoned')),
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Entity-Relationship Diagram

```
users (1) ──────< (M) conversations
  │                      │
  │                      └──< messages_v2
  │
  ├──< reminders
  ├──< messaging_windows (1:1)
  ├──< flow_sessions
  ├──< call_logs
  ├──< user_interactions
  ├──< user_locations
  ├──< user_memory
  └──< ai_usage_tracking

conversations ──< scheduled_messages
              └─< webhook_failures (soft reference)
```

## Enums & Domains

### Enums

```sql
-- Message types (WhatsApp v23.0)
CREATE TYPE msg_type AS ENUM (
  'text', 'image', 'audio', 'sticker', 'video', 'document',
  'location', 'interactive', 'button', 'reaction', 'order',
  'contacts', 'system', 'unknown'
);

-- Message direction
CREATE TYPE msg_direction AS ENUM ('inbound', 'outbound');

-- Conversation status
CREATE TYPE conv_status AS ENUM ('active', 'archived', 'closed');

-- Reminder status
CREATE TYPE reminder_status AS ENUM ('pending', 'sent', 'cancelled', 'failed');

-- Flow status
CREATE TYPE flow_status AS ENUM ('pending', 'in_progress', 'completed', 'expired', 'failed');
```

### Domains

```sql
-- E.164 phone number format
CREATE DOMAIN e164 AS TEXT CHECK (value ~ '^[+][1-9][0-9]{7,14}$');

-- Usage
phone_number e164 NOT NULL
```

## See Also

- [03 - pgvector Semantic Search](./03-pgvector-semantic-search.md)
- [04 - RLS Security](./04-rls-security.md)
- [05 - Custom Functions & Triggers](./05-custom-functions-triggers.md)
- [Migration Files](../../supabase/migrations/)

---

**Last Updated**: 2025-10-11
**See Also**: [README.md](./README.md)
