/**
 * @file fallback.ts
 * @description Provider chain with circuit breaker and budget checks
 * @module lib/ai
 * @exports executeWithFallback, FallbackResult, FallbackContext
 * @date 2026-02-02 10:55
 * @updated 2026-02-02 10:55
 */

import type { Provider, ModelSelection } from './model-router'
import { logger } from '../logger'

// ============================================================================
// Types
// ============================================================================

export interface FallbackContext {
  primarySelection: ModelSelection
  fallbackSelection: ModelSelection
  userId: string
  conversationId: string
}

export interface FallbackResult<T> {
  result: T
  provider: Provider
  fallbackUsed: boolean
  primaryError?: Error
}

export interface BudgetCheck {
  canAffordFallback: boolean
  budgetRemaining: number
  estimatedFallbackCost: number
}

// ============================================================================
// Fallback Execution
// ============================================================================

/**
 * Execute with automatic fallback chain
 * Pattern from api-neero/lib/ai/transcribe.ts L84-140
 *
 * Flow:
 * 1. Try primary provider
 * 2. If fails → Check budget for fallback
 * 3. If budget OK → Try fallback provider
 * 4. If budget insufficient → Throw error
 */
export async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  context: FallbackContext,
  budgetCheck: BudgetCheck
): Promise<FallbackResult<T>> {
  // Try primary
  try {
    logger.info('Executing primary provider', {
      userId: context.userId,
      conversationId: context.conversationId,
      metadata: {
        provider: context.primarySelection.provider,
        model: context.primarySelection.modelName,
      },
    })

    const result = await primary()

    return {
      result,
      provider: context.primarySelection.provider,
      fallbackUsed: false,
    }
  } catch (primaryError: any) {
    logger.warn('Primary provider failed, checking fallback budget', {
      userId: context.userId,
      conversationId: context.conversationId,
      metadata: {
        provider: context.primarySelection.provider,
        error: primaryError.message,
      },
    })

    // Circuit breaker: Budget check
    if (!budgetCheck.canAffordFallback) {
      const budgetError = new Error(
        `Primary provider failed and insufficient budget for fallback. ` +
          `Remaining: $${budgetCheck.budgetRemaining.toFixed(4)}, ` +
          `Needed: $${budgetCheck.estimatedFallbackCost.toFixed(4)}`
      )

      logger.error('Fallback blocked: insufficient budget', budgetError, {
        userId: context.userId,
        metadata: {
          budgetRemaining: budgetCheck.budgetRemaining,
          estimatedCost: budgetCheck.estimatedFallbackCost,
        },
      })

      throw budgetError
    }

    // Attempt fallback
    try {
      logger.info('Attempting fallback provider', {
        userId: context.userId,
        conversationId: context.conversationId,
        metadata: {
          provider: context.fallbackSelection.provider,
          model: context.fallbackSelection.modelName,
        },
      })

      const result = await fallback()

      logger.info('Fallback provider succeeded', {
        userId: context.userId,
        conversationId: context.conversationId,
        metadata: {
          provider: context.fallbackSelection.provider,
        },
      })

      return {
        result,
        provider: context.fallbackSelection.provider,
        fallbackUsed: true,
        primaryError,
      }
    } catch (fallbackError: any) {
      logger.error('Both providers failed', fallbackError, {
        userId: context.userId,
        conversationId: context.conversationId,
        metadata: {
          primaryError: primaryError.message,
          fallbackError: fallbackError.message,
        },
      })

      // Throw original primary error (more useful for debugging)
      throw primaryError
    }
  }
}

/**
 * Check if budget allows fallback
 * Requires 20% buffer above estimated cost
 */
export function canAffordFallback(
  budgetRemaining: number,
  estimatedCost: number
): BudgetCheck {
  const costWithBuffer = estimatedCost * 1.2 // 20% safety margin

  return {
    canAffordFallback: budgetRemaining >= costWithBuffer,
    budgetRemaining,
    estimatedFallbackCost: estimatedCost,
  }
}
