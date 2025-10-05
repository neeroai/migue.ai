-- AI Usage Tracking Table for cost monitoring and analytics
-- Tracks all AI provider usage (Claude, Groq, OpenAI, Tesseract)
CREATE TABLE IF NOT EXISTS ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('claude', 'groq', 'tesseract', 'openai', 'supabase')),
  task_type TEXT NOT NULL CHECK (task_type IN ('chat', 'audio_transcription', 'ocr', 'embeddings', 'image_analysis')),
  model TEXT,
  tokens_input INT,
  tokens_output INT,
  cost_usd DECIMAL(12, 8) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage_tracking(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_provider_idx ON ai_usage_tracking(provider);
CREATE INDEX IF NOT EXISTS ai_usage_task_type_idx ON ai_usage_tracking(task_type);
CREATE INDEX IF NOT EXISTS ai_usage_user_id_idx ON ai_usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS ai_usage_conversation_id_idx ON ai_usage_tracking(conversation_id);

-- Composite index for daily cost queries
CREATE INDEX IF NOT EXISTS ai_usage_date_provider_idx
ON ai_usage_tracking(DATE(created_at), provider);

-- RLS policies
ALTER TABLE ai_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Service role can manage all data
CREATE POLICY "Service role can manage all AI usage"
ON ai_usage_tracking FOR ALL
USING (auth.role() = 'service_role');

-- Users can view their own usage
CREATE POLICY "Users can view own AI usage"
ON ai_usage_tracking FOR SELECT
USING (auth.uid() = user_id);

-- Function to get daily AI costs summary
CREATE OR REPLACE FUNCTION get_daily_ai_costs(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  provider TEXT,
  task_type TEXT,
  total_requests BIGINT,
  total_cost DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ai_usage_tracking.provider,
    ai_usage_tracking.task_type,
    COUNT(*) AS total_requests,
    SUM(ai_usage_tracking.cost_usd) AS total_cost
  FROM ai_usage_tracking
  WHERE DATE(ai_usage_tracking.created_at) = target_date
  GROUP BY ai_usage_tracking.provider, ai_usage_tracking.task_type
  ORDER BY total_cost DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_daily_ai_costs(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_ai_costs(DATE) TO service_role;

-- Function to get cost trends (last 30 days)
CREATE OR REPLACE FUNCTION get_ai_cost_trends(days INT DEFAULT 30)
RETURNS TABLE (
  date DATE,
  total_cost DECIMAL,
  claude_cost DECIMAL,
  groq_cost DECIMAL,
  openai_cost DECIMAL,
  total_requests BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) AS date,
    SUM(cost_usd) AS total_cost,
    SUM(CASE WHEN provider = 'claude' THEN cost_usd ELSE 0 END) AS claude_cost,
    SUM(CASE WHEN provider = 'groq' THEN cost_usd ELSE 0 END) AS groq_cost,
    SUM(CASE WHEN provider = 'openai' THEN cost_usd ELSE 0 END) AS openai_cost,
    COUNT(*) AS total_requests
  FROM ai_usage_tracking
  WHERE created_at >= CURRENT_DATE - days
  GROUP BY DATE(created_at)
  ORDER BY DATE(created_at) DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_ai_cost_trends(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ai_cost_trends(INT) TO service_role;

-- Comments for documentation
COMMENT ON TABLE ai_usage_tracking IS 'Tracks AI API usage and costs for monitoring and budget management';
COMMENT ON COLUMN ai_usage_tracking.cost_usd IS 'Cost in USD with 8 decimal precision for micro-transactions';
COMMENT ON FUNCTION get_daily_ai_costs IS 'Returns daily cost summary by provider and task type';
COMMENT ON FUNCTION get_ai_cost_trends IS 'Returns daily cost trends for the last N days';
