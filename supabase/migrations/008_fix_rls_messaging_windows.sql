-- ============================================================================
-- Migration: Fix RLS Policy for messaging_windows
-- Date: 2025-10-11
-- Purpose: Tighten overly permissive RLS policy (security fix)
-- Severity: CRITICAL - Current policy allows all access (security vulnerability)
-- ============================================================================

-- Drop overly permissive policy
DROP POLICY IF EXISTS "allow_all_messaging_windows" ON public.messaging_windows;

-- Create secure policy: users can only access their own messaging windows (IDEMPOTENT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messaging_windows'
      AND policyname = 'users_own_messaging_windows'
  ) THEN
    CREATE POLICY "users_own_messaging_windows"
      ON public.messaging_windows
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Comment: Documentation
COMMENT ON POLICY "users_own_messaging_windows" ON public.messaging_windows IS
  'RLS policy: Users can only access their own messaging windows. Service role bypasses RLS.';

-- ============================================================================
-- Verification Query (run after applying)
-- ============================================================================

-- SELECT * FROM pg_policies WHERE tablename = 'messaging_windows';

-- Expected result:
-- policyname: users_own_messaging_windows
-- permissive: PERMISSIVE
-- cmd: ALL
-- qual: (user_id = auth.uid())
-- with_check: (user_id = auth.uid())

-- ============================================================================
-- Security Impact
-- ============================================================================

-- BEFORE (VULNERABLE):
--   - ANY user could read/write ANY messaging_window
--   - Potential data leaks between users
--   - No access control

-- AFTER (SECURE):
--   - Users can only access their own windows
--   - service_role still has full access (for cron jobs)
--   - Compliant with security best practices

-- ============================================================================
