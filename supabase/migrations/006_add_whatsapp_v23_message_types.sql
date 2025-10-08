-- Migration: Add WhatsApp Cloud API v23.0 message types
-- Date: 2025-10-07
-- Author: whatsapp-api-expert
-- Issue: Users sending sticker/reaction/order messages experience silent INSERT failures
-- Root cause: PostgreSQL enum msg_type missing v23.0 types

-- IMPORTANT: PostgreSQL ALTER TYPE ... ADD VALUE cannot run in transactions
-- Run each statement separately in Supabase SQL Editor

-- =============================================================================
-- Add 'sticker' type (static and animated stickers)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'sticker'
    AND enumtypid = 'msg_type'::regtype
  ) THEN
    -- Add after 'document' to maintain logical grouping
    ALTER TYPE msg_type ADD VALUE 'sticker' AFTER 'document';
    RAISE NOTICE 'Added enum value: sticker';
  ELSE
    RAISE NOTICE 'Enum value already exists: sticker';
  END IF;
END $$;

-- =============================================================================
-- Add 'reaction' type (emoji reactions to messages - v23.0 feature)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'reaction'
    AND enumtypid = 'msg_type'::regtype
  ) THEN
    -- Add after 'button' to group with interactive features
    ALTER TYPE msg_type ADD VALUE 'reaction' AFTER 'button';
    RAISE NOTICE 'Added enum value: reaction';
  ELSE
    RAISE NOTICE 'Enum value already exists: reaction';
  END IF;
END $$;

-- =============================================================================
-- Add 'order' type (commerce/catalog orders)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'order'
    AND enumtypid = 'msg_type'::regtype
  ) THEN
    -- Add after 'reaction'
    ALTER TYPE msg_type ADD VALUE 'order' AFTER 'reaction';
    RAISE NOTICE 'Added enum value: order';
  ELSE
    RAISE NOTICE 'Enum value already exists: order';
  END IF;
END $$;

-- =============================================================================
-- Verify enum values (should include all v23.0 types)
-- =============================================================================
DO $$
DECLARE
  enum_values text;
BEGIN
  SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
  INTO enum_values
  FROM pg_enum
  WHERE enumtypid = 'msg_type'::regtype;

  RAISE NOTICE 'Current msg_type enum values: %', enum_values;
END $$;

-- Expected output:
-- text, image, audio, video, document, sticker, location,
-- interactive, button, reaction, order, contacts, system, unknown

-- =============================================================================
-- Add comment for documentation
-- =============================================================================
COMMENT ON TYPE msg_type IS
  'WhatsApp Cloud API v23.0 message types.
   Updated 2025-10-07 to include sticker, reaction, order.

   IMPORTANT: voice is NOT a valid WhatsApp type.
   Voice messages arrive as type=audio with audio.voice=true property.

   Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components';
