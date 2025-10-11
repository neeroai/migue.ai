# pgvector Semantic Search

Complete guide to semantic search implementation using pgvector extension with HNSW indexing.

## Overview

**pgvector** enables fast similarity search over high-dimensional vector embeddings stored directly in PostgreSQL.

**migue.ai Implementation:**
- **Table**: `user_memory`
- **Dimensions**: 1536 (text-embedding-3-small)
- **Index**: HNSW with inner product distance
- **Use Case**: User facts, preferences, conversation history semantic search

## Extension Setup

### Enable pgvector

```sql
-- supabase/migrations/003_user_memory_embeddings.sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Version**: pgvector 0.5.0 (Supabase managed)

### Verify Installation

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## user_memory Table

### Schema

```sql
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('fact', 'preference', 'conversation')),
  content TEXT NOT NULL,
  category TEXT,
  relevance FLOAT DEFAULT 0.5 CHECK (relevance >= 0 AND relevance <= 1),
  embedding VECTOR(1536),  -- text-embedding-3-small dimension
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Field Details

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (CASCADE delete) |
| `type` | TEXT | Memory type: fact, preference, conversation |
| `content` | TEXT | Human-readable text |
| `category` | TEXT | Optional grouping (e.g., "work", "personal") |
| `relevance` | FLOAT | Importance score 0.0-1.0 |
| `embedding` | VECTOR(1536) | OpenAI text-embedding-3-small vector |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update (auto-trigger) |

## HNSW Index

### Index Creation

```sql
-- Inner product distance (fastest for normalized vectors)
CREATE INDEX user_memory_embedding_idx
ON user_memory
USING hnsw (embedding vector_ip_ops);
```

### Index Configuration

**Algorithm**: HNSW (Hierarchical Navigable Small World)
- **Distance operator**: `<#>` (inner product)
- **Build time**: ~500ms for 10K vectors
- **Query time**: <10ms for top-10 results

**Why inner product?**
- Assumes normalized vectors (OpenAI embeddings are pre-normalized)
- Faster than L2 distance (`<->`) or cosine distance (`<=>`)
- Mathematically equivalent to cosine similarity for unit vectors

### Supporting Indexes

```sql
-- B-tree indexes for filtering
CREATE INDEX user_memory_user_id_idx ON user_memory(user_id);
CREATE INDEX user_memory_type_idx ON user_memory(type);
CREATE INDEX user_memory_created_at_idx ON user_memory(created_at DESC);
```

**Query Pattern**: Filter by user_id, then vector search within user's memories.

## Distance Operators

### Available Operators

| Operator | Distance Type | Use Case |
|----------|---------------|----------|
| `<->` | L2 (Euclidean) | General similarity |
| `<#>` | Inner product | Normalized vectors (fastest) |
| `<=>` | Cosine distance | Angle-based similarity |

### Distance to Similarity Conversion

```sql
-- Inner product: smaller = more similar (range: -1 to 1)
-- Convert to similarity score (0 to 1):
SELECT 1 - (embedding <#> query_vector) AS similarity
FROM user_memory
WHERE similarity > 0.3  -- Threshold
ORDER BY embedding <#> query_vector ASC
LIMIT 10;
```

## Search Function

### Implementation

```sql
-- supabase/migrations/003_user_memory_embeddings.sql
CREATE OR REPLACE FUNCTION search_user_memory(
  query_embedding VECTOR(1536),
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
```

### Function Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query_embedding` | VECTOR(1536) | - | Search vector |
| `target_user_id` | UUID | - | User to search |
| `match_threshold` | FLOAT | 0.3 | Min similarity (0.0-1.0) |
| `match_count` | INT | 10 | Max results |

### Return Columns

- `id` - Memory UUID
- `content` - Original text
- `category` - Optional grouping
- `type` - Memory type (fact/preference/conversation)
- `similarity` - Score 0.0-1.0 (higher = more similar)
- `created_at` - Timestamp

## TypeScript Integration

### Embedding Generation

```typescript
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  })
  return response.data[0]!.embedding
}
```

### Storing Memory with Embedding

```typescript
import { getSupabaseServerClient } from '@/lib/supabase'

async function storeUserMemory(
  userId: string,
  content: string,
  type: 'fact' | 'preference' | 'conversation',
  category?: string
): Promise<void> {
  const embedding = await generateEmbedding(content)

  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('user_memory').insert({
    user_id: userId,
    type,
    content,
    category,
    embedding: JSON.stringify(embedding),  // pgvector accepts array as string
  })

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`)
  }
}
```

### Semantic Search Query

```typescript
async function searchUserMemory(
  userId: string,
  query: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<Array<{
  id: string
  content: string
  category: string | null
  type: string
  similarity: number
  created_at: string
}>> {
  const queryEmbedding = await generateEmbedding(query)

  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase.rpc('search_user_memory', {
    query_embedding: JSON.stringify(queryEmbedding),
    target_user_id: userId,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) {
    throw new Error(`Search failed: ${error.message}`)
  }

  return data ?? []
}
```

### Usage Example

```typescript
// Store user facts
await storeUserMemory(
  userId,
  'Usuario prefiere reuniones virtuales los lunes por la mañana',
  'preference',
  'work'
)

// Search for relevant memories
const memories = await searchUserMemory(
  userId,
  'cuándo quiere reuniones virtuales?',
  0.3,
  5
)

console.log(memories[0])
// {
//   id: '...',
//   content: 'Usuario prefiere reuniones virtuales los lunes por la mañana',
//   similarity: 0.87,
//   type: 'preference',
//   category: 'work'
// }
```

## Performance Optimization

### Index Build Time

**HNSW index creation** (user_memory table):
- 1K vectors: ~50ms
- 10K vectors: ~500ms
- 100K vectors: ~5s

**Note**: Indexes built asynchronously. Use `REINDEX` to rebuild if needed.

### Query Performance

**Typical query** (user with 1K memories):
- Without index: 200-500ms (sequential scan)
- With HNSW index: 5-15ms (index scan)

**Improvement**: 20-100x faster

### Memory Usage

**HNSW index size**:
- 1K vectors (1536 dims): ~6MB
- 10K vectors: ~60MB
- 100K vectors: ~600MB

**Formula**: ~6KB per vector

## RLS Policies

### User Access Control

```sql
-- Users can read their own memory
CREATE POLICY "Users can read own memory"
ON user_memory FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own memory
CREATE POLICY "Users can insert own memory"
ON user_memory FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all memory (for agent operations)
CREATE POLICY "Service role can manage all memory"
ON user_memory FOR ALL
USING (auth.role() = 'service_role');
```

**Note**: migue.ai uses service role for all operations (no Supabase Auth).

## Common Patterns

### Find Similar Memories

```sql
-- Direct SQL query
SELECT content, 1 - (embedding <#> '[0.1, 0.2, ...]'::VECTOR(1536)) AS similarity
FROM user_memory
WHERE user_id = '...'
  AND 1 - (embedding <#> '[0.1, 0.2, ...]'::VECTOR(1536)) > 0.3
ORDER BY embedding <#> '[0.1, 0.2, ...]'::VECTOR(1536) ASC
LIMIT 10;
```

### Filter by Type and Search

```typescript
// TypeScript with type filter
const { data } = await supabase.rpc('search_user_memory', {
  query_embedding: JSON.stringify(embedding),
  target_user_id: userId,
  match_threshold: 0.3,
  match_count: 10,
})

// Post-filter by type (more efficient to add to RPC function)
const preferences = data?.filter(m => m.type === 'preference') ?? []
```

### Update Existing Memory

```typescript
// Update content and regenerate embedding
const newContent = 'Updated preference text'
const newEmbedding = await generateEmbedding(newContent)

await supabase.from('user_memory')
  .update({
    content: newContent,
    embedding: JSON.stringify(newEmbedding),
    updated_at: new Date().toISOString(),
  })
  .eq('id', memoryId)
```

## Troubleshooting

### Error: dimension mismatch

```
ERROR: expected 1536 dimensions, not 768
```

**Cause**: Using wrong embedding model (e.g., text-embedding-ada-002 = 1536, text-embedding-3-large = 3072)

**Fix**: Use text-embedding-3-small with dimensions=1536

### Poor Search Results

**Issue**: Similarity scores too low (< 0.2)

**Solutions**:
1. Lower `match_threshold` (try 0.1)
2. Verify embeddings generated from same model
3. Check query text preprocessing (lowercase, remove special chars)
4. Increase `match_count` to see more results

### Slow Queries

**Issue**: Queries taking > 100ms

**Solutions**:
1. Verify HNSW index exists: `\d+ user_memory`
2. Run `ANALYZE user_memory;` to update statistics
3. Check query plan: `EXPLAIN ANALYZE SELECT ...`
4. Rebuild index: `REINDEX INDEX user_memory_embedding_idx;`

## Advanced: Custom Distance Functions

### Weighted Search

```sql
CREATE OR REPLACE FUNCTION weighted_memory_search(
  query_embedding VECTOR(1536),
  target_user_id UUID,
  recency_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  weighted_score FLOAT
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_memory.id,
    user_memory.content,
    -- Combine similarity + recency
    (1 - (user_memory.embedding <#> query_embedding)) * (1 - recency_weight) +
    (EXTRACT(EPOCH FROM (NOW() - user_memory.created_at)) / 86400.0)::FLOAT * recency_weight
    AS weighted_score
  FROM user_memory
  WHERE user_memory.user_id = target_user_id
  ORDER BY weighted_score DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
```

## Next Steps

- **[RLS Security](./04-rls-security.md)** - Secure vector search
- **[Custom Functions](./05-custom-functions-triggers.md)** - Advanced search functions
- **[Monitoring](./11-monitoring-performance.md)** - Query performance analysis

## Resources

- **Official**: [pgvector Documentation](https://github.com/pgvector/pgvector)
- **Official**: [Supabase Vector Guide](https://supabase.com/docs/guides/ai/vector-columns)
- **OpenAI**: [Embeddings API](https://platform.openai.com/docs/guides/embeddings)

**Last Updated**: 2025-10-11
