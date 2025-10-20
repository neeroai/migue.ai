-- OpenAI Usage Tracking (2025-10-17)
-- Tracks real token usage and costs for OpenAI API calls
-- Enables accurate budget monitoring and analytics

-- Create openai_usage table
CREATE TABLE IF NOT EXISTS openai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Model and timing
  model TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Token usage
  prompt_tokens INTEGER NOT NULL CHECK (prompt_tokens >= 0),
  completion_tokens INTEGER NOT NULL CHECK (completion_tokens >= 0),
  total_tokens INTEGER NOT NULL CHECK (total_tokens >= 0),

  -- Coherence constraint: total must equal sum of parts
  CONSTRAINT coherent_token_totals CHECK (total_tokens = prompt_tokens + completion_tokens),

  -- Cost breakdown (USD)
  input_cost DECIMAL(12, 8) NOT NULL CHECK (input_cost >= 0),
  output_cost DECIMAL(12, 8) NOT NULL CHECK (output_cost >= 0),
  total_cost DECIMAL(12, 8) NOT NULL CHECK (total_cost >= 0),

  -- Coherence constraint: total cost must equal sum of parts
  CONSTRAINT coherent_cost_totals CHECK (total_cost = input_cost + output_cost),

  -- Context (optional)
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  message_id TEXT,

  -- Indexes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_openai_usage_timestamp ON openai_usage(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_openai_usage_user_id ON openai_usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_openai_usage_conversation_id ON openai_usage(conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_openai_usage_model ON openai_usage(model);
-- Note: created_at index removed (redundant with timestamp index)

-- Add generated column for UTC date (IMMUTABLE for indexing)
-- Using DO block for idempotency (PostgreSQL doesn't support IF NOT EXISTS for generated columns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'openai_usage'
      AND column_name = 'usage_date_utc'
  ) THEN
    ALTER TABLE openai_usage
    ADD COLUMN usage_date_utc date
    GENERATED ALWAYS AS ((timestamp AT TIME ZONE 'UTC')::date) STORED;
  END IF;
END $$;

-- Composite index for user daily reports (using generated IMMUTABLE column)
CREATE INDEX IF NOT EXISTS idx_openai_usage_user_date_utc
  ON openai_usage(user_id, usage_date_utc)
  WHERE user_id IS NOT NULL;

-- RLS: Service role bypass (same pattern as other tables)
ALTER TABLE openai_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (idempotent with DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'openai_usage'
      AND policyname = 'Service role can manage openai_usage'
  ) THEN
    CREATE POLICY "Service role can manage openai_usage"
      ON openai_usage
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE openai_usage IS 'Tracks real OpenAI API token usage and costs for budget monitoring';
COMMENT ON COLUMN openai_usage.model IS 'OpenAI model name (e.g., gpt-4o-mini)';
COMMENT ON COLUMN openai_usage.prompt_tokens IS 'Input tokens (prompt + conversation history)';
COMMENT ON COLUMN openai_usage.completion_tokens IS 'Output tokens (model response)';
COMMENT ON COLUMN openai_usage.total_tokens IS 'Total tokens (prompt + completion)';
COMMENT ON COLUMN openai_usage.input_cost IS 'Cost of input tokens in USD';
COMMENT ON COLUMN openai_usage.output_cost IS 'Cost of output tokens in USD';
COMMENT ON COLUMN openai_usage.total_cost IS 'Total cost in USD';
COMMENT ON COLUMN openai_usage.conversation_id IS 'Associated conversation (nullable)';
COMMENT ON COLUMN openai_usage.user_id IS 'Associated user (nullable)';
COMMENT ON COLUMN openai_usage.message_id IS 'WhatsApp message ID (nullable)';
