/**
 * OpenAI Response Handler - Production-Ready Response Processing
 *
 * Handles OpenAI API responses with:
 * - Response structure validation
 * - Usage (token) extraction
 * - Cost calculation
 * - Response logging & analytics
 * - Error detection
 *
 * Based on best practices from /docs-global/ai/openai
 */

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
} from 'openai/resources/chat/completions'
import { logger } from './logger'

// ============================================================================
// Types
// ============================================================================

/**
 * Usage metrics from OpenAI API
 */
export type UsageMetrics = {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/**
 * Cost breakdown for a request
 */
export type CostMetrics = {
  inputCost: number // Cost of input tokens
  outputCost: number // Cost of output tokens
  totalCost: number // Total cost in USD
  model: string
}

/**
 * Complete response metadata
 */
export type ResponseMetadata = {
  id: string
  model: string
  created: number
  finishReason: string | null
  usage: UsageMetrics | null
  cost: CostMetrics | null
  hasToolCalls: boolean
  toolCallCount: number
}

/**
 * Validated chat response
 */
export type ValidatedChatResponse = {
  content: string | null
  toolCalls: ChatCompletionMessage['tool_calls']
  metadata: ResponseMetadata
  raw: ChatCompletion
}

// ============================================================================
// Pricing Configuration (January 2025)
// ============================================================================

/**
 * OpenAI pricing per 1M tokens (USD)
 * Source: https://openai.com/api/pricing/
 * Last updated: January 2025
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': {
    input: 0.150, // $0.15 per 1M input tokens
    output: 0.600, // $0.60 per 1M output tokens
  },
  'gpt-4o': {
    input: 2.500, // $2.50 per 1M input tokens
    output: 10.000, // $10.00 per 1M output tokens
  },
  'gpt-4o-realtime': {
    input: 5.000, // $5.00 per 1M input tokens
    output: 20.000, // $20.00 per 1M output tokens
  },
  'gpt-4-turbo': {
    input: 10.000,
    output: 30.000,
  },
  'gpt-4': {
    input: 30.000,
    output: 60.000,
  },
}

// ============================================================================
// Response Validation
// ============================================================================

/**
 * Validate ChatCompletion response structure
 * Ensures response has expected fields and valid data
 */
export function validateChatResponse(
  response: ChatCompletion
): ValidatedChatResponse {
  // Validate response object exists
  if (!response || typeof response !== 'object') {
    throw new Error('[OpenAI Response] Invalid response: not an object')
  }

  // Validate required fields
  if (!response.id) {
    throw new Error('[OpenAI Response] Missing response.id')
  }

  if (!response.model) {
    throw new Error('[OpenAI Response] Missing response.model')
  }

  if (!response.choices || !Array.isArray(response.choices)) {
    throw new Error('[OpenAI Response] Missing or invalid response.choices')
  }

  if (response.choices.length === 0) {
    throw new Error('[OpenAI Response] Empty choices array')
  }

  // Extract first choice (primary response)
  const choice = response.choices[0]
  if (!choice) {
    throw new Error('[OpenAI Response] First choice is undefined')
  }

  const message = choice.message
  if (!message) {
    throw new Error('[OpenAI Response] Missing choice.message')
  }

  // Extract usage metrics (may be null in streaming mode without stream_options)
  const usage = response.usage
    ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : null

  // Calculate cost if usage is available
  const cost = usage ? calculateCost(usage, response.model) : null

  // Extract metadata
  const metadata: ResponseMetadata = {
    id: response.id,
    model: response.model,
    created: response.created,
    finishReason: choice.finish_reason,
    usage,
    cost,
    hasToolCalls: !!message.tool_calls && message.tool_calls.length > 0,
    toolCallCount: message.tool_calls?.length ?? 0,
  }

  return {
    content: message.content,
    toolCalls: message.tool_calls,
    metadata,
    raw: response,
  }
}

// ============================================================================
// Usage Extraction
// ============================================================================

/**
 * Extract usage metrics from ChatCompletion response
 * Returns null if usage not available (e.g., streaming without stream_options)
 */
export function extractUsageMetrics(
  response: ChatCompletion
): UsageMetrics | null {
  if (!response.usage) {
    return null
  }

  return {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: response.usage.completion_tokens,
    totalTokens: response.usage.total_tokens,
  }
}

/**
 * Extract usage from streaming chunk (final chunk only)
 */
export function extractStreamUsage(
  chunk: ChatCompletionChunk
): UsageMetrics | null {
  if (!chunk.usage) {
    return null
  }

  return {
    promptTokens: chunk.usage.prompt_tokens,
    completionTokens: chunk.usage.completion_tokens,
    totalTokens: chunk.usage.total_tokens,
  }
}

// ============================================================================
// Cost Calculation
// ============================================================================

/**
 * Calculate cost for a request based on token usage
 *
 * @param usage - Token usage metrics
 * @param model - Model name (e.g., 'gpt-4o-mini')
 * @returns Cost breakdown in USD
 */
export function calculateCost(
  usage: UsageMetrics,
  model: string
): CostMetrics {
  // Get pricing for model (fallback to gpt-4o-mini if unknown)
  const pricing = PRICING[model] ?? PRICING['gpt-4o-mini']!

  // Calculate costs per token
  const inputCost = (usage.promptTokens / 1_000_000) * pricing.input
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.output
  const totalCost = inputCost + outputCost

  return {
    inputCost,
    outputCost,
    totalCost,
    model,
  }
}

/**
 * Calculate cost for streaming request
 * Use this when you have accumulated usage from stream
 */
export function calculateStreamCost(
  usage: UsageMetrics,
  model: string
): CostMetrics {
  return calculateCost(usage, model)
}

// ============================================================================
// Response Logging
// ============================================================================

/**
 * Log response with full metadata
 * Use for debugging and analytics
 */
export function logResponse(
  validated: ValidatedChatResponse,
  context?: {
    conversationId?: string
    userId?: string
    messageId?: string
  }
) {
  const metadata = validated.metadata

  logger.info('[OpenAI Response] Chat completion received', {
    ...(context?.conversationId && { conversationId: context.conversationId }),
    ...(context?.userId && { userId: context.userId }),
    metadata: {
      responseId: metadata.id,
      model: metadata.model,
      finishReason: metadata.finishReason,
      usage: metadata.usage,
      cost: metadata.cost
        ? {
            total: `$${metadata.cost.totalCost.toFixed(6)}`,
            input: `$${metadata.cost.inputCost.toFixed(6)}`,
            output: `$${metadata.cost.outputCost.toFixed(6)}`,
          }
        : null,
      hasToolCalls: metadata.hasToolCalls,
      toolCallCount: metadata.toolCallCount,
      contentLength: validated.content?.length ?? 0,
      ...(context?.messageId && { messageId: context.messageId }),
    },
  })
}

/**
 * Log usage metrics only (lightweight)
 */
export function logUsageMetrics(
  usage: UsageMetrics,
  model: string,
  context?: {
    conversationId?: string
    userId?: string
  }
) {
  const cost = calculateCost(usage, model)

  logger.info('[OpenAI Usage] Token usage tracked', {
    ...(context?.conversationId && { conversationId: context.conversationId }),
    ...(context?.userId && { userId: context.userId }),
    metadata: {
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      cost: `$${cost.totalCost.toFixed(6)}`,
    },
  })
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Check if response indicates an error condition
 */
export function hasResponseError(
  validated: ValidatedChatResponse
): {
  hasError: boolean
  errorType?: string
  errorMessage?: string
} {
  // Check for content filter
  if (validated.metadata.finishReason === 'content_filter') {
    return {
      hasError: true,
      errorType: 'content_filter',
      errorMessage: 'Response was filtered by content policy',
    }
  }

  // Check for length limit
  if (validated.metadata.finishReason === 'length') {
    return {
      hasError: true,
      errorType: 'length_limit',
      errorMessage: 'Response exceeded max_tokens limit',
    }
  }

  // Check for empty content with no tool calls
  if (!validated.content && !validated.metadata.hasToolCalls) {
    return {
      hasError: true,
      errorType: 'empty_response',
      errorMessage: 'Response has no content and no tool calls',
    }
  }

  return { hasError: false }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`
}

/**
 * Format usage for display
 */
export function formatUsage(usage: UsageMetrics): string {
  return `${usage.totalTokens} tokens (${usage.promptTokens} in + ${usage.completionTokens} out)`
}

/**
 * Get pricing for model
 */
export function getModelPricing(model: string): {
  input: number
  output: number
} | null {
  return PRICING[model] ?? null
}
