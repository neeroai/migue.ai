-- Migration: Fix reminder race condition with row-level locking
-- Date: 2026-02-06 21:15
-- Purpose: Prevent duplicate reminder sends when multiple cron jobs run concurrently
-- Impact: Eliminates race condition where 3+ cron executions process same reminder

-- Drop function if exists (for idempotency)
DROP FUNCTION IF EXISTS get_due_reminders_locked(timestamptz);

-- Create RPC function with FOR UPDATE SKIP LOCKED
-- This ensures multiple cron jobs get different reminders (locked rows are skipped)
CREATE OR REPLACE FUNCTION get_due_reminders_locked(now_iso timestamptz)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  description text,
  scheduled_time timestamptz,
  status text,
  send_token uuid,
  created_at timestamptz,
  phone_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.user_id,
    r.title,
    r.description,
    r.scheduled_time,
    r.status,
    r.send_token,
    r.created_at,
    u.phone_number
  FROM reminders r
  INNER JOIN users u ON r.user_id = u.id
  WHERE r.status = 'pending'
    AND r.scheduled_time <= now_iso
  ORDER BY r.scheduled_time ASC
  FOR UPDATE OF r SKIP LOCKED;
$$;

-- Grant execute to service_role (used by cron jobs)
GRANT EXECUTE ON FUNCTION get_due_reminders_locked(timestamptz) TO service_role;

-- Verify function created
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_due_reminders_locked'
  ) THEN
    RAISE NOTICE 'Function get_due_reminders_locked created successfully';
  ELSE
    RAISE EXCEPTION 'Function get_due_reminders_locked creation failed';
  END IF;
END $$;
