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

export type Provider = 'openai' | 'claude'
export type SelectionReason = 'cost' | 'quality' | 'budget_critical'
export type Complexity = 'low' | 'high'

export interface SelectionContext {
  estimatedTokens: number
  complexity: Complexity
  budgetRemaining: number
  hasTools?: boolean
}

export interface ModelSelection {
  provider: Provider
  model: any // Vercel AI SDK LanguageModel
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
      model: models.openai.primary,
      modelName: 'gpt-4o-mini',
      reason: 'budget_critical',
      maxTokens: models.openai.maxTokens,
      estimatedCost: estimateCost('openai', context.estimatedTokens),
    }
  }

  // Gate 2: High complexity + sufficient tokens → Quality model
  if (context.complexity === 'high' && context.estimatedTokens > 2000) {
    const estimatedCost = estimateCost('claude', context.estimatedTokens)

    // Only use Claude if budget allows (cost + 20% buffer)
    if (context.budgetRemaining >= estimatedCost * 1.2) {
      return {
        provider: 'claude',
        model: models.claude.primary,
        modelName: 'claude-sonnet-4',
        reason: 'quality',
        maxTokens: models.claude.maxTokens,
        estimatedCost,
      }
    }
  }

  // Gate 3: Default → Cost-optimized (GPT-4o-mini)
  return {
    provider: 'openai',
    model: models.openai.primary,
    modelName: 'gpt-4o-mini',
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
 * Pattern: If OpenAI fails → Claude, if Claude fails → OpenAI
 */
export function getFallbackSelection(
  primary: ModelSelection,
  context: SelectionContext
): ModelSelection {
  const fallbackProvider: Provider =
    primary.provider === 'openai' ? 'claude' : 'openai'

  const fallbackConfig = models[fallbackProvider]

  return {
    provider: fallbackProvider,
    model: fallbackConfig.primary,
    modelName:
      fallbackProvider === 'openai' ? 'gpt-4o-mini' : 'claude-sonnet-4',
    reason: 'quality', // Fallback is always for reliability
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
