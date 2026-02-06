-- ============================================================================
-- Migration: Add provider column to openai_usage table
-- Date: 2026-02-06 15:45
-- Purpose: Fix data loss - provider field referenced but column missing
-- Severity: HIGH - All usage tracking to DB is broken
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - ai-cost-tracker.ts:351 inserts provider field
-- - Column missing in migration 016
-- - Insert silently fails (caught at L368-370)
-- - NO usage data persisted to database
--
-- SOLUTION:
-- - Add provider TEXT column with NOT NULL constraint
-- - Default to 'openai' for backwards compatibility
-- - Add index for provider-based queries
-- - Support multi-provider tracking (openai, claude)
--
-- ============================================================================

-- Add provider column (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'openai_usage'
      AND column_name = 'provider'
  ) THEN
    ALTER TABLE openai_usage
    ADD COLUMN provider TEXT NOT NULL DEFAULT 'openai'
    CHECK (provider IN ('openai', 'claude'));
  END IF;
END $$;

-- Add index on provider for analytics queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_provider
  ON openai_usage(provider);

-- Add composite index for provider + timestamp (common query pattern)
CREATE INDEX IF NOT EXISTS idx_openai_usage_provider_timestamp
  ON openai_usage(provider, timestamp DESC);

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN openai_usage.provider IS
  'AI provider name (openai, claude). Used for multi-provider cost tracking and analytics.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify column added:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'openai_usage'
--   AND column_name = 'provider';

-- Verify indexes:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'openai_usage'
--   AND indexname LIKE '%provider%'
-- ORDER BY indexname;

-- Test query with provider:
-- SELECT provider, model, COUNT(*), SUM(total_cost) as total_cost
-- FROM openai_usage
-- GROUP BY provider, model
-- ORDER BY total_cost DESC;

-- ============================================================================
-- INTEGRATION NOTES
-- ============================================================================
--
-- After applying this migration:
--
-- 1. lib/ai-cost-tracker.ts persistUsageToDatabase() will work correctly
-- 2. Multi-provider tracking fully functional (OpenAI + Claude)
-- 3. A4 (cost tracker cold start) can now hydrate from database
-- 4. Analytics queries can filter/group by provider
--
-- ============================================================================
