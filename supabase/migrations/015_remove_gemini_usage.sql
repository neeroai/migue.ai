-- Migration: Remove Gemini Usage Tracking
-- Date: 2025-10-17
-- Reason: Removed Gemini as AI provider, reverting to GPT-4o-mini primary
--
-- This migration removes the gemini_usage table and all related policies

-- Drop RLS policies first
DROP POLICY IF EXISTS "Users can view own Gemini usage" ON gemini_usage;
DROP POLICY IF EXISTS "Service role full access to Gemini usage" ON gemini_usage;

-- Drop indexes
DROP INDEX IF EXISTS idx_gemini_usage_user_created;
DROP INDEX IF EXISTS idx_gemini_usage_created_at;
DROP INDEX IF EXISTS idx_gemini_usage_user_id;

-- Drop table
DROP TABLE IF EXISTS gemini_usage CASCADE;

-- Add comment documenting the change
COMMENT ON SCHEMA public IS 'Removed Gemini usage tracking (2025-10-17) - reverted to GPT-4o-mini as primary AI provider';
