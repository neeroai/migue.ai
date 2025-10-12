-- ============================================================================
-- Migration: Gemini Usage Tracking (IDEMPOTENT VERSION)
-- Date: 2025-10-11
-- Purpose: Idempotent migration to create gemini_usage table and policies
-- Can be run multiple times without errors
-- ============================================================================

-- Table: gemini_usage (IF NOT EXISTS is safe)
CREATE TABLE IF NOT EXISTS gemini_usage (
  date DATE PRIMARY KEY,
  requests INTEGER DEFAULT 0 CHECK (requests >= 0),
  tokens BIGINT DEFAULT 0 CHECK (tokens >= 0),
  cost DECIMAL(10, 4) DEFAULT 0.00 CHECK (cost >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index (IF NOT EXISTS is safe)
CREATE INDEX IF NOT EXISTS idx_gemini_usage_date ON gemini_usage(date DESC);

-- Comments (safe to re-run)
COMMENT ON TABLE gemini_usage IS 'Tracks daily Gemini API usage for free tier monitoring (1,500 req/day limit)';
COMMENT ON COLUMN gemini_usage.date IS 'Usage date (YYYY-MM-DD)';
COMMENT ON COLUMN gemini_usage.requests IS 'Total API requests for the day';
COMMENT ON COLUMN gemini_usage.tokens IS 'Total tokens consumed (prompt + completion)';
COMMENT ON COLUMN gemini_usage.cost IS 'Calculated cost (should be $0 within free tier)';

-- ============================================================================
-- Function: increment_gemini_usage (CREATE OR REPLACE is safe)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_gemini_usage(
  usage_date DATE,
  token_count INTEGER
) RETURNS TABLE(current_requests INTEGER, current_tokens BIGINT) AS $$
DECLARE
  result_requests INTEGER;
  result_tokens BIGINT;
BEGIN
  INSERT INTO gemini_usage (date, requests, tokens, cost)
  VALUES (usage_date, 1, token_count, 0)
  ON CONFLICT (date)
  DO UPDATE SET
    requests = gemini_usage.requests + 1,
    tokens = gemini_usage.tokens + token_count,
    updated_at = NOW()
  RETURNING requests, tokens INTO result_requests, result_tokens;

  RETURN QUERY SELECT result_requests, result_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_gemini_usage IS 'Atomically increments daily Gemini usage and returns current totals';

-- ============================================================================
-- Security: Row Level Security
-- ============================================================================

-- Enable RLS (safe to re-run)
ALTER TABLE gemini_usage ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists, then create
-- This ensures the policy is always up-to-date with the correct definition
DROP POLICY IF EXISTS service_role_full_access ON gemini_usage;

CREATE POLICY service_role_full_access ON gemini_usage
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Grant permissions (safe to re-run - will just re-grant)
GRANT EXECUTE ON FUNCTION increment_gemini_usage TO service_role;
GRANT EXECUTE ON FUNCTION increment_gemini_usage TO authenticated;

-- ============================================================================
-- Verification Query (Optional - run separately to test)
-- ============================================================================

-- SELECT * FROM gemini_usage WHERE date = CURRENT_DATE;
-- SELECT * FROM increment_gemini_usage(CURRENT_DATE, 1500);

-- ============================================================================
-- Migration Complete ✅
-- This migration is idempotent and can be run multiple times safely
-- ============================================================================
