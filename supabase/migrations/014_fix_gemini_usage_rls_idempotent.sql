-- ============================================================================
-- Migration: Fix Gemini Usage RLS Policy (IDEMPOTENT VERSION)
-- Date: 2025-10-12
-- Purpose: Clean up broken RLS policy and ensure correct policy exists
-- Note: Safe to run even if correct policy already exists from migration 010
-- ============================================================================
--
-- BACKGROUND:
-- - Migration 009 created broken policy: service_role_full_access
--   USING (auth.role() = 'service_role') → Returns NULL in Edge Functions
-- - Migration 010 created correct policy: service_role_gemini_usage_all
--   TO service_role, USING (true) → Works correctly
-- - This migration ensures only the correct policy exists
--
-- SAFE TO RUN MULTIPLE TIMES (Idempotent)
-- ============================================================================

-- Drop any existing policies (broken or correct - we'll recreate)
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;
DROP POLICY IF EXISTS service_role_gemini_usage_all ON gemini_usage;

-- Create correct service role bypass policy
CREATE POLICY service_role_gemini_usage_all ON gemini_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add documentation comment
COMMENT ON POLICY service_role_gemini_usage_all ON gemini_usage IS
  'Service role bypass: Edge Functions can track Gemini usage. Replaced broken auth.role() check with TO service_role.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Should return exactly 1 row:
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
-- Migration Complete ✅
-- This version is fully idempotent and safe to run multiple times
-- ============================================================================
