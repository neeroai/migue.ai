-- Migration 003: pgvector tables (user memory, semantic search)
-- Created: 2026-01-30
-- Purpose: Semantic memory and RAG system with pgvector

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table: user_memory
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 embeddings
  memory_type TEXT NOT NULL DEFAULT 'conversation',
  importance SMALLINT DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accessed_at TIMESTAMPTZ,
  access_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  CONSTRAINT chk_memory_type CHECK (memory_type IN ('conversation', 'preference', 'fact', 'event'))
);

CREATE TRIGGER update_user_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: ai_requests (cost tracking)
CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  CONSTRAINT chk_ai_provider CHECK (provider IN ('anthropic', 'openai', 'other'))
);

-- Table: tool_executions (tool usage logs)
CREATE TABLE IF NOT EXISTS tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: messaging_windows (WhatsApp 24h windows)
CREATE TABLE IF NOT EXISTS messaging_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  window_type TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_window_type CHECK (window_type IN ('customer_service', 'entry_point', 'template'))
);

-- Table: whatsapp_flows_state (WhatsApp Flows v3)
CREATE TABLE IF NOT EXISTS whatsapp_flows_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flow_id TEXT NOT NULL,
  flow_token TEXT NOT NULL,
  screen_id TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TRIGGER update_whatsapp_flows_state_updated_at
  BEFORE UPDATE ON whatsapp_flows_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Table: dead_letter_queue (failed operations)
CREATE TABLE IF NOT EXISTS dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retried_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Comments
COMMENT ON TABLE user_memory IS 'Semantic memory with pgvector for RAG';
COMMENT ON TABLE ai_requests IS 'AI usage and cost tracking per request';
COMMENT ON TABLE tool_executions IS 'Tool execution logs for analytics';
COMMENT ON TABLE messaging_windows IS 'WhatsApp 24h messaging windows tracking';
COMMENT ON TABLE whatsapp_flows_state IS 'WhatsApp Flows v3 state management';
COMMENT ON TABLE dead_letter_queue IS 'Failed operations for retry/debugging';
