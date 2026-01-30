---
title: "Memory and RAG System"
summary: "Three-tier memory (short/long/semantic) with pgvector embeddings and preference extraction"
description: "Memory tier comparison, RAG pipeline stages, preference extraction rules, embedding strategy, and user memory management for contextual conversations"
version: "1.0"
date: "2026-01-29"
updated: "2026-01-29"
scope: "Architecture"
---

# Memory and RAG System

## Memory Tier Comparison

| Tier | Storage | Retention | Query Time | Cost | Use Case |
|------|---------|-----------|------------|------|----------|
| Short-term | Redis/Edge cache | 30 minutes | <10ms | Low | Active conversation context |
| Long-term | Supabase messages table | 90 days | 50-100ms | Medium | Conversation history |
| Semantic | Supabase user_memory + pgvector | Indefinite | 100-300ms | High | Preferences, facts, patterns |

**Query strategy**:
1. Short-term: Check active session cache (last 10 messages)
2. Long-term: Query recent conversation history (last 7 days)
3. Semantic: RAG search for relevant memories (all time)

**Refresh rules**:
- Short-term: On every message (sliding window)
- Long-term: On cache miss (lazy load)
- Semantic: On memory creation/update + background sync

---

## RAG Pipeline Stages

| Stage | Input | Process | Output | Latency | Cost |
|-------|-------|---------|--------|---------|------|
| Extraction | User message | NLP entity extraction | Entities, intents | 50ms | Low |
| Embedding | Query text | OpenAI text-embedding-3-small | 1536-dim vector | 200ms | $0.0001 |
| Search | Query vector | pgvector similarity (<=> operator) | Top 5 memories | 100ms | Low |
| Reranking | Search results | Relevance scoring by recency+context | Top 3 memories | 50ms | Low |
| Injection | Memories + current context | Prompt construction | Enhanced context | 20ms | Low |
| Generation | Enhanced prompt | Claude/GPT inference | Response | 2-5s | High |

**Total latency**: ~2.5-5.5s (embedding + search + generation)

**Pipeline implementation**:
```typescript
async function ragPipeline(
  query: string,
  userId: string,
  context: Message[]
): Promise<string> {
  // Stage 1: Extract entities
  const entities = extractEntities(query);

  // Stage 2: Generate embedding
  const queryEmbedding = await generateEmbedding(query);

  // Stage 3: Semantic search
  const memories = await searchMemories(userId, queryEmbedding, limit: 5);

  // Stage 4: Rerank by relevance
  const topMemories = rerankByRecency(memories, context);

  // Stage 5: Inject into prompt
  const enhancedContext = buildPrompt(query, context, topMemories);

  // Stage 6: Generate response
  return await generateResponse(enhancedContext);
}
```

---

## Preference Extraction Rules

| Source Pattern | Extracted Field | Confidence | Example |
|----------------|-----------------|------------|---------|
| "I prefer X" | preference.value | 0.95 | "I prefer morning meetings" → preference: "morning meetings" |
| "I always X" | habit.value | 0.90 | "I always order coffee" → habit: "orders coffee" |
| "My name is X" | profile.name | 1.0 | "My name is Juan" → name: "Juan" |
| "I'm allergic to X" | restriction.food | 0.95 | "I'm allergic to peanuts" → allergy: "peanuts" |
| "I don't like X" | preference.negative | 0.85 | "I don't like spicy food" → dislike: "spicy food" |
| "I work at X" | profile.company | 0.90 | "I work at Google" → company: "Google" |
| "I live in X" | profile.location | 0.90 | "I live in Bogotá" → location: "Bogotá" |
| "Remind me about X" | task.reminder | 1.0 | "Remind me about dentist" → reminder: "dentist" |
| "I speak X" | profile.language | 0.95 | "I speak Spanish" → language: "Spanish" |
| "I'm usually free X" | availability.pattern | 0.85 | "I'm usually free afternoons" → free_time: "afternoons" |

**Extraction logic**:
```typescript
async function extractPreferences(
  message: string,
  userId: string
): Promise<Memory[]> {
  const patterns = PREFERENCE_PATTERNS;
  const extracted: Memory[] = [];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(message);
    if (match && pattern.confidence > 0.8) {
      extracted.push({
        user_id: userId,
        content: match.groups.value,
        memory_type: pattern.type,
        confidence: pattern.confidence,
        source_message: message
      });
    }
  }

  // Store with embeddings
  await storeMemories(extracted);
  return extracted;
}
```

---

## Embedding Strategy Matrix

| Model | Dimensions | Cost per 1M tokens | Batch Size | Latency | Use Case |
|-------|------------|-------------------|------------|---------|----------|
| text-embedding-3-small | 1536 | $0.020 | 100 | 200ms | Default (balanced) |
| text-embedding-3-large | 3072 | $0.130 | 50 | 400ms | High precision (disabled) |
| text-embedding-ada-002 | 1536 | $0.100 | 100 | 250ms | Legacy (deprecated) |

**Selection**: text-embedding-3-small (5x cheaper than ada-002, same quality)

**Batch processing**:
- Batch size: 100 texts per API call
- Max text length: 8191 tokens (truncate longer)
- Retry on failure: 2 attempts with exponential backoff
- Cache embeddings: 30-day TTL in Supabase

**Embedding generation**:
```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8191), // Truncate to max length
    dimensions: 1536
  });

  return response.data[0].embedding;
}
```

---

## User Memory Schema (Supabase)

```sql
-- Main memory table with pgvector
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  content TEXT NOT NULL,
  memory_type TEXT NOT NULL, -- 'preference', 'fact', 'habit', 'restriction'
  embedding vector(1536),    -- pgvector for semantic search
  confidence NUMERIC(3,2),   -- 0.00 to 1.00
  source_message TEXT,       -- Original message that created memory
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,    -- Optional expiry for temporary memories
  metadata JSONB             -- Additional structured data
);

-- Indexes for performance
CREATE INDEX idx_memory_user ON user_memory(user_id, created_at DESC);
CREATE INDEX idx_memory_type ON user_memory(memory_type);
CREATE INDEX idx_memory_embedding ON user_memory
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_memory_content_fts ON user_memory
  USING gin(to_tsvector('english', content));

-- Automatic updated_at trigger
CREATE TRIGGER update_memory_updated_at
  BEFORE UPDATE ON user_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## Memory Manager Implementation

```typescript
class MemoryManager {
  // Store new memory with embedding
  async storeMemory(data: {
    userId: string;
    content: string;
    memoryType: string;
    confidence: number;
    sourceMessage: string;
  }): Promise<string> {
    const embedding = await generateEmbedding(data.content);

    const { data: memory, error } = await supabase
      .from('user_memory')
      .insert({
        user_id: data.userId,
        content: data.content,
        memory_type: data.memoryType,
        embedding: embedding,
        confidence: data.confidence,
        source_message: data.sourceMessage
      })
      .select()
      .single();

    if (error) throw error;
    return memory.id;
  }

  // Semantic search with pgvector
  async searchMemories(
    userId: string,
    queryEmbedding: number[],
    limit: number = 5
  ): Promise<Memory[]> {
    const { data, error } = await supabase.rpc('search_memories', {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_threshold: 0.7,  // Cosine similarity threshold
      match_count: limit
    });

    if (error) throw error;
    return data;
  }

  // Get preferences by type
  async getPreferences(
    userId: string,
    type?: string
  ): Promise<Memory[]> {
    let query = supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .order('confidence', { ascending: false });

    if (type) {
      query = query.eq('memory_type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}
```

---

## RAG Search Function (Supabase)

```sql
-- Semantic similarity search with pgvector
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  confidence NUMERIC,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    user_memory.id,
    user_memory.content,
    user_memory.memory_type,
    user_memory.confidence,
    1 - (user_memory.embedding <=> query_embedding) AS similarity,
    user_memory.created_at
  FROM user_memory
  WHERE user_memory.user_id = match_user_id
    AND 1 - (user_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY user_memory.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## Memory Lifecycle

| Event | Action | Trigger | Frequency |
|-------|--------|---------|-----------|
| Message received | Extract preferences | Every user message | Real-time |
| Preference detected | Generate embedding + store | High confidence match | Real-time |
| Conversation end | Summarize and store facts | 30 min inactivity | Batch |
| Daily | Decay old memories | Reduce confidence over time | 1x/day |
| Weekly | Archive cold memories | Move to cold storage | 1x/week |
| Monthly | Purge expired | Delete expired_at < NOW() | 1x/month |

**Confidence decay**: `new_confidence = old_confidence * 0.98^days_elapsed`

---

## Context Assembly

**Priority order for prompt context**:
1. Current message (always included)
2. Active session (last 10 messages, short-term memory)
3. Semantic memories (top 3 from RAG search, high relevance)
4. Recent history (last 24h, up to 20 messages)
5. User preferences (top 5, highest confidence)

**Token budget**:
- Current message: ~100 tokens
- Session context: ~1,000 tokens
- Semantic memories: ~500 tokens
- Recent history: ~1,500 tokens
- Preferences: ~300 tokens
- System prompt: ~500 tokens
- **Total context**: ~4,000 tokens (leaves room for response)

---

## Citations

- **molbot memory/**: Memory system architecture analysis
- **Archived lib/rag/**: RAG implementation patterns
- **PRD Section 6**: user_memory table schema
- **docs-global/platforms/supabase/03-pgvector-semantic-search.md**: pgvector setup

---

**Lines**: 247 | **Tokens**: ~741
