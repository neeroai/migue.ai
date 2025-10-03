-- Migration: Optimize RLS Performance with B-tree Indexes
-- Based on 2025 Supabase RLS best practices for 100x query improvement
-- Reference: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices

-- ========================================
-- PHASE 1: Optimized B-tree Indexes
-- ========================================

-- Users table optimization (for auth.uid() lookups)
CREATE INDEX IF NOT EXISTS idx_users_phone_btree
  ON public.users USING btree (phone_number);

-- Conversations table optimization (for user_id RLS policies)
CREATE INDEX IF NOT EXISTS idx_conversations_userid_btree
  ON public.conversations USING btree (user_id);

-- Additional conversation indexes for common queries
CREATE INDEX IF NOT EXISTS idx_conversations_wa_id
  ON public.conversations USING btree (wa_conversation_id)
  WHERE wa_conversation_id IS NOT NULL;

-- Messages optimization for conversation-based queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_btree
  ON public.messages_v2 USING btree (conversation_id);

-- Composite index for conversation + timestamp queries (most common)
CREATE INDEX IF NOT EXISTS idx_messages_conv_ts_btree
  ON public.messages_v2 USING btree (conversation_id, timestamp DESC);

-- Reminders optimization
CREATE INDEX IF NOT EXISTS idx_reminders_user_btree
  ON public.reminders USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_reminders_status_time_btree
  ON public.reminders USING btree (status, scheduled_time)
  WHERE status = 'pending';

-- ========================================
-- PHASE 2: Optimized RLS Policies
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
DROP POLICY IF EXISTS "messages_v2_select_own" ON public.messages_v2;
DROP POLICY IF EXISTS "reminders_select_own" ON public.reminders;

-- Enable RLS on tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- Optimized RLS policies using function wrapping technique
-- This causes PostgreSQL to use initPlan and "cache" auth.uid() results

-- Users: SELECT own record
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id = (SELECT auth.uid()));

-- Conversations: SELECT own conversations
CREATE POLICY "conversations_select_own" ON public.conversations
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- Messages: SELECT from own conversations (optimized subquery)
CREATE POLICY "messages_v2_select_own" ON public.messages_v2
  FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Reminders: SELECT own reminders
CREATE POLICY "reminders_select_own" ON public.reminders
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ========================================
-- PHASE 3: Composite Indexes for Analytics
-- ========================================

-- For conversation statistics
CREATE INDEX IF NOT EXISTS idx_conversations_user_status
  ON public.conversations USING btree (user_id, status);

-- For message type analysis
CREATE INDEX IF NOT EXISTS idx_messages_type_direction
  ON public.messages_v2 USING btree (type, direction);

-- For time-based queries (last 24h, last 7d, etc.)
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_btree
  ON public.messages_v2 USING btree (timestamp DESC);

-- ========================================
-- PHASE 4: Performance Monitoring Views
-- ========================================

-- View for conversation activity tracking
CREATE OR REPLACE VIEW conversation_stats AS
SELECT
  c.id,
  c.user_id,
  c.status,
  COUNT(m.id) as message_count,
  MAX(m.timestamp) as last_message_at,
  MIN(m.timestamp) as first_message_at
FROM conversations c
LEFT JOIN messages_v2 m ON m.conversation_id = c.id
GROUP BY c.id, c.user_id, c.status;

-- View for user activity metrics
CREATE OR REPLACE VIEW user_activity_stats AS
SELECT
  u.id,
  u.phone_number,
  COUNT(DISTINCT c.id) as conversation_count,
  COUNT(m.id) as total_messages,
  MAX(m.timestamp) as last_activity
FROM users u
LEFT JOIN conversations c ON c.user_id = u.id
LEFT JOIN messages_v2 m ON m.conversation_id = c.id
GROUP BY u.id, u.phone_number;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- To verify indexes are created:
-- SELECT * FROM pg_indexes WHERE tablename IN ('users', 'conversations', 'messages_v2', 'reminders');

-- To check query performance:
-- EXPLAIN ANALYZE SELECT * FROM messages_v2 WHERE conversation_id = 'your-id';

COMMENT ON INDEX idx_users_phone_btree IS 'B-tree index for phone lookups - 100x improvement for RLS policies';
COMMENT ON INDEX idx_conversations_userid_btree IS 'B-tree index for user_id lookups - critical for RLS performance';
COMMENT ON INDEX idx_messages_conv_ts_btree IS 'Composite index for conversation + timestamp queries - most common pattern';
