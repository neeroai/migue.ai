-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- User memory table with embeddings for semantic search
-- Stores facts, preferences, and conversation snippets with vector embeddings
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'conversation')),
  content TEXT NOT NULL,
  category TEXT,
  relevance FLOAT DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
  embedding vector(1536), -- text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast similarity search using inner product
-- Inner product is fastest when vectors are normalized
CREATE INDEX IF NOT EXISTS user_memory_embedding_idx
ON user_memory
USING hnsw (embedding vector_ip_ops);

-- B-tree indexes for filtering
CREATE INDEX IF NOT EXISTS user_memory_user_id_idx ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS user_memory_type_idx ON user_memory(type);
CREATE INDEX IF NOT EXISTS user_memory_created_at_idx ON user_memory(created_at DESC);

-- RLS policies
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

-- Users can read their own memory
CREATE POLICY "Users can read own memory"
ON user_memory FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own memory
CREATE POLICY "Users can insert own memory"
ON user_memory FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own memory
CREATE POLICY "Users can update own memory"
ON user_memory FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own memory
CREATE POLICY "Users can delete own memory"
ON user_memory FOR DELETE
USING (auth.uid() = user_id);

-- Service role can manage all memory (for agent operations)
CREATE POLICY "Service role can manage all memory"
ON user_memory FOR ALL
USING (auth.role() = 'service_role');

-- Function to search user memory by semantic similarity
CREATE OR REPLACE FUNCTION search_user_memory(
  query_embedding vector(1536),
  target_user_id UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  type TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_memory.id,
    user_memory.content,
    user_memory.category,
    user_memory.type,
    -- Convert distance to similarity (1 - distance)
    -- Using inner product operator (<#>)
    1 - (user_memory.embedding <#> query_embedding) AS similarity,
    user_memory.created_at
  FROM user_memory
  WHERE user_memory.user_id = target_user_id
    AND user_memory.embedding IS NOT NULL
    AND 1 - (user_memory.embedding <#> query_embedding) > match_threshold
  ORDER BY user_memory.embedding <#> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_user_memory(vector(1536), UUID, FLOAT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION search_user_memory(vector(1536), UUID, FLOAT, INT) TO service_role;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_memory_updated_at BEFORE UPDATE ON user_memory
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE user_memory IS 'Stores user facts, preferences, and conversation snippets with vector embeddings for semantic search';
COMMENT ON COLUMN user_memory.embedding IS 'Vector embedding (1536 dims) from text-embedding-3-small model';
COMMENT ON FUNCTION search_user_memory IS 'Semantic search function using pgvector HNSW index with inner product';
