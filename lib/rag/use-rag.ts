import { generateEmbedding } from './embeddings'
import { searchEmbeddings, type RetrievedChunk } from './search'

export async function retrieveContext(options: {
  userId: string
  documentId?: string
  query: string
  topK?: number
}): Promise<RetrievedChunk[]> {
  const queryEmbedding = await generateEmbedding(options.query)
  return searchEmbeddings(options.userId, queryEmbedding, {
    ...(options.documentId ? { documentId: options.documentId } : {}),
    topK: options.topK ?? 5,
  })
}
