/**
 * OpenAI Response Handler Tests
 * Tests for response validation, usage extraction, and cost calculation
 */

import type { ChatCompletion } from 'openai/resources/chat/completions'
import {
  validateChatResponse,
  extractUsageMetrics,
  calculateCost,
  hasResponseError,
  formatCost,
  formatUsage,
  getModelPricing,
} from '../../src/shared/infra/openai/response-handler'

describe('openai-response-handler', () => {
  describe('validateChatResponse', () => {
    it('should validate a complete response with content', () => {
      const mockResponse: ChatCompletion = {
        id: 'chatcmpl-test123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 7,
          total_tokens: 17,
        },
      }

      const validated = validateChatResponse(mockResponse)

      expect(validated.content).toBe('Hello! How can I help you?')
      expect(validated.toolCalls).toBeUndefined()
      expect(validated.metadata.id).toBe('chatcmpl-test123')
      expect(validated.metadata.model).toBe('gpt-4o-mini')
      expect(validated.metadata.finishReason).toBe('stop')
      expect(validated.metadata.hasToolCalls).toBe(false)
      expect(validated.metadata.usage).toEqual({
        promptTokens: 10,
        completionTokens: 7,
        totalTokens: 17,
      })
      expect(validated.metadata.cost).toBeDefined()
      expect(validated.metadata.cost!.totalCost).toBeGreaterThan(0)
    })

    it('should validate a response with tool calls', () => {
      const mockResponse: ChatCompletion = {
        id: 'chatcmpl-test456',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'create_reminder',
                    arguments: '{"title":"Test reminder"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
            logprobs: null,
          },
        ],
        usage: {
          prompt_tokens: 50,
          completion_tokens: 20,
          total_tokens: 70,
        },
      }

      const validated = validateChatResponse(mockResponse)

      expect(validated.content).toBeNull()
      expect(validated.toolCalls).toHaveLength(1)
      expect(validated.toolCalls![0]!.function.name).toBe('create_reminder')
      expect(validated.metadata.hasToolCalls).toBe(true)
      expect(validated.metadata.toolCallCount).toBe(1)
      expect(validated.metadata.finishReason).toBe('tool_calls')
    })

    it('should throw error on invalid response structure', () => {
      const invalidResponse = {} as ChatCompletion

      expect(() => validateChatResponse(invalidResponse)).toThrow(
        '[OpenAI Response] Missing response.id'
      )
    })

    it('should throw error on missing choices', () => {
      const invalidResponse = {
        id: 'test',
        model: 'gpt-4o-mini',
        choices: [],
      } as ChatCompletion

      expect(() => validateChatResponse(invalidResponse)).toThrow(
        '[OpenAI Response] Empty choices array'
      )
    })
  })

  describe('extractUsageMetrics', () => {
    it('should extract usage metrics from response', () => {
      const mockResponse: ChatCompletion = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Test' },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }

      const usage = extractUsageMetrics(mockResponse)

      expect(usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      })
    })

    it('should return null if usage not available', () => {
      const mockResponse = {
        id: 'test',
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Test' },
            finish_reason: 'stop',
          },
        ],
      } as ChatCompletion

      const usage = extractUsageMetrics(mockResponse)
      expect(usage).toBeNull()
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost for gpt-4o-mini', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost = calculateCost(usage, 'gpt-4o-mini')

      // $0.15 per 1M input tokens = $0.00015 for 1000 tokens
      // $0.60 per 1M output tokens = $0.0003 for 500 tokens
      expect(cost.inputCost).toBeCloseTo(0.00015, 6)
      expect(cost.outputCost).toBeCloseTo(0.0003, 6)
      expect(cost.totalCost).toBeCloseTo(0.00045, 6)
      expect(cost.model).toBe('gpt-4o-mini')
    })

    it('should calculate cost for gpt-4o', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost = calculateCost(usage, 'gpt-4o')

      // $2.50 per 1M input tokens = $0.0025 for 1000 tokens
      // $10.00 per 1M output tokens = $0.005 for 500 tokens
      expect(cost.inputCost).toBeCloseTo(0.0025, 6)
      expect(cost.outputCost).toBeCloseTo(0.005, 6)
      expect(cost.totalCost).toBeCloseTo(0.0075, 6)
    })

    it('should fallback to gpt-4o-mini pricing for unknown model', () => {
      const usage = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost = calculateCost(usage, 'unknown-model')

      // Should use gpt-4o-mini pricing
      expect(cost.inputCost).toBeCloseTo(0.00015, 6)
      expect(cost.outputCost).toBeCloseTo(0.0003, 6)
    })
  })

  describe('hasResponseError', () => {
    it('should detect content filter error', () => {
      const mockResponse: ChatCompletion = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Filtered' },
            finish_reason: 'content_filter',
            logprobs: null,
          },
        ],
      }

      const validated = validateChatResponse(mockResponse)
      const errorCheck = hasResponseError(validated)

      expect(errorCheck.hasError).toBe(true)
      expect(errorCheck.errorType).toBe('content_filter')
    })

    it('should detect length limit error', () => {
      const mockResponse: ChatCompletion = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Truncated...' },
            finish_reason: 'length',
            logprobs: null,
          },
        ],
      }

      const validated = validateChatResponse(mockResponse)
      const errorCheck = hasResponseError(validated)

      expect(errorCheck.hasError).toBe(true)
      expect(errorCheck.errorType).toBe('length_limit')
    })

    it('should detect empty response error', () => {
      const mockResponse: ChatCompletion = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
      }

      const validated = validateChatResponse(mockResponse)
      const errorCheck = hasResponseError(validated)

      expect(errorCheck.hasError).toBe(true)
      expect(errorCheck.errorType).toBe('empty_response')
    })

    it('should pass valid response without errors', () => {
      const mockResponse: ChatCompletion = {
        id: 'test',
        object: 'chat.completion',
        created: 123,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Valid response' },
            finish_reason: 'stop',
            logprobs: null,
          },
        ],
      }

      const validated = validateChatResponse(mockResponse)
      const errorCheck = hasResponseError(validated)

      expect(errorCheck.hasError).toBe(false)
    })
  })

  describe('utility functions', () => {
    it('should format cost correctly', () => {
      expect(formatCost(0.001234)).toBe('$0.001234')
      expect(formatCost(0.5)).toBe('$0.500000')
      expect(formatCost(10.123456789)).toBe('$10.123457')
    })

    it('should format usage correctly', () => {
      const usage = {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      }
      expect(formatUsage(usage)).toBe('150 tokens (100 in + 50 out)')
    })

    it('should get model pricing', () => {
      const pricing = getModelPricing('gpt-4o-mini')
      expect(pricing).toEqual({ input: 0.15, output: 0.6 })

      const unknownPricing = getModelPricing('unknown-model')
      expect(unknownPricing).toBeNull()
    })
  })
})
