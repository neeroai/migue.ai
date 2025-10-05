/**
 * Embeddings System - Generate vector embeddings for semantic search
 *
 * Supports multiple providers:
 * - OpenAI text-embedding-3-small (1536 dims) - Primary, $0.020 per 1M tokens
 * - Supabase gte-small (built-in, free) - Future implementation
 *
 * Best practices 2025:
 * - Normalize vectors for inner product distance
 * - Batch embedding generation for cost efficiency
 * - Cache embeddings to reduce API calls
 */

import { logger } from './logger'

export type EmbeddingProvider = 'openai' | 'supabase'

export type EmbeddingConfig = {
  provider: EmbeddingProvider
  model?: string
  dimensions?: number
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  config?: EmbeddingConfig
): Promise<number[]> {
  const provider = config?.provider || (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai'

  switch (provider) {
    case 'openai':
      return generateOpenAIEmbedding(text, config?.model)

    case 'supabase':
      // TODO: Implement Supabase gte-small (free, built-in)
      logger.warn('Supabase embeddings not yet implemented, falling back to OpenAI')
      return generateOpenAIEmbedding(text, config?.model)

    default:
      throw new Error(`Unknown embedding provider: ${provider}`)
  }
}

/**
 * Generate embeddings for multiple texts (batch)
 * More efficient than individual calls
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  config?: EmbeddingConfig
): Promise<number[][]> {
  const provider = config?.provider || (process.env.EMBEDDING_PROVIDER as EmbeddingProvider) || 'openai'

  switch (provider) {
    case 'openai':
      return generateOpenAIEmbeddingsBatch(texts, config?.model)

    case 'supabase':
      logger.warn('Supabase embeddings not yet implemented, falling back to OpenAI')
      return generateOpenAIEmbeddingsBatch(texts, config?.model)

    default:
      throw new Error(`Unknown embedding provider: ${provider}`)
  }
}

/**
 * OpenAI text-embedding-3-small implementation
 * Cost: $0.020 per 1M tokens (~$0.00002 per embedding)
 * Dimensions: 1536
 */
async function generateOpenAIEmbedding(
  text: string,
  model = 'text-embedding-3-small'
): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment')
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: text,
        model,
        encoding_format: 'float', // vs base64 for clarity
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const data = await response.json()

    if (!data.data?.[0]?.embedding) {
      throw new Error('Invalid response from OpenAI embeddings API')
    }

    const embedding = data.data[0].embedding as number[]

    // Normalize for inner product distance (best practice)
    const normalized = normalizeVector(embedding)

    logger.info('OpenAI embedding generated', {
      metadata: {
        model,
        dimensions: normalized.length,
        usage: data.usage,
      },
    })

    return normalized
  } catch (error: any) {
    logger.error('OpenAI embedding generation failed', error, {
      metadata: { model, textLength: text.length },
    })
    throw error
  }
}

/**
 * OpenAI batch embeddings implementation
 * More efficient than individual calls
 */
async function generateOpenAIEmbeddingsBatch(
  texts: string[],
  model = 'text-embedding-3-small'
): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not found in environment')
  }

  // OpenAI supports up to 2048 inputs per request
  const batchSize = 2048
  const batches: string[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize))
  }

  try {
    const allEmbeddings: number[][] = []

    for (const batch of batches) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: batch,
          model,
          encoding_format: 'float',
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} ${error}`)
      }

      const data = await response.json()

      // Extract and normalize embeddings
      const batchEmbeddings = data.data.map((item: any) =>
        normalizeVector(item.embedding as number[])
      )

      allEmbeddings.push(...batchEmbeddings)

      logger.info('OpenAI batch embeddings generated', {
        metadata: {
          model,
          batchSize: batch.length,
          usage: data.usage,
        },
      })
    }

    return allEmbeddings
  } catch (error: any) {
    logger.error('OpenAI batch embedding generation failed', error, {
      metadata: { model, textsCount: texts.length },
    })
    throw error
  }
}

/**
 * Normalize vector for inner product distance
 * Best practice: normalized vectors make inner product equivalent to cosine similarity
 */
function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))

  if (magnitude === 0) {
    return vector
  }

  return vector.map(val => val / magnitude)
}

/**
 * Calculate cosine similarity between two embeddings
 * Range: -1 to 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimensions')
  }

  // If vectors are normalized, this is just the dot product
  const dotProduct = a.reduce((sum, val, i) => sum + val * (b[i] || 0), 0)

  return dotProduct
}

/**
 * Cache key for embeddings (use content hash)
 * Best practice: avoid regenerating embeddings for same text
 */
export function getCacheKey(text: string): string {
  // Simple hash for now - could use crypto.subtle.digest for better hashing
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return `emb_${hash.toString(36)}`
}

/**
 * Estimate token count for embedding cost calculation
 * Rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Calculate embedding cost (OpenAI pricing)
 * text-embedding-3-small: $0.020 per 1M tokens
 */
export function calculateEmbeddingCost(text: string, provider: EmbeddingProvider = 'openai'): number {
  const tokens = estimateTokens(text)

  switch (provider) {
    case 'openai':
      return (tokens / 1_000_000) * 0.020 // $0.020 per 1M tokens

    case 'supabase':
      return 0 // Free

    default:
      return 0
  }
}
