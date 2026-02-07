-- ============================================================================
-- Migration: Update provider check constraint to include Gemini
-- Date: 2026-02-07
-- Purpose: Allow 'gemini' provider in openai_usage tracking
-- ============================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.openai_usage'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%provider%'
    AND pg_get_constraintdef(oid) LIKE '%openai%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.openai_usage DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.openai_usage
    ADD CONSTRAINT openai_usage_provider_check
    CHECK (provider IN ('openai', 'gemini', 'claude'));
END $$;

COMMENT ON CONSTRAINT openai_usage_provider_check ON public.openai_usage IS
  'AI provider name (openai, gemini, claude).';
