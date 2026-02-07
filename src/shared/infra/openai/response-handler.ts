/**
 * @file openai-response-handler.ts
 * @description OpenAI API response processing with structure validation, token usage extraction, cost calculation (per-model pricing), analytics logging, and error detection
 * @module lib/openai-response-handler
 * @exports UsageMetrics, CostMetrics, ResponseMetadata, ValidatedChatResponse, validateChatResponse, extractUsageMetrics, extractStreamUsage, calculateCost, calculateStreamCost, logResponse, logUsageMetrics, hasResponseError, formatCost, formatUsage, getModelPricing
 * @runtime edge
 * @date 2026-02-07 19:16
 * @updated 2026-02-07 19:16
 */

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionMessage,
} from 'openai/resources/chat/completions'
import { logger } from '../../observability/logger'

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
 * Validate and parse OpenAI ChatCompletion response structure with comprehensive error checking
 * Extracts content, tool calls, usage metrics, cost calculation, and metadata
 *
 * Validation checks:
 * - Response object exists and is valid
 * - Required fields present (id, model, choices array)
 * - First choice has message object
 * - Automatically calculates cost if usage data available
 *
 * Usage edge case: Streaming without stream_options returns null usage (cost will be null)
 *
 * @param response - Raw OpenAI ChatCompletion response object
 * @returns Validated response with typed content, tool calls, and metadata
 * @throws {Error} If response missing required fields or has invalid structure
 * @example
 * const validated = validateChatResponse(apiResponse);
 * if (validated.metadata.hasToolCalls) {
 *   // Process tool calls
 * }
 * console.log(`Cost: $${validated.metadata.cost?.totalCost.toFixed(6)}`);
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
 * Extract token usage metrics from non-streaming ChatCompletion response
 *
 * Returns null for streaming responses without stream_options: { include_usage: true }
 * Use this for tracking costs and monitoring token consumption
 *
 * @param response - OpenAI ChatCompletion response object
 * @returns Token counts (prompt, completion, total) or null if usage unavailable
 * @example
 * const usage = extractUsageMetrics(response);
 * if (usage) {
 *   console.log(`Used ${usage.totalTokens} tokens`);
 * }
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
 * Extract token usage from final streaming chunk
 *
 * Only the last chunk contains usage data when stream_options: { include_usage: true } is set
 * Returns null for all chunks except the final one, or if stream_options not enabled
 *
 * @param chunk - Individual streaming chunk from OpenAI stream
 * @returns Token counts from final chunk, or null if not present
 * @example
 * for await (const chunk of stream) {
 *   const usage = extractStreamUsage(chunk);
 *   if (usage) {
 *     console.log(`Stream complete: ${usage.totalTokens} tokens`);
 *   }
 * }
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
 * Calculate USD cost for OpenAI API request using per-model pricing (January 2025 rates)
 *
 * Pricing logic:
 * - Input/output tokens priced separately (per 1M tokens)
 * - Falls back to gpt-4o-mini pricing for unknown models
 * - Supports gpt-4o-mini, gpt-4o, gpt-4o-realtime, gpt-4-turbo, gpt-4
 *
 * @param usage - Token counts (prompt, completion, total)
 * @param model - OpenAI model name (e.g., 'gpt-4o-mini', 'gpt-4o')
 * @returns Cost breakdown with input, output, and total costs in USD
 * @example
 * const cost = calculateCost({ promptTokens: 1000, completionTokens: 500, totalTokens: 1500 }, 'gpt-4o-mini');
 * console.log(`Total: $${cost.totalCost.toFixed(6)}`); // $0.000450
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
 * Calculate cost for streaming request (alias of calculateCost)
 *
 * Use after accumulating usage from final streaming chunk
 * Identical behavior to calculateCost, provided for semantic clarity
 *
 * @param usage - Accumulated token counts from stream
 * @param model - OpenAI model name used for stream
 * @returns Cost breakdown in USD
 * @example
 * const finalChunk = await getLastChunk(stream);
 * const usage = extractStreamUsage(finalChunk);
 * if (usage) {
 *   const cost = calculateStreamCost(usage, 'gpt-4o-mini');
 * }
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
 * Log OpenAI response with complete metadata for analytics and debugging
 *
 * Logs to Vercel Log Drain with structured metadata:
 * - Response ID, model, finish reason
 * - Token usage (input/output/total)
 * - Cost breakdown (USD, 6 decimal precision)
 * - Tool call information
 * - Optional context (conversation ID, user ID, message ID)
 *
 * @param validated - Validated response from validateChatResponse()
 * @param context - Optional tracking IDs for correlation (conversation, user, message)
 * @example
 * const validated = validateChatResponse(response);
 * logResponse(validated, { conversationId: conv.id, userId: user.id });
 * // Logs: [OpenAI Response] Chat completion received { model, cost, usage, ... }
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
 * Log token usage and cost without full response metadata (lightweight alternative to logResponse)
 *
 * Use when you only have usage data (e.g., from extractUsageMetrics)
 * Automatically calculates cost based on model pricing
 *
 * @param usage - Token counts (prompt, completion, total)
 * @param model - OpenAI model name for cost calculation
 * @param context - Optional tracking IDs (conversation, user)
 * @example
 * const usage = extractUsageMetrics(response);
 * if (usage) {
 *   logUsageMetrics(usage, 'gpt-4o-mini', { conversationId: conv.id });
 * }
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
 * Detect error conditions in OpenAI response based on finish reason and content
 *
 * Error conditions checked:
 * - content_filter: Response blocked by OpenAI content policy
 * - length: Response truncated due to max_tokens limit
 * - empty_response: No content and no tool calls (unexpected state)
 *
 * Note: 'stop' finish reason (normal completion) returns hasError: false
 *
 * @param validated - Validated response from validateChatResponse()
 * @returns Error status object with type and message if error detected
 * @example
 * const error = hasResponseError(validated);
 * if (error.hasError) {
 *   console.error(`OpenAI error: ${error.errorType} - ${error.errorMessage}`);
 *   // Handle content_filter, length, or empty_response
 * }
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
 * Format cost as USD string with 6 decimal places
 * @param cost - Cost in USD (e.g., 0.000150)
 * @returns Formatted string (e.g., "$0.000150")
 */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(6)}`
}

/**
 * Format usage metrics as human-readable string with token breakdown
 * @param usage - Token counts (prompt, completion, total)
 * @returns Formatted string (e.g., "1500 tokens (1000 in + 500 out)")
 */
export function formatUsage(usage: UsageMetrics): string {
  return `${usage.totalTokens} tokens (${usage.promptTokens} in + ${usage.completionTokens} out)`
}

/**
 * Retrieve per-model pricing rates (USD per 1M tokens)
 *
 * Supported models: gpt-4o-mini, gpt-4o, gpt-4o-realtime, gpt-4-turbo, gpt-4
 * Returns null for unknown models (calculateCost falls back to gpt-4o-mini)
 *
 * @param model - OpenAI model name (e.g., 'gpt-4o-mini')
 * @returns Pricing object with input/output rates, or null if model unknown
 * @example
 * const pricing = getModelPricing('gpt-4o-mini');
 * // { input: 0.150, output: 0.600 } (USD per 1M tokens)
 */
export function getModelPricing(model: string): {
  input: number
  output: number
} | null {
  return PRICING[model] ?? null
}
