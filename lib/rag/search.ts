/**
 * RAG Search - STUB IMPLEMENTATION
 *
 * Current status: 10% complete, needs full rebuild
 * This is a minimal stub to satisfy TypeScript imports
 * See ROADMAP.md for rebuild plan (8 hours estimated)
 */

import type { EmbeddingVector } from './embeddings'

export interface RetrievedChunk {
  documentId: string
  chunkIndex: number
  content: string
  similarity: number
}

/**
 * Search for similar embeddings (STUB - returns empty array)
 *
 * @param userId - User ID
 * @param queryEmbedding - Query embedding vector
 * @param options - Search options
 * @returns Empty array (stub implementation)
 */
export async function searchEmbeddings(
  userId: string,
  queryEmbedding: EmbeddingVector,
  options?: {
    documentId?: string
    topK?: number
  }
): Promise<RetrievedChunk[]> {
  // STUB: Returns empty array
  // TODO: Implement pgvector semantic search when RAG rebuild starts
  return []
}
