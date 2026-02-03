/**
 * @file gateway.ts
 * @description Unified provider gateway with lazy-init singleton
 * @module lib/ai
 * @exports getModel, clearCache
 * @date 2026-02-02 10:50
 * @updated 2026-02-02 10:50
 */

import type { LanguageModel } from 'ai'
import type { ModelSelection } from './model-router'
import { models } from './providers'

// ============================================================================
// Singleton Cache
// ============================================================================

/**
 * Lazy-init model cache
 * Pattern from api-neero/lib/ai/gateway.ts L51-73
 */
let providersCache: Map<string, LanguageModel> | null = null

/**
 * Get or create model instance
 * Uses singleton cache to avoid re-creating providers per request
 */
export function getModel(selection: ModelSelection): LanguageModel {
  // Lazy-init cache
  if (!providersCache) {
    providersCache = new Map()
  }

  // Cache key: provider:model (e.g., "openai:gpt-4o-mini")
  const key = `${selection.provider}:${selection.modelName}`

  // Cache hit
  if (providersCache.has(key)) {
    return providersCache.get(key)!
  }

  // Cache miss → Create instance
  const model = createModelInstance(selection)
  providersCache.set(key, model)

  return model
}

/**
 * Create model instance from selection
 * Maps selection to actual Vercel AI SDK model
 */
function createModelInstance(selection: ModelSelection): LanguageModel {
  // Selection already contains the Vercel AI SDK model
  // (created in model-router via models.provider.primary)
  return selection.model
}

/**
 * Clear provider cache
 * Useful for testing or when API keys change
 */
export function clearCache(): void {
  providersCache = null
}

/**
 * Health check for a provider
 * Returns true if provider is configured with valid API key
 */
export function isProviderHealthy(provider: 'openai' | 'claude'): boolean {
  const apiKey =
    provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY

  return !!apiKey && apiKey.length > 0
}

/**
 * Get all healthy providers
 * Returns array of provider names that have valid configuration
 */
export function getHealthyProviders(): Array<'openai' | 'claude'> {
  const healthy: Array<'openai' | 'claude'> = []

  if (isProviderHealthy('openai')) healthy.push('openai')
  if (isProviderHealthy('claude')) healthy.push('claude')

  return healthy
}
