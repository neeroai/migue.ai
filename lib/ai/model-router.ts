/**
 * @file model-router.ts
 * @description Model selection and routing configuration for cost-optimized AI responses
 * @module lib/ai
 * @exports selectModel, getModelInstance, ModelConfig, MODEL_CONFIGS
 * @date 2026-01-30 14:00
 * @updated 2026-01-30 14:00
 */

import type { TaskCategory } from './task-classifier';

export interface ModelConfig {
  primary: string;
  fallback: string;
  maxTokens: number;
  temperature: number;
  costPerToken: { input: number; output: number }; // $/1M tokens
  provider: 'google' | 'cohere' | 'openai' | 'deepseek' | 'mistral';
}

/**
 * Model configurations optimized per task category
 *
 * Cost savings vs Claude Sonnet 4.5 ($3/$15 per 1M):
 * - Gemini 3 Flash: 97% cheaper ($0.08/$0.30)
 * - Cohere R7B: 99% cheaper ($0.037/$0.15)
 * - DeepSeek R1: 95% cheaper ($0.28/$0.42)
 * - GPT-4o: 50% cheaper ($2.50/$10.00)
 */
export const MODEL_CONFIGS: Record<TaskCategory, ModelConfig> = {
  'simple-query': {
    primary: 'google/gemini-3-flash',
    fallback: 'deepseek/deepseek-r1-turbo',
    maxTokens: 500,
    temperature: 0.3,
    costPerToken: { input: 0.08, output: 0.30 },
    provider: 'google'
  },
  'single-tool': {
    primary: 'cohere/command-r7b',
    fallback: 'openai/gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.5,
    costPerToken: { input: 0.037, output: 0.15 },
    provider: 'cohere'
  },
  'multi-tool': {
    primary: 'cohere/command-r7b',
    fallback: 'openai/gpt-4o',
    maxTokens: 2000,
    temperature: 0.7,
    costPerToken: { input: 0.037, output: 0.15 },
    provider: 'cohere'
  },
  'voice-message': {
    primary: 'google/gemini-2.5-flash',
    fallback: 'openai/gpt-4o',
    maxTokens: 1500,
    temperature: 0.5,
    costPerToken: { input: 0.10, output: 0.40 },
    provider: 'google'
  },
  'image-document': {
    primary: 'google/gemini-2.5-flash',
    fallback: 'openai/gpt-4o',
    maxTokens: 2000,
    temperature: 0.3,
    costPerToken: { input: 0.10, output: 0.40 },
    provider: 'google'
  },
  'spanish-conversation': {
    primary: 'openai/gpt-4o',
    fallback: 'mistral/magistral',
    maxTokens: 1500,
    temperature: 0.7,
    costPerToken: { input: 2.50, output: 10.00 },
    provider: 'openai'
  },
  'complex-reasoning': {
    primary: 'deepseek/deepseek-r1-turbo',
    fallback: 'openai/gpt-4o',
    maxTokens: 3000,
    temperature: 0.8,
    costPerToken: { input: 0.28, output: 0.42 },
    provider: 'deepseek'
  },
  'fallback': {
    primary: 'openai/gpt-4o-mini',
    fallback: 'google/gemini-3-flash',
    maxTokens: 2000,
    temperature: 0.5,
    costPerToken: { input: 0.15, output: 0.60 },
    provider: 'openai'
  }
};

/**
 * Provider-to-SDK mapping for Vercel AI SDK
 */
const PROVIDER_SDK_MAP = {
  google: '@ai-sdk/google',
  cohere: '@ai-sdk/cohere',
  openai: '@ai-sdk/openai',
  deepseek: '@ai-sdk/deepseek',
  mistral: '@ai-sdk/mistral'
} as const;

/**
 * Select model configuration based on task category
 *
 * @param category - Task category from classifier
 * @param useFallback - Force fallback model (circuit breaker triggered)
 * @returns ModelConfig with primary/fallback models and parameters
 */
export function selectModel(
  category: TaskCategory,
  useFallback: boolean = false
): ModelConfig {
  const config = MODEL_CONFIGS[category];

  if (useFallback) {
    // Swap primary and fallback
    return {
      ...config,
      primary: config.fallback,
      fallback: config.primary
    };
  }

  return config;
}

/**
 * Get model instance ID for Vercel AI SDK
 *
 * @param modelId - Model ID (e.g., 'google/gemini-3-flash')
 * @returns Model identifier for AI SDK
 */
export function getModelInstance(modelId: string): string {
  return modelId;
}

/**
 * Get provider from model ID
 *
 * @param modelId - Model ID (e.g., 'google/gemini-3-flash')
 * @returns Provider name
 */
export function getProvider(modelId: string): keyof typeof PROVIDER_SDK_MAP {
  const provider = modelId.split('/')[0] as keyof typeof PROVIDER_SDK_MAP;
  if (!PROVIDER_SDK_MAP[provider]) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return provider;
}

/**
 * Get required SDK package for provider
 *
 * @param provider - Provider name
 * @returns NPM package name
 */
export function getProviderSDK(provider: keyof typeof PROVIDER_SDK_MAP): string {
  return PROVIDER_SDK_MAP[provider];
}
