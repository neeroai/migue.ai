/**
 * @file model-router.ts
 * @description Intelligent multi-provider model selection with capability-aware routing
 * @module lib/ai
 * @exports selectModel, ModelSelection, SelectionContext
 */

import {
  type Provider,
  type TaskProfile,
  getRoutingPriority,
} from './model-capability-catalog'
export type { Provider, TaskProfile } from './model-capability-catalog'

// ============================================================================
// Types
// ============================================================================

export type SelectionReason =
  | 'profile_priority'
  | 'budget_critical'
  | 'capability_filter'
export type Complexity = 'low' | 'high'

export interface SelectionContext {
  estimatedTokens: number
  complexity: Complexity
  budgetRemaining: number
  hasTools?: boolean
  inputType?: 'text' | 'image' | 'audio' | 'document'
}

export interface ModelSelection {
  provider: Provider
  modelName: string
  reason: SelectionReason
  maxTokens: number
  estimatedCost: number
  taskProfile: TaskProfile
}

// ============================================================================
// Routing Logic
// ============================================================================

function resolveTaskProfile(context: SelectionContext): TaskProfile {
  if (context.inputType === 'image' || context.inputType === 'document') return 'rich_vision'
  if (context.estimatedTokens > 6000) return 'long_context'
  if (context.hasTools) return 'tool_execution'
  return 'default_chat'
}

function estimateCost(modelName: string, totalTokens: number): number {
  const candidates = getRoutingPriority('default_chat').concat(
    getRoutingPriority('long_context')
  )
  const capability = candidates.find(candidate => candidate.modelName === modelName)
  if (!capability) return Number.POSITIVE_INFINITY

  const inputTokens = Math.floor(totalTokens * 0.7)
  const outputTokens = Math.floor(totalTokens * 0.3)

  const inputCost = (inputTokens / 1_000_000) * capability.costPer1MTokens.input
  const outputCost = (outputTokens / 1_000_000) * capability.costPer1MTokens.output
  return inputCost + outputCost
}

/**
 * Capability-aware selection:
 * 1) resolve task profile
 * 2) pick profile priority model that satisfies minimum capability filters
 * 3) if budget critical, pick cheapest compatible candidate
 */
export function selectModel(context: SelectionContext): ModelSelection {
  const taskProfile = resolveTaskProfile(context)
  const candidates = getRoutingPriority(taskProfile)

  const filtered = candidates.filter(candidate => {
    if (context.hasTools && !candidate.toolCalling) return false
    if ((taskProfile === 'rich_vision') && !candidate.vision) return false
    return true
  })

  const compatible = filtered.length > 0 ? filtered : candidates

  if (context.budgetRemaining < 0.01) {
    const cheapest = [...compatible].sort((a, b) => {
      const aCost = estimateCost(a.modelName, context.estimatedTokens)
      const bCost = estimateCost(b.modelName, context.estimatedTokens)
      return aCost - bCost
    })[0]

    return {
      provider: cheapest!.provider,
      modelName: cheapest!.modelName,
      reason: 'budget_critical',
      maxTokens: cheapest!.maxTokens,
      estimatedCost: estimateCost(cheapest!.modelName, context.estimatedTokens),
      taskProfile,
    }
  }

  const primary = compatible[0]!
  return {
    provider: primary.provider,
    modelName: primary.modelName,
    reason: filtered.length > 0 ? 'profile_priority' : 'capability_filter',
    maxTokens: primary.maxTokens,
    estimatedCost: estimateCost(primary.modelName, context.estimatedTokens),
    taskProfile,
  }
}

export function getFallbackSelection(
  primary: ModelSelection,
  context: SelectionContext
): ModelSelection {
  const candidates = getRoutingPriority(primary.taskProfile)
    .filter(candidate => candidate.provider !== primary.provider)

  const fallback = candidates[0] ?? getRoutingPriority('default_chat')[0]!

  return {
    provider: fallback.provider,
    modelName: fallback.modelName,
    reason: 'profile_priority',
    maxTokens: fallback.maxTokens,
    estimatedCost: estimateCost(fallback.modelName, context.estimatedTokens),
    taskProfile: primary.taskProfile,
  }
}

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

export function estimateTokens(
  messageContent: string,
  historyCount: number
): number {
  const messageTokens = Math.ceil(messageContent.length / 4)
  const historyTokens = historyCount * 100

  return messageTokens + historyTokens
}
