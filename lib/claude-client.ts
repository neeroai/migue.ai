/**
 * Claude SDK Client
 * 75% cheaper than GPT-4o ($3/$15 vs $15/$60 per 1M tokens)
 *
 * Features:
 * - Claude Sonnet 4.5: Best coding model, 30+ hour autonomous tasks
 * - Extended thinking with tool use
 * - Native multimodal (text + images)
 * - Streaming responses
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  MessageParam,
  MessageCreateParams,
  MessageStreamEvent,
} from '@anthropic-ai/sdk/resources/messages'
import { logger } from './logger'

export type ClaudeMessage = MessageParam

export type ClaudeOptions = {
  model?: 'claude-sonnet-4-5' | 'claude-opus-4' | 'claude-sonnet-4'
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  stream?: boolean
}

/**
 * Get Claude client singleton
 */
let claudeClient: Anthropic | null = null

export function getClaudeClient(): Anthropic {
  if (!claudeClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set')
    }

    claudeClient = new Anthropic({
      apiKey,
      timeout: 30000, // 30s timeout
      maxRetries: 2,
    })
  }

  return claudeClient
}

/**
 * Chat completion with Claude
 * Cost: $3/1M input, $15/1M output (75% cheaper than GPT-4o)
 */
export async function claudeChatCompletion(
  messages: ClaudeMessage[],
  options?: ClaudeOptions
): Promise<string> {
  const client = getClaudeClient()

  const params: MessageCreateParams = {
    model: options?.model || 'claude-sonnet-4-5',
    max_tokens: options?.maxTokens || 1024,
    temperature: options?.temperature || 0.7,
    messages,
  }

  // Add system prompt if provided
  if (options?.systemPrompt) {
    params.system = options.systemPrompt
  }

  try {
    const response = await client.messages.create(params)

    // Extract text from response
    const content = response.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Claude returned non-text response')
    }

    const text = content.text
    if (!text.trim()) {
      throw new Error('Claude returned empty response')
    }

    logger.info('Claude completion successful', {
      metadata: {
        model: params.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cost: estimateClaudeCost(response.usage.input_tokens, response.usage.output_tokens),
      },
    })

    return text.trim()
  } catch (error: any) {
    logger.error('Claude completion failed', error, {
      metadata: { model: params.model },
    })
    throw error
  }
}

/**
 * Streaming chat completion with Claude
 * Best for real-time conversational experiences
 */
export async function claudeStreamCompletion(
  messages: ClaudeMessage[],
  options?: ClaudeOptions
): Promise<string> {
  const client = getClaudeClient()

  const params: MessageCreateParams = {
    model: options?.model || 'claude-sonnet-4-5',
    max_tokens: options?.maxTokens || 1024,
    temperature: options?.temperature || 0.7,
    messages,
    stream: true,
  }

  if (options?.systemPrompt) {
    params.system = options.systemPrompt
  }

  try {
    const stream = await client.messages.create(params)

    let fullText = ''
    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream as AsyncIterable<MessageStreamEvent>) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullText += event.delta.text
        }
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens
      }
    }

    if (!fullText.trim()) {
      throw new Error('Claude streaming returned empty response')
    }

    logger.info('Claude streaming successful', {
      metadata: {
        model: params.model,
        inputTokens,
        outputTokens,
        cost: estimateClaudeCost(inputTokens, outputTokens),
      },
    })

    return fullText.trim()
  } catch (error: any) {
    logger.error('Claude streaming failed', error, {
      metadata: { model: params.model },
    })
    throw error
  }
}

/**
 * Convert OpenAI-style messages to Claude format
 */
export function openAIToClaude(
  openAIMessages: Array<{ role: string; content: string }>
): ClaudeMessage[] {
  return openAIMessages
    .filter((msg) => msg.role !== 'system') // Claude uses separate system param
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }))
}

/**
 * Estimate Claude API cost
 * Sonnet 4.5: $3/1M input, $15/1M output
 */
export function estimateClaudeCost(inputTokens: number, outputTokens: number): string {
  const inputCost = (inputTokens / 1_000_000) * 3
  const outputCost = (outputTokens / 1_000_000) * 15
  const total = inputCost + outputCost

  return `$${total.toFixed(6)}`
}

/**
 * Compare costs: Claude vs OpenAI
 */
export function compareAPICosts(tokens: number) {
  const claudeCost = (tokens / 1_000_000) * 18 // $3 + $15 average
  const openAICost = (tokens / 1_000_000) * 75 // $15 + $60 average

  return {
    claude: `$${claudeCost.toFixed(4)}`,
    openai: `$${openAICost.toFixed(4)}`,
    savings: `$${(openAICost - claudeCost).toFixed(4)}`,
    percentSaved: `${(((openAICost - claudeCost) / openAICost) * 100).toFixed(1)}%`,
  }
}
