-- Migration: Fix wa_message_id column length
-- Date: 2026-02-06 02:10
-- Issue: Production error - wa_message_id VARCHAR(64) too short for actual WhatsApp message IDs
-- Evidence: wamid.HBgMNTczMDAyMzUyMjI1FQIAEhgWM0VCMDY0NUM3MjBERTJFNTFDNjE4NQA= (68 chars)
-- Solution: Increase to VARCHAR(255) to accommodate base64-encoded message IDs with growth margin

-- Increase wa_message_id column length from VARCHAR(64) to VARCHAR(255)
ALTER TABLE public.messages_v2
  ALTER COLUMN wa_message_id TYPE VARCHAR(255);

-- Verify the change
COMMENT ON COLUMN public.messages_v2.wa_message_id IS
  'WhatsApp message ID (wamid format). Increased from VARCHAR(64) to VARCHAR(255) on 2026-02-06 to fix production truncation errors.';

-- Add index on wa_message_id if it doesn't exist (for duplicate detection)
CREATE INDEX IF NOT EXISTS idx_messages_v2_wa_message_id
  ON public.messages_v2(wa_message_id)
  WHERE wa_message_id IS NOT NULL;
