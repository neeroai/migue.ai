import { getSupabaseServerClient } from '../supabase'
import type { Tables, EmbeddingMetadata } from '../../types/supabase-helpers'
import type { EmbeddingVector } from './embeddings'

export type RetrievedChunk = {
  chunkIndex: number
  content: string
  score: number
}

// Type for embedding row
type EmbeddingRow = Tables<'embeddings'>

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
    .select('*')
    .order('chunk_index', { ascending: true })
  if (documentId) {
    query = query.eq('document_id', documentId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).filter((row) => {
    const metadata = row.metadata as EmbeddingMetadata | null
    return metadata?.user_id === userId
  })
}

export async function searchEmbeddings(
  userId: string,
  queryVector: EmbeddingVector,
  options?: { documentId?: string; topK?: number }
): Promise<RetrievedChunk[]> {
  const rows = await fetchEmbeddingsForUser(userId, options?.documentId)
  const results = rows
    .map((row): RetrievedChunk => {
      const metadata = row.metadata as (EmbeddingMetadata & { content?: string }) | null
      return {
        chunkIndex: row.chunk_index,
        content: metadata?.content ?? '',
        score: cosineSimilarity(queryVector, row.vector as EmbeddingVector),
      }
    })
    .filter((item) => item.content)
    .sort((a, b) => b.score - a.score)
  return results.slice(0, options?.topK ?? 5)
}
