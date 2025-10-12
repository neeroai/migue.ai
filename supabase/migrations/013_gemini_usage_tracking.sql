-- ============================================================================
-- Migration: Gemini Free Tier Usage Tracking
-- Date: 2025-10-11
-- Purpose: Track Gemini API usage to enforce 1,500 requests/day free tier limit
-- Best Practice: PostgreSQL RPC with atomic UPSERT for Edge Runtime
-- ============================================================================

-- Table: gemini_usage
-- Stores daily usage metrics for Gemini API (requests, tokens, cost)
CREATE TABLE IF NOT EXISTS gemini_usage (
  date DATE PRIMARY KEY,
  requests INTEGER DEFAULT 0 CHECK (requests >= 0),
  tokens BIGINT DEFAULT 0 CHECK (tokens >= 0),
  cost DECIMAL(10, 4) DEFAULT 0.00 CHECK (cost >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index: Fast queries by date (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_gemini_usage_date ON gemini_usage(date DESC);

-- Comment: Documentation for table
COMMENT ON TABLE gemini_usage IS 'Tracks daily Gemini API usage for free tier monitoring (1,500 req/day limit)';
COMMENT ON COLUMN gemini_usage.date IS 'Usage date (YYYY-MM-DD)';
COMMENT ON COLUMN gemini_usage.requests IS 'Total API requests for the day';
COMMENT ON COLUMN gemini_usage.tokens IS 'Total tokens consumed (prompt + completion)';
COMMENT ON COLUMN gemini_usage.cost IS 'Calculated cost (should be $0 within free tier)';

-- ============================================================================
-- Function: increment_gemini_usage
-- Best Practice 2025: Atomic UPSERT with RETURNING for Edge Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_gemini_usage(
  usage_date DATE,
  token_count INTEGER
) RETURNS TABLE(current_requests INTEGER, current_tokens BIGINT) AS $$
DECLARE
  result_requests INTEGER;
  result_tokens BIGINT;
BEGIN
  -- Atomic increment using INSERT ... ON CONFLICT
  -- This prevents race conditions in concurrent Edge Function executions
  INSERT INTO gemini_usage (date, requests, tokens, cost)
  VALUES (usage_date, 1, token_count, 0)
  ON CONFLICT (date)
  DO UPDATE SET
    requests = gemini_usage.requests + 1,
    tokens = gemini_usage.tokens + token_count,
    updated_at = NOW()
  RETURNING requests, tokens INTO result_requests, result_tokens;

  -- Return current state for logging/alerting
  RETURN QUERY SELECT result_requests, result_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment: Function documentation
COMMENT ON FUNCTION increment_gemini_usage IS 'Atomically increments daily Gemini usage and returns current totals';

-- ============================================================================
-- Security: Row Level Security (RLS)
-- Best Practice: Enable RLS and restrict access to service_role
-- ============================================================================

ALTER TABLE gemini_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Only service_role can read/write
-- Edge Functions use service_role by default via getSupabaseServerClient()
CREATE POLICY "service_role_full_access" ON gemini_usage
  FOR ALL
  USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

-- Grant execute permission on RPC function
GRANT EXECUTE ON FUNCTION increment_gemini_usage TO service_role;
GRANT EXECUTE ON FUNCTION increment_gemini_usage TO authenticated;

-- ============================================================================
-- Sample Query: Check today's usage (for testing)
-- ============================================================================

-- SELECT * FROM gemini_usage WHERE date = CURRENT_DATE;

-- SELECT * FROM increment_gemini_usage(CURRENT_DATE, 1500);

-- ============================================================================
-- Migration Complete
-- Next Steps:
-- 1. Update lib/gemini-client.ts to use canUseFreeTier() with Supabase query
-- 2. Update trackGeminiUsage() to call increment_gemini_usage RPC
-- 3. Test with: npm run db:verify
-- ============================================================================
