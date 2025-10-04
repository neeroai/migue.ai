# RAG Implementation Plan

## Context
Users send PDFs and documents expecting factual answers. We currently store document metadata but lack ingestion into embeddings and retrieval for the `analyze_document` intent. Supabase has `documents` and `embeddings` tables defined; Edge runtime must orchestrate chunking, embedding creation, and semantic search.

## Requirements
- Upload documents to Supabase Storage (`documents` bucket).
- Extract text server-side (Edge-compatible) and split into manageable chunks.
- Generate embeddings with OpenAI (`text-embedding-3-large`) and store them in `public.embeddings` (jsonb vector placeholder for now).
- Expose retrieval helper returning top-k chunks with metadata and distances.
- Integrate with response generation so `analyze_document` pulls context before calling GPT-4o.
- Tests covering chunking, storage interactions, and retrieval scoring logic.

## Options Considered
1. **On-demand embedding at query time**
   - Pros: Simpler pipeline, no storage of embeddings.
   - Cons: Slow responses, repeated cost, fails for large documents.
2. **Background ingestion queue (Supabase Functions)**
   - Pros: Decouples ingestion, handles large files.
   - Cons: Adds new infrastructure, slower MVP.
3. **Edge inline ingestion triggered at upload**
   - Pros: Controlled, minimal infra, reuses existing Edge functions.
   - Cons: Must ensure processing stays within resource limits; may need chunk-by-chunk streaming.

**Chosen Approach:** Option 3 initially. We ingest on upload (limit file size to <10MB) and revisit job queues if needed.

## Deliverables
- `lib/rag/chunk.ts`: text cleaning + chunking utilities.
- `lib/rag/embeddings.ts`: embedding generation and persistence helpers.
- `lib/rag/search.ts`: retrieval function scoring top results.
- Update `lib/response.ts` to call search when intent `analyze_document` and document context available.
- Extend Supabase schemas if necessary (ensure metadata holds chunk info, user ownership enforced).
- Tests: unit tests for chunking, embedding payload, and retrieval ranking; integration test stubbing embeddings.
- Documentation: how to ingest documents, run RAG queries, constraints.

## Constraints
- Edge runtime memory/time budget (avoid heavy PDF parsing; start with text/MD and plan PDF support via Supabase Edge Functions).
- Keep functions under 50 LOC, files under 300 LOC.
- No secrets persisted; follow RLS policies and maintain per-user segregation.
- Ensure fallback when no embeddings found to keep responses graceful.

## Open Questions
- Preferred PDF-to-text strategy in Edge (use `pdf-parse`? worker-based?). For now, expect pre-text extracted content.
- Need to confirm chunk size (512 tokens) vs. context length for GPT-4o.
- Decide on distance metric in absence of pgvector (cosine similarity computed client-side).
