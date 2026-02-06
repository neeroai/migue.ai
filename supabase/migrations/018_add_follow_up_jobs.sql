-- ============================================================================
-- Migration: Add follow_up_jobs table
-- Date: 2026-02-06 15:50
-- Purpose: Fix silent failures - table referenced but doesn't exist
-- Severity: HIGH - Follow-up jobs fail silently
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - lib/followups.ts references follow_up_jobs table at L64, L81, L102, L115
-- - Table doesn't exist in database
-- - Operations fail silently with @ts-expect-error suppression
-- - Interactive button presses and scheduled follow-ups broken
--
-- SOLUTION:
-- - Create follow_up_jobs table with proper schema
-- - Add RLS policies for service role
-- - Add indexes for due job queries
-- - Support status tracking (pending, sent, failed, cancelled)
--
-- ============================================================================

-- Create follow_up_jobs table
CREATE TABLE IF NOT EXISTS public.follow_up_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'schedule_confirm',
    'document_status',
    'reminder_check',
    'window_maintenance',
    'custom'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'failed',
    'cancelled'
  )),
  scheduled_for TIMESTAMPTZ NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Primary query: fetch due pending jobs
CREATE INDEX IF NOT EXISTS idx_follow_up_jobs_due
  ON public.follow_up_jobs(status, scheduled_for)
  WHERE status = 'pending';

-- User lookup
CREATE INDEX IF NOT EXISTS idx_follow_up_jobs_user
  ON public.follow_up_jobs(user_id);

-- Conversation lookup (for duplicate prevention)
CREATE INDEX IF NOT EXISTS idx_follow_up_jobs_conversation
  ON public.follow_up_jobs(conversation_id, category, status);

-- Status tracking
CREATE INDEX IF NOT EXISTS idx_follow_up_jobs_status
  ON public.follow_up_jobs(status, created_at DESC);

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.follow_up_jobs ENABLE ROW LEVEL SECURITY;

-- Service role bypass (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'follow_up_jobs'
      AND policyname = 'service_role_follow_up_jobs_all'
  ) THEN
    CREATE POLICY "service_role_follow_up_jobs_all" ON public.follow_up_jobs
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Users can view their own follow-ups (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'follow_up_jobs'
      AND policyname = 'users_select_own_follow_ups'
  ) THEN
    CREATE POLICY "users_select_own_follow_ups" ON public.follow_up_jobs
      FOR SELECT
      USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS t_follow_up_jobs_updated ON public.follow_up_jobs;
CREATE TRIGGER t_follow_up_jobs_updated
  BEFORE UPDATE ON public.follow_up_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON TABLE public.follow_up_jobs IS
  'Scheduled follow-up jobs for proactive messaging. Used for reminders, confirmations, and maintenance messages.';

COMMENT ON COLUMN public.follow_up_jobs.category IS
  'Follow-up category: schedule_confirm, document_status, reminder_check, window_maintenance, custom';

COMMENT ON COLUMN public.follow_up_jobs.status IS
  'Job status: pending (not yet sent), sent (delivered), failed (delivery error), cancelled (user cancelled)';

COMMENT ON COLUMN public.follow_up_jobs.scheduled_for IS
  'When to send the follow-up message. Adjusted for business hours (7am-8pm Bogotá).';

COMMENT ON COLUMN public.follow_up_jobs.payload IS
  'Additional data for the follow-up action (category-specific).';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Verify table created:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'follow_up_jobs';

-- Verify indexes:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'follow_up_jobs' ORDER BY indexname;

-- Verify RLS policies:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'follow_up_jobs' ORDER BY policyname;

-- Test insert:
-- INSERT INTO public.follow_up_jobs (user_id, conversation_id, category, scheduled_for)
-- VALUES (
--   '00000000-0000-0000-0000-000000000000',
--   '00000000-0000-0000-0000-000000000000',
--   'reminder_check',
--   NOW() + INTERVAL '1 hour'
-- ) RETURNING *;

-- ============================================================================
-- Integration Notes
-- ============================================================================
--
-- After applying this migration:
--
-- 1. Remove @ts-expect-error from lib/followups.ts L63, L80, L101, L114
-- 2. Regenerate TypeScript types:
--    npx supabase gen types typescript --project-id <project-id> > lib/database.types.ts
-- 3. Test follow-up scheduling:
--    - Send interactive button reply
--    - Verify no errors in Supabase logs
--    - Check follow_up_jobs table for pending jobs
--
-- ============================================================================
