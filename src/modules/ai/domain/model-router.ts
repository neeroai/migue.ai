/**
 * @file model-router.ts
 * @description Intelligent multi-provider model selection with cost optimization
 * @module lib/ai
 * @exports selectModel, ModelSelection, SelectionContext
 * @date 2026-02-02 10:45
 * @updated 2026-02-02 10:45
 */

import { models } from './providers'

// ============================================================================
// Types
// ============================================================================

export type Provider = 'openai' | 'gemini'
export type SelectionReason = 'cost' | 'budget_critical'
export type Complexity = 'low' | 'high'

export interface SelectionContext {
  estimatedTokens: number
  complexity: Complexity
  budgetRemaining: number
  hasTools?: boolean
}

export interface ModelSelection {
  provider: Provider
  modelName: string
  reason: SelectionReason
  maxTokens: number
  estimatedCost: number
}

// ============================================================================
// Routing Logic
// ============================================================================

/**
 * Decision tree for model selection
 * Pattern from api-neero/lib/ai/router.ts L33-54
 */
export function selectModel(context: SelectionContext): ModelSelection {
  // Gate 1: Budget-critical (< $0.01) → Force cheapest
  if (context.budgetRemaining < 0.01) {
    return {
      provider: 'openai',
      modelName: models.openai.primary,
      reason: 'budget_critical',
      maxTokens: models.openai.maxTokens,
      estimatedCost: estimateCost('openai', context.estimatedTokens),
    }
  }

  // Gate 2: Default → Cost-optimized (GPT-4o-mini)
  return {
    provider: 'openai',
    modelName: models.openai.primary,
    reason: 'cost',
    maxTokens: models.openai.maxTokens,
    estimatedCost: estimateCost('openai', context.estimatedTokens),
  }
}

/**
 * Estimate cost for a request
 * Assumes 70% input / 30% output ratio (typical conversation)
 */
function estimateCost(provider: Provider, totalTokens: number): number {
  const inputTokens = Math.floor(totalTokens * 0.7)
  const outputTokens = Math.floor(totalTokens * 0.3)

  const pricing = models[provider].costPer1MTokens

  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output

  return inputCost + outputCost
}

/**
 * Get fallback model for a failed primary
 * Pattern: If OpenAI fails → Gemini
 */
export function getFallbackSelection(
  primary: ModelSelection,
  context: SelectionContext
): ModelSelection {
  const fallbackProvider: Provider = 'gemini'
  const fallbackConfig = models.gemini

  return {
    provider: fallbackProvider,
    modelName: fallbackConfig.primary,
    reason: 'cost', // Fallback is for reliability
    maxTokens: fallbackConfig.maxTokens,
    estimatedCost: estimateCost(fallbackProvider, context.estimatedTokens),
  }
}

/**
 * Analyze message complexity
 * Heuristics:
 * - Tools present → high
 * - Long messages (>1000 chars) → high
 * - Multi-turn conversations (>5 messages) → high
 * - Simple text → low
 */
export function analyzeComplexity(
  messageContent: string,
  messageCount: number,
  hasTools: boolean
): Complexity {
  if (hasTools) return 'high'
  if (messageContent.length > 1000) return 'high'
  if (messageCount > 5) return 'high'

  return 'low'
}

/**
 * Estimate token count from message
 * Rough heuristic: 1 token ≈ 4 characters (English/Spanish mix)
 */
export function estimateTokens(
  messageContent: string,
  historyCount: number
): number {
  const messageTokens = Math.ceil(messageContent.length / 4)
  const historyTokens = historyCount * 100 // ~100 tokens per history message

  return messageTokens + historyTokens
}
