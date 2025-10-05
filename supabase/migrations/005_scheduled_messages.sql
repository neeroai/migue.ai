-- Scheduled Messages Table for WhatsApp message scheduling
-- Allows agents to schedule messages for future delivery
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata JSONB,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for scheduled message queries
CREATE INDEX IF NOT EXISTS scheduled_messages_scheduled_at_idx
ON scheduled_messages(scheduled_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS scheduled_messages_status_idx
ON scheduled_messages(status);

CREATE INDEX IF NOT EXISTS scheduled_messages_user_id_idx
ON scheduled_messages(user_id);

CREATE INDEX IF NOT EXISTS scheduled_messages_phone_number_idx
ON scheduled_messages(phone_number);

-- RLS policies
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- Service role can manage all scheduled messages
CREATE POLICY "Service role can manage all scheduled messages"
ON scheduled_messages FOR ALL
USING (auth.role() = 'service_role');

-- Users can manage their own scheduled messages
CREATE POLICY "Users can manage own scheduled messages"
ON scheduled_messages FOR ALL
USING (auth.uid() = user_id);

-- Function to get pending scheduled messages
CREATE OR REPLACE FUNCTION get_pending_scheduled_messages(before_time TIMESTAMPTZ DEFAULT now())
RETURNS SETOF scheduled_messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM scheduled_messages
  WHERE status = 'pending'
    AND scheduled_at <= before_time
  ORDER BY scheduled_at ASC
  LIMIT 100;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_scheduled_messages(TIMESTAMPTZ) TO service_role;

-- Function to mark message as sent
CREATE OR REPLACE FUNCTION mark_message_sent(message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scheduled_messages
  SET
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE id = message_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_message_sent(UUID) TO service_role;

-- Function to mark message as failed
CREATE OR REPLACE FUNCTION mark_message_failed(message_id UUID, error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE scheduled_messages
  SET
    status = 'failed',
    error_message = error,
    updated_at = now()
  WHERE id = message_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION mark_message_failed(UUID, TEXT) TO service_role;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_scheduled_messages_updated_at
BEFORE UPDATE ON scheduled_messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE scheduled_messages IS 'Stores WhatsApp messages scheduled for future delivery by AI agents';
COMMENT ON COLUMN scheduled_messages.scheduled_at IS 'Timestamp when message should be sent';
COMMENT ON FUNCTION get_pending_scheduled_messages IS 'Returns pending messages that should be sent now or before specified time';
COMMENT ON FUNCTION mark_message_sent IS 'Marks a scheduled message as successfully sent';
COMMENT ON FUNCTION mark_message_failed IS 'Marks a scheduled message as failed with error message';
