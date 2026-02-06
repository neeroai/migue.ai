-- ============================================================================
-- Migration: Add conversation_actions table
-- Date: 2026-02-06 15:55
-- Purpose: Fix silent failures - table referenced but doesn't exist
-- Severity: HIGH - Action recording fails silently
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - lib/conversation-utils.ts references conversation_actions table at L117
-- - Table doesn't exist in database
-- - recordConversationAction() fails silently with @ts-expect-error
-- - User actions (button clicks, selections) not persisted
--
-- SOLUTION:
-- - Create conversation_actions table with proper schema
-- - Add RLS policies for service role
-- - Add indexes for action queries
-- - Support flexible payload for different action types
--
-- ============================================================================

-- Create conversation_actions table
CREATE TABLE IF NOT EXISTS public.conversation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary query: fetch actions by conversation
CREATE INDEX IF NOT EXISTS idx_conversation_actions_conversation
  ON public.conversation_actions(conversation_id, created_at DESC);

-- User lookup
CREATE INDEX IF NOT EXISTS idx_conversation_actions_user
  ON public.conversation_actions(user_id, created_at DESC);

-- Action type filtering
CREATE INDEX IF NOT EXISTS idx_conversation_actions_type
  ON public.conversation_actions(action_type, created_at DESC);

-- User + action type composite
CREATE INDEX IF NOT EXISTS idx_conversation_actions_user_type
  ON public.conversation_actions(user_id, action_type, created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.conversation_actions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_actions'
      AND policyname = 'service_role_conversation_actions_all'
  ) THEN
    CREATE POLICY "service_role_conversation_actions_all" ON public.conversation_actions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Users can view their own actions (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_actions'
      AND policyname = 'users_select_own_actions'
  ) THEN
    CREATE POLICY "users_select_own_actions" ON public.conversation_actions
      FOR SELECT
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE public.conversation_actions IS
  'Records user actions within conversations (button clicks, selections, confirmations). Used for analytics and action history.';

COMMENT ON COLUMN public.conversation_actions.action_type IS
  'Type of action performed (e.g., button_click, selection, confirmation). No constraint to allow flexibility.';

COMMENT ON COLUMN public.conversation_actions.payload IS
  'Additional data about the action. Includes action_id and any action-specific metadata.';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify table created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'conversation_actions';

-- Verify indexes:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'conversation_actions' ORDER BY indexname;

-- Verify RLS policies:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'conversation_actions' ORDER BY policyname;

-- Test insert:
-- INSERT INTO public.conversation_actions (conversation_id, user_id, action_type, payload)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   'button_click',
--   '{"action_id": "confirm_reminder", "button_text": "Yes, remind me"}'::jsonb
-- ) RETURNING *;

-- Query actions by type:
-- SELECT action_type, COUNT(*), MAX(created_at) as last_action
-- FROM public.conversation_actions
-- GROUP BY action_type
-- ORDER BY COUNT(*) DESC;

-- ============================================================================
-- Integration Notes
-- ============================================================================
--
-- After applying this migration:
--
-- 1. Remove @ts-expect-error from lib/conversation-utils.ts L116
-- 2. Regenerate TypeScript types:
--    npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts
-- 3. Test action recording:
--    - Send interactive button reply
--    - Verify record in conversation_actions table
--    - Query: SELECT * FROM conversation_actions ORDER BY created_at DESC LIMIT 10;
--
-- ============================================================================
