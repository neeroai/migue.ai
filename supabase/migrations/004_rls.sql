-- Migration 004: Row Level Security (RLS) policies
-- Created: 2026-01-30
-- Purpose: Security policies for all user-facing tables

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_flows_state ENABLE ROW LEVEL SECURITY;

-- Service role has full access to all tables
CREATE POLICY "Service role full access users" ON users
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access conversations" ON conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access messages" ON messages
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access reminders" ON reminders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access calendar_events" ON calendar_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access expenses" ON expenses
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access calendar_credentials" ON calendar_credentials
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access user_memory" ON user_memory
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access ai_requests" ON ai_requests
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access tool_executions" ON tool_executions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access messaging_windows" ON messaging_windows
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access whatsapp_flows_state" ON whatsapp_flows_state
  FOR ALL USING (auth.role() = 'service_role');

-- No RLS on operational tables (service-only access)
-- dead_letter_queue - No RLS, service role only

-- Comments
COMMENT ON POLICY "Service role full access users" ON users IS 'Service role can manage all users';
COMMENT ON POLICY "Service role full access conversations" ON conversations IS 'Service role can manage all conversations';
COMMENT ON POLICY "Service role full access messages" ON messages IS 'Service role can manage all messages';
