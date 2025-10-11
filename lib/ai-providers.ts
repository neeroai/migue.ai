/**
 * Multi-Provider AI System
 * Intelligent selection between Gemini, OpenAI, Groq, and Claude based on cost/quality
 *
 * Cost optimization:
 * - Gemini 2.5 Flash: FREE (1,500 req/day free tier) - PRIMARY
 * - OpenAI GPT-4o-mini: $0.15/$0.60 per 1M tokens (Fallback #1)
 * - Groq Whisper: $0.05/hour (93% cheaper than OpenAI Whisper)
 * - Tesseract OCR: Free (100% savings vs GPT-4 Vision)
 * - Claude Sonnet: $3/$15 per 1M tokens (Emergency fallback)
 */

import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { getOpenAIClient } from './openai'
import { getGeminiClient, canUseFreeTier } from './gemini-client'
import { logger } from './logger'

export type TaskType = 'chat' | 'transcription' | 'ocr' | 'long_task' | 'streaming'

export type ProviderName = 'claude' | 'groq' | 'openai' | 'tesseract' | 'gemini'

/**
 * Cost limits and budgets
 */
export const COST_LIMITS = {
  dailyMax: 10.00,      // $10/day maximum
  perUserMax: 0.50,     // $0.50/user maximum
  emergencyMode: 1.00,  // Switch to free/cheap providers at $1 remaining
}

/**
 * Provider costs per task (estimated in dollars)
 */
export const PROVIDER_COSTS = {
  chat: {
    gemini: 0,         // FREE (1,500 req/day free tier)
    openai: 0.00005,   // ~$0.00005 per message (GPT-4o-mini, 500 tokens)
    claude: 0.0003,    // Emergency fallback
  },
  transcription: {
    groq: 0.0008,      // $0.05/hour ≈ $0.0008/minute
    openai: 0.006,     // $0.006/minute (Whisper)
  },
  ocr: {
    tesseract: 0,      // Free!
    gemini: 0,         // Free (multi-modal support)
    claude: 0.0002,    // Vision capability
    openai: 0.002,     // GPT-4 Vision
  },
}

/**
 * AI Provider Manager
 * Selects optimal provider based on task type, cost budget, and fallback strategy
 */
export class AIProviderManager {
  private anthropic: Anthropic
  private groq: Groq
  private dailySpent: number = 0

  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const groqKey = process.env.GROQ_API_KEY

    if (!anthropicKey) {
      logger.warn('ANTHROPIC_API_KEY not set - Claude unavailable, will use OpenAI fallback')
    }
    if (!groqKey) {
      logger.warn('GROQ_API_KEY not set - Groq transcription unavailable, will use OpenAI Whisper')
    }

    // Only initialize clients if API keys are provided
    // Using dummy key 'missing' to prevent SDK errors during initialization
    this.anthropic = new Anthropic({
      apiKey: anthropicKey || 'sk-ant-missing',
    })

    this.groq = new Groq({
      apiKey: groqKey || 'gsk-missing',
    })
  }

  /**
   * Select best provider for task considering budget
   */
  async selectProvider(task: TaskType): Promise<ProviderName> {
    const remainingBudget = COST_LIMITS.dailyMax - this.dailySpent

    // Check if Gemini free tier is available
    const geminiAvailable = process.env.GOOGLE_AI_API_KEY && canUseFreeTier()

    // Emergency mode: use only free/cheap options
    if (remainingBudget < COST_LIMITS.emergencyMode) {
      logger.warn(`Low budget: $${remainingBudget.toFixed(2)} remaining`)

      switch (task) {
        case 'chat':
        case 'streaming':
        case 'long_task':
          if (geminiAvailable) return 'gemini' // FREE
          return 'openai' // Fallback
        case 'transcription':
          return 'groq' // Cheapest audio
        case 'ocr':
          if (geminiAvailable) return 'gemini' // FREE with multi-modal
          return 'tesseract' // Free OCR
        default:
          return geminiAvailable ? 'gemini' : 'openai'
      }
    }

    // Normal mode: prioritize free options, then optimize by task
    switch (task) {
      case 'chat':
      case 'streaming':
      case 'long_task':
        if (geminiAvailable) {
          logger.info('Using Gemini (FREE tier)')
          return 'gemini'
        }
        return 'openai' // GPT-4o-mini fallback

      case 'transcription':
        return 'groq' // 93% cheaper than OpenAI

      case 'ocr':
        if (geminiAvailable) return 'gemini' // FREE multi-modal
        return 'tesseract' // Free OCR fallback

      default:
        if (geminiAvailable) return 'gemini'
        return 'openai'
    }
  }

  /**
   * Get Claude client
   * @throws Error if ANTHROPIC_API_KEY is not set
   */
  getClaude(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not set - cannot use Claude')
    }
    return this.anthropic
  }

  /**
   * Get Groq client
   * @throws Error if GROQ_API_KEY is not set
   */
  getGroq(): Groq {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not set - cannot use Groq')
    }
    return this.groq
  }

  /**
   * Get OpenAI client (fallback)
   */
  getOpenAI() {
    return getOpenAIClient()
  }

  /**
   * Get Gemini client
   * @returns GoogleGenerativeAI client instance
   */
  getGemini() {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not set - cannot use Gemini')
    }
    return getGeminiClient()
  }

  /**
   * Track spending
   */
  trackSpending(amount: number, provider: ProviderName, task: TaskType) {
    this.dailySpent += amount
    logger.info('Cost tracked', {
      metadata: {
        provider,
        task,
        amount: `$${amount.toFixed(4)}`,
        dailyTotal: `$${this.dailySpent.toFixed(2)}`,
        remaining: `$${(COST_LIMITS.dailyMax - this.dailySpent).toFixed(2)}`,
      },
    })
  }

  /**
   * Get current spending status
   */
  getSpendingStatus() {
    return {
      spent: this.dailySpent,
      remaining: COST_LIMITS.dailyMax - this.dailySpent,
      limit: COST_LIMITS.dailyMax,
      emergencyMode: this.dailySpent >= (COST_LIMITS.dailyMax - COST_LIMITS.emergencyMode),
    }
  }

  /**
   * Reset daily spending (call via cron at midnight)
   */
  resetDailySpending() {
    logger.info(`Daily spending reset. Previous: $${this.dailySpent.toFixed(2)}`)
    this.dailySpent = 0
  }
}

// Singleton instance
let providerManager: AIProviderManager | null = null

export function getProviderManager(): AIProviderManager {
  if (!providerManager) {
    providerManager = new AIProviderManager()
  }
  return providerManager
}
