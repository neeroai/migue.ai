# RAG Knowledge Base

Retrieval-Augmented Generation (RAG) for document analysis and semantic search in migue.ai.

## Overview

RAG enables migue.ai to answer questions based on user-uploaded documents by:
- Ingesting documents and generating embeddings
- Performing semantic search across document chunks
- Augmenting GPT-4o responses with relevant context

**Status**: 🔄 In Progress (Fase 2)

## Architecture

### Document Ingestion Flow

```
Upload Document → Supabase Storage (documents bucket)
                ↓
Extract Text (PDF/TXT/MD)
                ↓
Clean & Chunk Text (lib/rag/chunk.ts)
                ↓
Generate Embeddings (text-embedding-3-large)
                ↓
Store in public.embeddings table
                ↓
Document ready for querying
```

### Query & Retrieval Flow

```
User Question → Generate query embedding
              ↓
Semantic Search (cosine similarity)
              ↓
Retrieve top-k chunks
              ↓
Inject context into GPT-4o prompt
              ↓
Return contextual answer
```

## Implementation

### Database Schema

```sql
-- Document metadata
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  size_bytes INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Embeddings for semantic search
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  document_id UUID REFERENCES documents(id),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding JSONB NOT NULL,  -- Vector stored as JSON array
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_embeddings_user ON embeddings(user_id);
CREATE INDEX idx_embeddings_document ON embeddings(document_id);
```

### Document Ingestion

#### 1. Text Chunking (`lib/rag/chunk.ts`)

```typescript
export interface ChunkConfig {
  maxChunkSize: number;    // Default: 1500 characters
  overlap: number;         // Default: 200 characters
}

export function chunkText(
  text: string,
  config: ChunkConfig = { maxChunkSize: 1500, overlap: 200 }
): string[] {
  const normalized = normalizeText(text);
  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + config.maxChunkSize, normalized.length);
    const chunk = normalized.slice(start, end);
    chunks.push(chunk);
    start = end - config.overlap;
  }

  return chunks;
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .trim();
}
```

#### 2. Embedding Generation (`lib/rag/embeddings.ts`)

```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: 1536  // Standard dimension
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

export async function storeEmbedding(params: {
  userId: string;
  documentId: string;
  chunkText: string;
  chunkIndex: number;
  embedding: number[];
  metadata?: Record<string, any>;
}): Promise<void> {
  const supabase = getSupabaseServerClient();

  await supabase.from('embeddings').insert({
    user_id: params.userId,
    document_id: params.documentId,
    chunk_text: params.chunkText,
    chunk_index: params.chunkIndex,
    embedding: params.embedding,
    metadata: params.metadata || {}
  });
}
```

#### 3. Document Ingestion Pipeline (`lib/rag/ingest.ts`)

```typescript
export async function ingestDocument(params: {
  userId: string;
  filename: string;
  content: string;
}): Promise<{ documentId: string; chunksProcessed: number }> {
  const supabase = getSupabaseServerClient();

  // 1. Create document record
  const { data: document } = await supabase
    .from('documents')
    .insert({
      user_id: params.userId,
      filename: params.filename,
      size_bytes: params.content.length
    })
    .select()
    .single();

  // 2. Chunk text
  const chunks = chunkText(params.content);

  // 3. Generate and store embeddings
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]!);
    await storeEmbedding({
      userId: params.userId,
      documentId: document.id,
      chunkText: chunks[i]!,
      chunkIndex: i,
      embedding
    });
  }

  // 4. Mark document as processed
  await supabase
    .from('documents')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', document.id);

  return {
    documentId: document.id,
    chunksProcessed: chunks.length
  };
}
```

### Semantic Search

#### Retrieval Function (`lib/rag/search.ts`)

```typescript
export interface SearchResult {
  chunkText: string;
  similarity: number;
  metadata: Record<string, any>;
  documentId: string;
}

export async function retrieveContext(
  userId: string,
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Fetch user's embeddings
  const supabase = getSupabaseServerClient();
  const { data: embeddings } = await supabase
    .from('embeddings')
    .select('*')
    .eq('user_id', userId);

  if (!embeddings || embeddings.length === 0) {
    return [];
  }

  // 3. Calculate cosine similarity
  const results = embeddings.map(emb => ({
    chunkText: emb.chunk_text,
    similarity: cosineSimilarity(queryEmbedding, emb.embedding),
    metadata: emb.metadata,
    documentId: emb.document_id
  }));

  // 4. Sort by similarity and return top-k
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] ?? 0), 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}
```

### Integration with Response Generation

```typescript
// lib/response.ts
export async function generateResponse(params: {
  userId: string;
  userMessage: string;
  intent: string;
}): Promise<string> {
  let systemPrompt = BASE_SYSTEM_PROMPT;

  // Inject RAG context for document analysis
  if (params.intent === 'analyze_document') {
    const context = await retrieveContext(params.userId, params.userMessage);

    if (context.length > 0) {
      const contextText = context
        .map((c, i) => `[${i + 1}] ${c.chunkText}`)
        .join('\n\n');

      systemPrompt += `\n\n## Relevant Context:\n${contextText}`;
    }
  }

  // Generate response with context
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: params.userMessage }
    ]
  });

  return response.choices[0]!.message.content;
}
```

## Configuration

### Environment Variables
```bash
OPENAI_API_KEY=your_openai_key
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_service_role_key
```

### Limits
```typescript
const RAG_CONFIG = {
  maxDocumentSize: 10 * 1024 * 1024,  // 10 MB
  chunkSize: 1500,                     // characters
  chunkOverlap: 200,                   // characters
  embeddingDimensions: 1536,
  topKResults: 5,                      // chunks to retrieve
  similarityThreshold: 0.7             // minimum similarity score
};
```

## Testing

```bash
# Run RAG tests
npm run test -- rag

# Specific tests
npx jest tests/unit/rag-chunk.test.ts --watchman=false
npx jest tests/unit/rag-ingest.test.ts --watchman=false
npx jest tests/unit/rag-search.test.ts --watchman=false
```

### Test Coverage
- Text chunking with various sizes
- Embedding generation and storage
- Semantic search ranking
- Integration with response generation
- Error handling (no embeddings, API failures)

## Future Enhancements

### PDF Support (Fase 3)
```typescript
// Use Supabase Edge Functions or pdf-parse
const text = await extractTextFromPDF(pdfBuffer);
await ingestDocument({ userId, filename, content: text });
```

### Document Expiration
```typescript
// Add TTL to documents
ALTER TABLE documents ADD COLUMN expires_at TIMESTAMPTZ;

// Cleanup cron job
DELETE FROM embeddings WHERE document_id IN (
  SELECT id FROM documents WHERE expires_at < NOW()
);
```

### Advanced Filtering
```typescript
// Filter by document, date range, metadata
const context = await retrieveContext(userId, query, {
  documentIds: ['doc1', 'doc2'],
  minDate: '2025-01-01',
  metadata: { category: 'technical' }
});
```

### Vector Database (Future)
Migrate to pgvector for improved performance:
```sql
CREATE EXTENSION vector;
ALTER TABLE embeddings ADD COLUMN embedding_vec vector(1536);
CREATE INDEX ON embeddings USING ivfflat (embedding_vec vector_cosine_ops);
```

## Performance Considerations

- **Embedding Cost**: ~$0.13 per 1M tokens (text-embedding-3-large)
- **Storage**: ~6KB per chunk (1.5k chars + embedding)
- **Search Latency**: <100ms for 1000 chunks (client-side cosine)
- **Optimization**: Batch embed multiple chunks to reduce API calls

## Error Handling

### No Embeddings Found
```typescript
if (context.length === 0) {
  // Fallback to standard response
  return generateResponse({ userId, userMessage, intent: 'general' });
}
```

### Embedding API Failure
```typescript
try {
  const embedding = await generateEmbedding(text);
} catch (error) {
  await logError('embedding_generation_failed', error);
  // Skip this chunk or retry
}
```

## Related Documentation

- [Audio Transcription](./audio-transcription.md)
- [Streaming Responses](./streaming-responses.md)
- Database schema: [SUPABASE.md](../SUPABASE.md)
- OpenAI integration: [API Reference](../03-api-reference/openai-integration.md)

---

**Status**: 🔄 In Progress (Fase 2)
**Target**: October 10, 2025
**Implementation**: `lib/rag/`
