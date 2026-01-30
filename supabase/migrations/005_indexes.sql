-- Migration 005: Performance indexes
-- Created: 2026-01-30
-- Purpose: Indexes for query optimization

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_last_message ON users(last_message_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp ON conversations(whatsapp_conversation_id) WHERE whatsapp_conversation_id IS NOT NULL;

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_timestamp ON messages(conversation_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp ON messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);

-- Reminders indexes
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON reminders(scheduled_time) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled ON reminders(status, scheduled_time);

-- Calendar events indexes
CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_user_time ON calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_external ON calendar_events(user_id, provider, external_id);

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- Calendar credentials indexes
CREATE INDEX IF NOT EXISTS idx_calendar_credentials_user_provider ON calendar_credentials(user_id, provider);

-- User memory indexes (pgvector)
CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON user_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_importance ON user_memory(importance DESC);
-- HNSW index for vector similarity search (creates automatically with pgvector)
CREATE INDEX IF NOT EXISTS idx_user_memory_embedding ON user_memory USING hnsw (embedding vector_cosine_ops);

-- AI requests indexes
CREATE INDEX IF NOT EXISTS idx_ai_requests_user ON ai_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_provider ON ai_requests(provider);

-- Tool executions indexes
CREATE INDEX IF NOT EXISTS idx_tool_executions_user ON tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_tool ON tool_executions(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_executions_created ON tool_executions(created_at DESC);

-- Messaging windows indexes
CREATE INDEX IF NOT EXISTS idx_messaging_windows_user ON messaging_windows(user_id);
CREATE INDEX IF NOT EXISTS idx_messaging_windows_active ON messaging_windows(expires_at) WHERE is_active = true;

-- WhatsApp Flows state indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_user ON whatsapp_flows_state(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flows_token ON whatsapp_flows_state(flow_token);

-- Dead letter queue indexes
CREATE INDEX IF NOT EXISTS idx_dlq_operation ON dead_letter_queue(operation_type);
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved ON dead_letter_queue(created_at DESC) WHERE resolved_at IS NULL;

-- Comments
COMMENT ON INDEX idx_user_memory_embedding IS 'HNSW index for fast vector similarity search';
COMMENT ON INDEX idx_reminders_status_scheduled IS 'Composite index for cron job queries';
COMMENT ON INDEX idx_messages_conv_timestamp IS 'Composite index for conversation history queries';
