# Database Schema

Complete schema reference for migue.ai's 14 tables with relationships, constraints, and indexes.

## Schema Overview

**Database**: PostgreSQL 15.8
**Schema**: public
**Tables**: 14 (+ 3 views)
**Enums**: 5
**Indexes**: 95 (B-tree, GIN, HNSW, partial)
**Extensions**: pgvector, pg_trgm, pgcrypto

## Entity Relationship Diagram

```
users (1) ──< conversations (N)
            │
            └──< messages_v2 (N)
            └──< messaging_windows (1)

users (1) ──< reminders (N)
users (1) ──< calendar_events (N)
users (1) ──< user_memory (N) [pgvector]
users (1) ──< ai_usage_tracking (N)

users (1) ──< flow_sessions (N)
users (1) ──< call_logs (N)
users (1) ──< user_interactions (N)
users (1) ──< user_locations (N)

users (1) ──< documents (N) ──< embeddings (N) [legacy]
```

## Core Tables

### 1. users

**Purpose**: Central user registry indexed by E.164 phone number

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number e164 UNIQUE NOT NULL,  -- E.164 domain: +[1-9][0-9]{7,14}
  name TEXT,
  preferences JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_phone_e164 CHECK (phone_number ~ '^[+][1-9][0-9]{7,14}$')
);
```

**Indexes:**
- `idx_users_phone` (B-tree) - Phone lookup
- `idx_users_phone_btree` (B-tree) - RLS optimization

**Constraints:**
- Unique phone number
- E.164 format validation
- Auto-updating `updated_at` (trigger)

### 2. conversations

**Purpose**: WhatsApp conversation sessions

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wa_conversation_id VARCHAR(64),  -- WhatsApp's conversation ID
  status conv_status DEFAULT 'active',  -- enum: active, archived, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_conversations_user` (B-tree)
- `idx_conversations_userid_btree` (B-tree) - RLS optimization
- `idx_conversations_wa_id` (B-tree, partial WHERE wa_conversation_id IS NOT NULL)
- `idx_conversations_user_status` (B-tree composite)
- `uniq_wa_conversation_id` (Unique, partial)
- `uniq_active_conversation_per_user` (Unique, partial WHERE status = 'active')

**Business Rules:**
- One active conversation per user
- Unique WhatsApp conversation ID
- Cascade deletes messages on conversation deletion

### 3. messages_v2

**Purpose**: All WhatsApp messages (inbound + outbound)

```sql
CREATE TABLE messages_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction msg_direction NOT NULL,  -- enum: inbound, outbound
  type msg_type NOT NULL,  -- enum: text, image, audio, video, etc.
  content TEXT,
  media_url TEXT,
  wa_message_id VARCHAR(64),
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Indexes:**
- `idx_messages_v2_conversation` (B-tree)
- `idx_messages_v2_timestamp` (B-tree DESC)
- `idx_messages_v2_conv_ts` (B-tree composite, DESC timestamp)
- `idx_messages_v2_wa` (B-tree on wa_message_id)
- `idx_messages_type_direction` (B-tree composite)
- `uniq_wa_message` (Unique on wa_message_id)

**Constraints:**
- `chk_msg_content_or_media` - At least one of content/media_url required
- `chk_msg_requirements_by_type` - Type-specific field requirements

**msg_type enum:**
```sql
text, image, audio, video, document, sticker, location,
interactive, button, reaction, order, contacts, system, unknown
```

### 4. reminders

**Purpose**: User-created reminders with state machine

```sql
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status reminder_status NOT NULL DEFAULT 'pending',  -- enum
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_token UUID,  -- Idempotency token set when status = 'sent'
);
```

**Indexes:**
- `idx_reminders_user` (B-tree)
- `idx_reminders_time` (B-tree)
- `idx_reminders_status_time` (B-tree composite, partial WHERE status = 'pending')
- `uniq_reminders_send_token` (Unique, partial WHERE send_token IS NOT NULL)

**State Machine** (enforced by trigger):
```
pending → sent | cancelled | failed
failed → pending | cancelled
cancelled → pending
```

**Triggers:**
- `reminders_validate_transition()` - Enforces state transitions
- `reminders_set_send_token()` - Auto-generates send_token when sent

## WhatsApp Features

### 5. messaging_windows

**Purpose**: 24-hour free messaging window tracking

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
  free_entry_point_expires_at TIMESTAMPTZ,  -- 72h free for new users
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**See**: [Messaging Windows Guide](./06-messaging-windows.md)

### 6. flow_sessions (WhatsApp Flows)

**Purpose**: Track WhatsApp Flows sessions

```sql
CREATE TABLE flow_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL UNIQUE,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('navigate', 'data_exchange')),
  session_data JSONB DEFAULT '{}'::JSONB,
  response_data JSONB,
  status flow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);
```

**See**: [WhatsApp v23.0 Tables](./08-whatsapp-v23-tables.md)

### 7. call_logs (Business Calling API)

**Purpose**: WhatsApp Business call tracking

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
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8. user_interactions (CTA Buttons)

**Purpose**: Track CTA button taps and interactions

```sql
CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL CHECK (
    interaction_type IN ('cta_button_tap', 'flow_completion', 'call_accepted', 'call_rejected')
  ),
  button_title TEXT,
  button_url TEXT,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 9. user_locations (GPS Coordinates)

**Purpose**: Store user-shared location data

```sql
CREATE TABLE user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  name TEXT,
  address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Index**: `idx_user_locations_coords` (B-tree composite on lat/lng)

## AI & Analytics

### 10. ai_usage_tracking

**Purpose**: Multi-provider AI cost tracking

```sql
CREATE TABLE ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'groq', 'tesseract', 'openai', 'supabase', 'gemini')),
  task_type TEXT NOT NULL CHECK (task_type IN ('chat', 'audio_transcription', 'ocr', 'embeddings', 'image_analysis')),
  model TEXT,
  tokens_input INT,
  tokens_output INT,
  cost_usd DECIMAL(12, 8) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**See**: [AI Cost Tracking Guide](./07-ai-cost-tracking.md)

### 11. user_memory (pgvector)

**Purpose**: Semantic search with vector embeddings

```sql
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'conversation')),
  content TEXT NOT NULL,
  category TEXT,
  relevance FLOAT DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
  embedding VECTOR(1536),  -- text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**HNSW Index**: `user_memory_embedding_idx` (vector_ip_ops)

**See**: [pgvector Semantic Search](./03-pgvector-semantic-search.md)

## Calendar & Scheduling

### 12. calendar_events

**Purpose**: Google Calendar integration events

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  external_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  meeting_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Unique Index**: `uniq_calendar_events_user_ext` (user_id, provider, external_id)

### 13. scheduled_messages

**Purpose**: Future message delivery queue

```sql
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Legacy Tables

### 14. documents & embeddings

**Purpose**: File storage references (legacy - will be replaced by Supabase Storage)

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL,
  path TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  vector JSONB NOT NULL,  -- Legacy: use user_memory for pgvector
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Note**: Use `user_memory` table for vector search. These tables planned for Supabase Storage migration.

## Enums

### msg_type
```sql
text, image, audio, video, document, sticker, location,
interactive, button, reaction, order, contacts, system, unknown
```

### conv_status
```sql
active, archived, closed
```

### reminder_status
```sql
pending, sent, cancelled, failed
```

### flow_status
```sql
pending, in_progress, completed, expired, failed
```

### msg_direction
```sql
inbound, outbound
```

## Domain Types

### e164 (Phone Numbers)
```sql
CREATE DOMAIN e164 AS TEXT CHECK (value ~ '^[+][1-9][0-9]{7,14}$');
```

**Valid formats:**
- ✅ +573001234567 (Colombia)
- ✅ +12025551234 (US)
- ✅ +447911123456 (UK)
- ❌ 3001234567 (missing +)
- ❌ +0123456789 (starts with 0)

## Views

### conversation_stats
```sql
CREATE VIEW conversation_stats AS
SELECT c.id, c.user_id, c.status,
  COUNT(m.id) AS message_count,
  MAX(m.timestamp) AS last_message_at,
  MIN(m.timestamp) AS first_message_at
FROM conversations c
LEFT JOIN messages_v2 m ON m.conversation_id = c.id
GROUP BY c.id, c.user_id, c.status;
```

### messaging_windows_stats
```sql
CREATE VIEW messaging_windows_stats AS
SELECT
  COUNT(*) AS total_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW()) AS active_windows,
  COUNT(*) FILTER (WHERE window_expires_at > NOW() AND
                        window_expires_at <= NOW() + INTERVAL '4 hours') AS windows_near_expiration,
  SUM(proactive_messages_sent_today) AS total_proactive_today
FROM messaging_windows;
```

## Index Strategy

### B-tree Indexes (85)
- Primary keys (UUIDs)
- Foreign keys (user_id, conversation_id, etc.)
- Timestamps (created_at, timestamp DESC)
- Composite indexes (user_id + status, conversation_id + timestamp)

### GIN Indexes (2)
- JSONB fields (metadata columns)

### HNSW Indexes (1)
- Vector embeddings (user_memory.embedding)

### Partial Indexes (7)
- `WHERE status = 'pending'` (reminders)
- `WHERE wa_conversation_id IS NOT NULL` (conversations)
- `WHERE status = 'active'` (conversations)
- `WHERE send_token IS NOT NULL` (reminders)
- `WHERE free_entry_point_expires_at IS NOT NULL` (messaging_windows)

**See**: [Monitoring & Performance](./11-monitoring-performance.md)

## Common Queries

### Get User with Active Conversation
```sql
SELECT u.*, c.id AS conversation_id
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id AND c.status = 'active'
WHERE u.phone_number = '+573001234567';
```

### Recent Messages for Conversation
```sql
SELECT *
FROM messages_v2
WHERE conversation_id = '...'
ORDER BY timestamp DESC
LIMIT 50;
```

### Pending Reminders Due Soon
```sql
SELECT r.*, u.phone_number
FROM reminders r
JOIN users u ON u.id = r.user_id
WHERE r.status = 'pending'
  AND r.scheduled_time <= NOW() + INTERVAL '5 minutes'
ORDER BY r.scheduled_time ASC;
```

## Next Steps

- **[pgvector Search](./03-pgvector-semantic-search.md)** - Semantic search implementation
- **[RLS Security](./04-rls-security.md)** - Row-Level Security policies
- **[Custom Functions](./05-custom-functions-triggers.md)** - Business logic & triggers

**Last Updated**: 2025-10-11
