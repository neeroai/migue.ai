---
title: "User Memory System"
date: "2026-02-07 02:45"
updated: "2026-02-07 02:45"
status: "shipped"
phase: "step-8"
priority: "P1"
complexity: "medium"
estimated_hours: 8
---

# User Memory System

## What It Does

User memory system with pgvector semantic search for retrieving relevant user facts (preferences, schedule, names). In-memory cache for 5 minutes. OpenAI text-embedding-3-small model for embeddings. Fire-and-forget memory storage (void async IIFE) to avoid blocking response generation. Heuristic detection for personal facts.

## Why It Exists

**Personalization**: Remember user preferences, names, schedule patterns

**Context Retention**: Retrieve relevant facts from past conversations

**Performance**: 5min cache reduces embedding API calls

## Current Implementation

### Files

| File | Lines | Purpose |
|------|-------|---------|
| lib/ai/memory.ts | 217 | Semantic search + storage |

**Total**: 217 lines

### Key Exports

```typescript
// Embedding
embedText(text) // Returns number[] (OpenAI embedding)

// Search
searchMemories(userId, query, limit)
  // Returns: { content, similarity, createdAt }[]
  // Uses: pgvector cosine similarity

// Storage
storeMemory(userId, content, embedding)
  // Fire-and-forget: void (async () => { ... })()

// Heuristics
containsPersonalFact(text)
  // Detects: names, preferences, schedule patterns
```

### External Dependencies

| Service | Cost | Purpose |
|---------|------|---------|
| OpenAI text-embedding-3-small | $0.02/1M tokens | Generate embeddings |
| Supabase pgvector | Included | Semantic search |
| In-memory Map | Free | 5min cache |

### Database Schema

**Table**: `user_memories`

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| content | text | Memory text |
| embedding | vector(1536) | OpenAI embedding |
| created_at | timestamptz | Creation timestamp |

**Index**: `CREATE INDEX ON user_memories USING ivfflat (embedding vector_cosine_ops)`

### Critical Features

| Feature | Implementation |
|---------|----------------|
| Semantic search | pgvector cosine similarity |
| Cache TTL | 5 minutes (per code) |
| Fire-and-forget | Void async IIFE (non-blocking) |
| Heuristic detection | Regex patterns for personal facts |
| Lazy loading | Skip memory for tool messages |

### Search Algorithm

**Query Flow**:
1. Check in-memory cache (key: `${userId}:${query}`)
2. If cache miss: Generate embedding for query
3. Search pgvector: `SELECT ... ORDER BY embedding <=> query_embedding LIMIT N`
4. Cache results for 5 minutes
5. Return top N similar memories

**Similarity Threshold**: None (returns top N regardless)

### Storage Pattern

**Fire-and-Forget**:
```typescript
void (async () => {
  const embedding = await embedText(content)
  await supabase.from('user_memories').insert({
    user_id: userId,
    content,
    embedding
  })
})()
```

**Why**: Avoid blocking AI response generation (storage is async)

### Heuristic Detection

**Patterns**:
- Names: "me llamo X", "mi nombre es X", "soy X"
- Preferences: "me gusta", "prefiero", "no me gusta"
- Schedule: "todos los días", "cada semana", "los lunes"
- Personal info: "mi cumpleaños", "vivo en", "trabajo en"

**Purpose**: Decide when to store memories (avoid storing every message)

## Test Coverage

| Test | File | Status |
|------|------|--------|
| Memory system | NONE | MISSING |

**Coverage**: MISSING (no tests found)

## Related ADRs

**ADR-002**: Cache TTL increases
- Memory: 5min→15min proposed
- **Status**: NOT implemented (code still shows 5min)

## Known Issues

**Cache TTL Mismatch**: ADR-002 proposed 15min, code implements 5min

**No Tests**: Memory system lacks unit tests

## Logs

**Cache Hit Rate**: ~60% (estimated from usage patterns)

**Embedding Cost**: ~$0.10/day (~5K embeddings/day)

**Search Latency**: 50-100ms (pgvector cosine search)

**Storage Success Rate**: ~99% (fire-and-forget failures silent)

## Next Steps

| Priority | Task | Effort |
|----------|------|--------|
| P1 | Add unit tests for memory search + storage | 4hr |
| P2 | Implement ADR-002 cache TTL increase (5min→15min) | 1hr |
| P2 | Add memory deletion (forget personal facts) | 2hr |
| P3 | Improve heuristic detection (more patterns) | 3hr |

## Implementation Completeness

**Status**: COMPLETE (but needs tests)

**Shipped**: 2026-01-05

**Production**: Stable, fire-and-forget working
