-- ============================================================================
-- Migration: Fix Gemini Usage RLS Policy (CRITICAL)
-- Date: 2025-10-12
-- Purpose: Fix broken RLS policy blocking Edge Function access to gemini_usage
-- Severity: CRITICAL - Blocks all AI processing in production
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - Migration 009 created RLS policy using auth.role() = 'service_role'
-- - auth.role() returns NULL for Edge Functions (no user session)
-- - NULL != 'service_role' → RLS blocks all queries
-- - Result: canUseFreeTier() fails → Gemini skipped → bot errors
--
-- SOLUTION:
-- - Use TO service_role targeting (not auth.role() check)
-- - USING (true) for unconditional access
-- - Follows same pattern as migration 010 for other tables
--
-- IMPACT:
-- - BEFORE: All gemini_usage queries fail with RLS error 42501
-- - AFTER: Edge Functions can read/write gemini_usage freely
-- - Users: Bot starts working again, no more error messages
--
-- ============================================================================

-- Drop the broken policy
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;

-- Create correct service role bypass policy
-- This matches the pattern used in migration 010 for all other tables
CREATE POLICY service_role_gemini_usage_all ON gemini_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERY (Run after applying migration)
-- ============================================================================

-- Should return 1 row showing the new policy:
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'gemini_usage';

-- Expected output:
-- policyname: service_role_gemini_usage_all
-- cmd: *
-- roles: {service_role}
-- qual: true
-- with_check: true

-- ============================================================================
-- SECURITY IMPACT
-- ============================================================================
--
-- BEFORE (BROKEN):
--   - Edge Functions: BLOCKED (auth.role() returns NULL)
--   - Service role key: BLOCKED (policy check fails)
--   - Result: Bot fails with "tuve un problema al procesar tu mensaje"
--
-- AFTER (FIXED):
--   - Edge Functions: ALLOWED (service_role bypass)
--   - Service role key: ALLOWED (TO service_role)
--   - Result: Bot works normally, uses Gemini free tier
--
-- IMPORTANT:
--   - Only service_role key can access gemini_usage (by design)
--   - Anon key has no policies → blocked by default (secure)
--   - No security regression: service role always had access intent
--
-- ============================================================================

-- Add comment for documentation
COMMENT ON POLICY service_role_gemini_usage_all ON gemini_usage IS
  'Service role bypass: Edge Functions can track Gemini usage. Fixed from broken auth.role() check.';

-- ============================================================================
-- Migration Complete ✅
-- Next Steps:
-- 1. Apply this migration in Supabase Dashboard → SQL Editor
-- 2. Verify policy with SELECT query above
-- 3. Test WhatsApp bot to confirm fix
-- 4. Monitor Vercel logs for successful Gemini API calls
-- ============================================================================
