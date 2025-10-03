import { getSupabaseServerClient } from '../supabase'
import type { EmbeddingVector } from './embeddings'

export type RetrievedChunk = {
  chunkIndex: number
  content: string
  score: number
}

function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0
    const bi = b[i] ?? 0
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export async function fetchEmbeddingsForUser(userId: string, documentId?: string) {
  const supabase = getSupabaseServerClient()
  let query = supabase
    .from('embeddings')
    .select('chunk_index, vector, metadata')
    .order('chunk_index', { ascending: true })
  if (documentId) {
    query = query.eq('document_id', documentId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter((row: any) => row.metadata?.user_id === userId)
}

export async function searchEmbeddings(
  userId: string,
  queryVector: EmbeddingVector,
  options?: { documentId?: string; topK?: number }
): Promise<RetrievedChunk[]> {
  const rows = await fetchEmbeddingsForUser(userId, options?.documentId)
  const results = rows
    .map((row: any) => ({
      chunkIndex: row.chunk_index as number,
      content: (row.metadata?.content as string) ?? '',
      score: cosineSimilarity(queryVector, row.vector as EmbeddingVector),
    }))
    .filter((item) => item.content)
    .sort((a, b) => b.score - a.score)
  return results.slice(0, options?.topK ?? 5)
}
