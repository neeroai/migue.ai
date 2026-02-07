/**
 * @file providers.ts
 * @description AI Gateway model catalog and cost configuration
 * @module lib/ai
 * @exports MODEL_CATALOG, models
 * @date 2026-02-01 15:15
 * @updated 2026-02-01 15:15
 */

// Model configurations (AI Gateway model strings)
export const models = {
  openai: {
    primary: 'openai/gpt-4o-mini',
    maxTokens: 4000,
    contextWindow: 128_000,
    costPer1MTokens: { input: 0.15, output: 0.60 },
  },
  gemini: {
    primary: 'google/gemini-2.5-flash-lite',
    maxTokens: 4000,
    contextWindow: 1_000_000,
    costPer1MTokens: { input: 0.10, output: 0.40 },
  },
}

// Cost lookup by model name (used for internal tracking)
export const MODEL_CATALOG: Record<
  string,
  { provider: 'openai' | 'gemini'; costPer1MTokens: { input: number; output: number } }
> = {
  'openai/gpt-4o-mini': {
    provider: 'openai',
    costPer1MTokens: { input: 0.15, output: 0.60 },
  },
  'google/gemini-2.5-flash-lite': {
    provider: 'gemini',
    costPer1MTokens: { input: 0.10, output: 0.40 },
  },
}
