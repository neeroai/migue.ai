# Custom Functions & Triggers

PostgreSQL functions and triggers implementing business logic for migue.ai.

## Overview

**12+ custom functions** for:
- Auto-updating timestamps
- State machine enforcement
- Messaging window analytics
- AI cost tracking
- Semantic search (pgvector)

## Core Triggers

### set_updated_at()

**Purpose**: Auto-update `updated_at` on row changes

```sql
-- supabase/schema.sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**Applied to tables**:
- users
- conversations
- calendar_credentials
- follow_up_jobs
- flow_sessions
- messaging_windows

**Usage**:
```sql
CREATE TRIGGER t_users_updated BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### reminders_validate_transition()

**Purpose**: State machine for reminder status

```sql
-- supabase/schema.sql (lines 282-294)
CREATE OR REPLACE FUNCTION reminders_validate_transition() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (OLD.status, NEW.status) IN ((
      'pending','sent'), ('pending','cancelled'), ('pending','failed'),
      'failed','pending'), ('failed','cancelled'),
      ('cancelled','pending')
    )) THEN
      RAISE EXCEPTION 'Invalid reminder status transition: % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**Valid transitions**:
```
pending → sent | cancelled | failed
failed → pending | cancelled
cancelled → pending
```

**Invalid**: sent → pending, sent → cancelled (final state)

### reminders_set_send_token()

**Purpose**: Auto-generate idempotency token when sent

```sql
-- supabase/schema.sql (lines 300-306)
CREATE OR REPLACE FUNCTION reminders_set_send_token() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND NEW.send_token IS NULL THEN
    NEW.send_token = gen_random_uuid();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**Ensures**: Each sent reminder has unique token → prevents duplicate sends.

## Messaging Window Functions

### reset_daily_proactive_count()

**Purpose**: Reset proactive message counter at midnight (Colombia timezone)

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 60-70)
CREATE OR REPLACE FUNCTION reset_daily_proactive_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_proactive_sent_at IS NOT NULL AND
     DATE(NEW.last_proactive_sent_at AT TIME ZONE 'America/Bogota') <
     DATE(NOW() AT TIME ZONE 'America/Bogota') THEN
    NEW.proactive_messages_sent_today = 0;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

**Trigger**: Runs BEFORE UPDATE on messaging_windows
**Effect**: Auto-resets counter when last message was sent on previous day

### find_windows_near_expiration()

**Purpose**: Find messaging windows expiring soon (for cron jobs)

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 77-102)
CREATE OR REPLACE FUNCTION find_windows_near_expiration(
  hours_threshold INT DEFAULT 4
)
RETURNS TABLE (
  user_id UUID,
  phone_number TEXT,
  window_expires_at TIMESTAMPTZ,
  hours_remaining NUMERIC,
  proactive_messages_sent_today INT,
  last_proactive_sent_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mw.user_id,
    mw.phone_number,
    mw.window_expires_at,
    EXTRACT(EPOCH FROM (mw.window_expires_at - NOW())) / 3600 AS hours_remaining,
    mw.proactive_messages_sent_today,
    mw.last_proactive_sent_at
  FROM messaging_windows mw
  WHERE mw.window_expires_at > NOW()
    AND mw.window_expires_at <= NOW() + (hours_threshold || ' hours')::INTERVAL
  ORDER BY mw.window_expires_at ASC;
END $$ LANGUAGE plpgsql;
```

**Usage**:
```typescript
const { data } = await supabase.rpc('find_windows_near_expiration', {
  hours_threshold: 4
})
```

### is_window_open()

**Purpose**: Check if messaging window is currently open

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 104-119)
CREATE OR REPLACE FUNCTION is_window_open(p_phone_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT window_expires_at INTO v_expires_at
  FROM messaging_windows
  WHERE phone_number = p_phone_number;

  IF v_expires_at IS NULL THEN RETURN FALSE; END IF;
  RETURN v_expires_at > NOW();
END $$ LANGUAGE plpgsql;
```

### is_free_entry_active()

**Purpose**: Check if 72h free entry point is active

```sql
-- supabase/migrations/007_messaging_windows.sql (lines 121-136)
CREATE OR REPLACE FUNCTION is_free_entry_active(p_phone_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT free_entry_point_expires_at INTO v_expires_at
  FROM messaging_windows
  WHERE phone_number = p_phone_number;

  IF v_expires_at IS NULL THEN RETURN FALSE; END IF;
  RETURN v_expires_at > NOW();
END $$ LANGUAGE plpgsql;
```

## AI Cost Tracking Functions

### get_daily_ai_costs()

**Purpose**: Daily cost summary by provider and task

```sql
-- supabase/migrations/004_ai_cost_tracking.sql (lines 42-64)
CREATE OR REPLACE FUNCTION get_daily_ai_costs(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider TEXT,
  task_type TEXT,
  total_requests BIGINT,
  total_cost DECIMAL
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage_tracking.provider,
    ai_usage_tracking.task_type,
    COUNT(*) AS total_requests,
    SUM(ai_usage_tracking.cost_usd) AS total_cost
  FROM ai_usage_tracking
  WHERE DATE(ai_usage_tracking.created_at) = target_date
  GROUP BY ai_usage_tracking.provider, ai_usage_tracking.task_type
  ORDER BY total_cost DESC;
END;
$$;
```

**TypeScript usage**:
```typescript
const { data } = await supabase.rpc('get_daily_ai_costs', {
  target_date: '2025-10-11'
})
// Returns: [{ provider: 'gemini', task_type: 'chat', total_requests: 150, total_cost: 0.00 }, ...]
```

### get_ai_cost_trends()

**Purpose**: Cost trends over last N days

```sql
-- supabase/migrations/004_ai_cost_tracking.sql (lines 70-97)
CREATE OR REPLACE FUNCTION get_ai_cost_trends(days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_cost DECIMAL,
  claude_cost DECIMAL,
  groq_cost DECIMAL,
  openai_cost DECIMAL,
  total_requests BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) AS date,
    SUM(cost_usd) AS total_cost,
    SUM(CASE WHEN provider = 'claude' THEN cost_usd ELSE 0 END) AS claude_cost,
    SUM(CASE WHEN provider = 'groq' THEN cost_usd ELSE 0 END) AS groq_cost,
    SUM(CASE WHEN provider = 'openai' THEN cost_usd ELSE 0 END) AS openai_cost,
    COUNT(*) AS total_requests
  FROM ai_usage_tracking
  WHERE created_at >= CURRENT_DATE - days
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at) DESC;
END;
$$;
```

## Semantic Search Function

### search_user_memory()

**Purpose**: pgvector similarity search

```sql
-- supabase/migrations/003_user_memory_embeddings.sql (lines 58-93)
CREATE OR REPLACE FUNCTION search_user_memory(
  query_embedding VECTOR(1536),
  target_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  type TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_memory.id,
    user_memory.content,
    user_memory.category,
    user_memory.type,
    1 - (user_memory.embedding <#> query_embedding) AS similarity,
    user_memory.created_at
  FROM user_memory
  WHERE user_memory.user_id = target_user_id
    AND user_memory.embedding IS NOT NULL
    AND 1 - (user_memory.embedding <#> query_embedding) > match_threshold
  ORDER BY user_memory.embedding <#> query_embedding ASC
  LIMIT match_count;
END;
$$;
```

**See**: [pgvector Semantic Search](./03-pgvector-semantic-search.md)

## Service Role Functions

### svc_upsert_user_by_phone()

**Purpose**: Webhook upsert (bypasses RLS)

```sql
-- supabase/security.sql (lines 61-73)
CREATE OR REPLACE FUNCTION svc_upsert_user_by_phone(p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id UUID; BEGIN
  INSERT INTO public.users(phone_number)
  VALUES (p_phone)
  ON CONFLICT (phone_number) DO UPDATE SET phone_number = excluded.phone_number
  RETURNING id INTO v_user_id;
  RETURN v_user_id;
END $$;
```

### svc_get_or_create_conversation()

**Purpose**: Get active conversation or create new

```sql
-- supabase/security.sql (lines 75-90)
CREATE OR REPLACE FUNCTION svc_get_or_create_conversation(p_user_id UUID, p_wa_id VARCHAR)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conv_id UUID; BEGIN
  IF p_wa_id IS NOT NULL THEN
    SELECT id INTO v_conv_id FROM public.conversations WHERE wa_conversation_id = p_wa_id LIMIT 1;
    IF FOUND THEN RETURN v_conv_id; END IF;
  END IF;
  INSERT INTO public.conversations(user_id, wa_conversation_id, status)
  VALUES (p_user_id, p_wa_id, 'active')
  RETURNING id INTO v_conv_id;
  RETURN v_conv_id;
END $$;
```

### svc_insert_inbound_message()

**Purpose**: Insert message with conflict handling

```sql
-- supabase/security.sql (lines 92-112)
CREATE OR REPLACE FUNCTION svc_insert_inbound_message(
  p_conversation_id UUID,
  p_type msg_type,
  p_content TEXT,
  p_media_url TEXT,
  p_wa_message_id VARCHAR,
  p_timestamp TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.messages_v2(
    conversation_id, direction, type, content, media_url, wa_message_id, timestamp
  ) VALUES (
    p_conversation_id, 'inbound', p_type, p_content, p_media_url, p_wa_message_id, p_timestamp
  )
  ON CONFLICT (wa_message_id) DO NOTHING;
END $$;
```

## WhatsApp v23.0 Triggers

### flow_sessions_set_completed_at()

**Purpose**: Set completion timestamp when flow completes

```sql
-- supabase/schema.sql (lines 417-423)
CREATE OR REPLACE FUNCTION flow_sessions_set_completed_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
```

## Best Practices

### Security Definer Pattern

```sql
-- ✅ Good: Explicit search_path prevents SQL injection
CREATE OR REPLACE FUNCTION my_function()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Prevents schema hijacking
AS $$ ... $$;
```

### Error Handling

```sql
-- ✅ Good: Descriptive error messages
IF NOT condition THEN
  RAISE EXCEPTION 'Invalid state transition: % -> %', OLD.status, NEW.status;
END IF;
```

### Idempotency

```sql
-- ✅ Good: ON CONFLICT for duplicate prevention
INSERT INTO table (unique_col, data)
VALUES (val, data)
ON CONFLICT (unique_col) DO NOTHING;
```

## TypeScript Integration

```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

// Call RPC function
const { data, error } = await getSupabaseServerClient().rpc('search_user_memory', {
  query_embedding: JSON.stringify(vector),
  target_user_id: userId,
  match_threshold: 0.3,
  match_count: 10
})

if (error) {
  console.error('RPC failed:', error.message)
}
```

## Next Steps

- **[Messaging Windows](./06-messaging-windows.md)** - Window management functions
- **[AI Cost Tracking](./07-ai-cost-tracking.md)** - Cost analytics functions
- **[Migrations](./12-migrations-maintenance.md)** - Function deployment

**Last Updated**: 2025-10-11
