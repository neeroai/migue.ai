-- Migration: Add conversations table index
-- Date: 2026-02-06 18:45
-- Purpose: Optimize user conversation queries
-- Impact: Speeds up getConversationHistory and user-specific conversation fetches

-- Add index on conversations(user_id, created_at DESC)
-- Covers common query pattern: WHERE user_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_conversations_user_created
ON public.conversations(user_id, created_at DESC);

-- Verify index created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename = 'conversations'
    AND indexname = 'idx_conversations_user_created'
  ) THEN
    RAISE NOTICE 'Index idx_conversations_user_created created successfully';
  ELSE
    RAISE EXCEPTION 'Index idx_conversations_user_created creation failed';
  END IF;
END $$;
