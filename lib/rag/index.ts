import { chunkText } from './chunk'
import { generateEmbedding, storeEmbedding, type EmbeddingVector } from './embeddings'
import { searchEmbeddings } from './search'

export { chunkText, generateEmbedding, storeEmbedding, searchEmbeddings }

export async function ingestDocument(
  userId: string,
  documentId: string,
  text: string
) {
  const chunks = chunkText(text)
  const results: EmbeddingVector[] = []
  let index = 0
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk)
    await storeEmbedding({
      documentId,
      chunkIndex: index,
      content: chunk,
      embedding,
      userId,
    })
    results.push(embedding)
    index += 1
  }
  return results.length
}
