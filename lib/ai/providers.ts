/**
 * @file providers.ts
 * @description Vercel AI SDK 6.0 provider configuration
 * @module lib/ai
 * @exports anthropic, openai, models
 * @date 2026-02-01 15:15
 * @updated 2026-02-01 15:15
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

// Claude provider (Vercel AI SDK v6)
export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
})

// OpenAI provider (Vercel AI SDK v6)
export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  // Note: strictJsonSchema defaults to TRUE in v6
})

// Model configurations
export const models = {
  claude: {
    primary: anthropic('claude-sonnet-4-20250514'),
    maxTokens: 8000,
    contextWindow: 200_000,
    costPer1MTokens: { input: 3.0, output: 15.0 },
  },
  openai: {
    primary: openai('gpt-4o-mini'),
    maxTokens: 4000,
    contextWindow: 128_000,
    costPer1MTokens: { input: 0.15, output: 0.60 },
  },
}
