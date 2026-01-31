-- Migration 006: Add category column to ai_requests
-- Created: 2026-01-30 14:00
-- Purpose: Track task category for cost analytics and model routing insights

-- Add category enum type
DO $$ BEGIN
  CREATE TYPE task_category AS ENUM (
    'simple-query',
    'single-tool',
    'multi-tool',
    'voice-message',
    'image-document',
    'spanish-conversation',
    'complex-reasoning',
    'fallback'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add category column to ai_requests
ALTER TABLE ai_requests
ADD COLUMN IF NOT EXISTS category task_category;

-- Update provider constraint to include new providers
ALTER TABLE ai_requests
DROP CONSTRAINT IF EXISTS chk_ai_provider;

ALTER TABLE ai_requests
ADD CONSTRAINT chk_ai_provider CHECK (
  provider IN (
    'anthropic',
    'openai',
    'google',
    'cohere',
    'deepseek',
    'mistral',
    'other'
  )
);

-- Create index for category queries
CREATE INDEX IF NOT EXISTS idx_ai_requests_category
ON ai_requests(category);

-- Create composite index for cost analytics
CREATE INDEX IF NOT EXISTS idx_ai_requests_cost_analytics
ON ai_requests(user_id, created_at DESC, category);

-- Add comments
COMMENT ON COLUMN ai_requests.category IS 'Task category used for model routing (simple-query, single-tool, multi-tool, etc.)';
COMMENT ON TYPE task_category IS 'Task categories for intelligent model routing';
