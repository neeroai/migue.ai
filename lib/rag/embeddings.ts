import { getSupabaseServerClient } from '../supabase'
import { getOpenAIClient } from '../openai'

export type EmbeddingVector = number[]

export async function generateEmbedding(text: string): Promise<EmbeddingVector> {
  const client = getOpenAIClient()
  const result = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
  })
  const embedding = result.data[0]?.embedding
  if (!embedding) {
    throw new Error('OpenAI returned empty embedding')
  }
  return embedding
}

export async function storeEmbedding(params: {
  documentId: string
  chunkIndex: number
  content: string
  embedding: EmbeddingVector
  userId: string
}) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase.from('embeddings').insert({
    document_id: params.documentId,
    chunk_index: params.chunkIndex,
    vector: params.embedding,
    metadata: {
      content: params.content,
      user_id: params.userId,
    },
  })
  if (error) throw error
}
