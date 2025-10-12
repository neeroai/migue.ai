-- ============================================================================
-- Migration: Add Service Role Bypass Policies for All Tables (FIXED)
-- Date: 2025-10-11
-- Version: 2 (Corrected)
-- Purpose: Fix database writes failing due to missing RLS policies
-- Severity: CRITICAL - All INSERT/UPDATE/DELETE operations currently blocked
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - Migration 001 created RLS policies for SELECT only
-- - No policies exist for INSERT, UPDATE, DELETE operations
-- - auth.uid() returns NULL without Supabase Auth
-- - Result: All writes silently fail with error code 42501 (insufficient_privilege)
--
-- SOLUTION:
-- - Add service_role bypass policies for all tables
-- - Service role key bypasses user-specific RLS checks
-- - Allows backend code to write to database
-- - User-facing anon key still protected by existing SELECT policies
--
-- FIXES IN V2:
-- - Wrapped calendar_credentials in IF EXISTS (table doesn't exist)
-- - Wrapped calendar_events in IF EXISTS (table doesn't exist)
-- - Wrapped conversation_actions in IF EXISTS (table doesn't exist)
-- - Wrapped follow_up_jobs in IF EXISTS (table doesn't exist)
-- - Wrapped expenses in IF EXISTS (migration 011 may not be applied yet)
--
-- ============================================================================

-- ========================================
-- PHASE 1: Core Tables (ALWAYS exist)
-- ========================================

-- Users table: Service role full access
CREATE POLICY "service_role_users_all" ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Conversations table: Service role full access
CREATE POLICY "service_role_conversations_all" ON public.conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Messages table: Service role full access
CREATE POLICY "service_role_messages_all" ON public.messages_v2
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Reminders table: Service role full access
CREATE POLICY "service_role_reminders_all" ON public.reminders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- PHASE 2: Calendar & Events Tables (OPTIONAL - may not exist)
-- ========================================

-- Calendar credentials: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_credentials'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_calendar_credentials_all" ON public.calendar_credentials
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- Calendar events: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'calendar_events'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_calendar_events_all" ON public.calendar_events
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ========================================
-- PHASE 3: Messaging & Communication Tables
-- ========================================

-- Messaging windows: Service role full access
CREATE POLICY "service_role_messaging_windows_all" ON public.messaging_windows
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Conversation actions: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_actions'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_conversation_actions_all" ON public.conversation_actions
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- Follow-up jobs: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'follow_up_jobs'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_follow_up_jobs_all" ON public.follow_up_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ========================================
-- PHASE 4: WhatsApp v23.0 Tables (ALWAYS exist)
-- ========================================

-- User interactions: Service role full access
CREATE POLICY "service_role_user_interactions_all" ON public.user_interactions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User locations: Service role full access
CREATE POLICY "service_role_user_locations_all" ON public.user_locations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Call logs: Service role full access
CREATE POLICY "service_role_call_logs_all" ON public.call_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Flow sessions: Service role full access
CREATE POLICY "service_role_flow_sessions_all" ON public.flow_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- PHASE 5: Documents & AI Tables
-- ========================================

-- Documents: Service role full access
CREATE POLICY "service_role_documents_all" ON public.documents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Embeddings: Service role full access
CREATE POLICY "service_role_embeddings_all" ON public.embeddings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User memory: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_memory'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_user_memory_all" ON public.user_memory
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- AI usage tracking: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ai_usage_tracking'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_ai_usage_all" ON public.ai_usage_tracking
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- Gemini usage: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'gemini_usage'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_gemini_usage_all" ON public.gemini_usage
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- Scheduled messages: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'scheduled_messages'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_scheduled_messages_all" ON public.scheduled_messages
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- Webhook failures (DLQ): Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'webhook_failures'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_webhook_failures_all" ON public.webhook_failures
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ========================================
-- PHASE 6: Expenses Table (NEW - may not exist yet)
-- ========================================

-- Expenses: Service role full access (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expenses'
  ) THEN
    EXECUTE 'CREATE POLICY "service_role_expenses_all" ON public.expenses
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true)';
  END IF;
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- To verify policies were created:
-- SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND policyname LIKE 'service_role%'
-- ORDER BY tablename, policyname;

-- To test if writes now work (replace with actual user_id):
-- INSERT INTO public.users (phone_number) VALUES ('+573001234567') RETURNING id;
-- DELETE FROM public.users WHERE phone_number = '+573001234567';

-- ============================================================================
-- SECURITY IMPACT
-- ============================================================================
--
-- BEFORE (BROKEN):
--   - All INSERT/UPDATE/DELETE operations failed
--   - Error code 42501 (insufficient_privilege)
--   - Data loss for features like expenses, reminders, messages
--   - Users thought data was saved but it wasn't
--
-- AFTER (WORKING):
--   - Service role can read/write all tables
--   - Backend code can persist data properly
--   - User-facing anon key still protected by SELECT policies
--   - No security regression (service role always had access via RLS bypass)
--
-- IMPORTANT:
--   - Production MUST use service_role key in SUPABASE_KEY environment variable
--   - Never expose service_role key to client-side code
--   - Anon key should only be used for client SDK (if ever implemented)
--
-- ============================================================================

-- Documentation comments
COMMENT ON POLICY "service_role_users_all" ON public.users IS
  'Service role bypass: Backend can manage all user records. User-facing clients still protected by users_select_own policy.';

COMMENT ON POLICY "service_role_messages_all" ON public.messages_v2 IS
  'Service role bypass: Backend can persist all messages. Critical for webhook processing.';

COMMENT ON POLICY "service_role_reminders_all" ON public.reminders IS
  'Service role bypass: Backend can create/update reminders. Critical for AI agent functionality.';
