/**
 * Multi-Provider AI System
 * Intelligent selection between Claude, Groq, and OpenAI based on cost/quality
 *
 * Cost optimization:
 * - Claude Sonnet 4.5: $3/$15 per 1M tokens (75% cheaper than GPT-4o)
 * - Groq Whisper: $0.05/hour (93% cheaper than OpenAI Whisper)
 * - Tesseract OCR: Free (100% savings vs GPT-4 Vision)
 */

import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { getOpenAIClient } from './openai'
import { logger } from './logger'

export type TaskType = 'chat' | 'transcription' | 'ocr' | 'long_task' | 'streaming'

export type ProviderName = 'claude' | 'groq' | 'openai' | 'tesseract'

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
    claude: 0.0003,    // ~$0.0003 per message (500 tokens)
    openai: 0.0015,    // ~$0.0015 per message (GPT-4o)
  },
  transcription: {
    groq: 0.0008,      // $0.05/hour ≈ $0.0008/minute
    openai: 0.006,     // $0.006/minute (Whisper)
  },
  ocr: {
    tesseract: 0,      // Free!
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
      logger.warn('ANTHROPIC_API_KEY not set - Claude unavailable')
    }
    if (!groqKey) {
      logger.warn('GROQ_API_KEY not set - Groq transcription unavailable')
    }

    this.anthropic = new Anthropic({
      apiKey: anthropicKey || '',
    })

    this.groq = new Groq({
      apiKey: groqKey || '',
    })
  }

  /**
   * Select best provider for task considering budget
   */
  async selectProvider(task: TaskType): Promise<ProviderName> {
    const remainingBudget = COST_LIMITS.dailyMax - this.dailySpent

    // Emergency mode: use only free/cheap options
    if (remainingBudget < COST_LIMITS.emergencyMode) {
      logger.warn(`Low budget: $${remainingBudget.toFixed(2)} remaining`)

      switch (task) {
        case 'chat':
          return 'openai' // Fallback to existing
        case 'transcription':
          return 'groq' // Cheapest audio
        case 'ocr':
          return 'tesseract' // Free
        default:
          return 'openai'
      }
    }

    // Normal mode: select based on task optimization
    switch (task) {
      case 'chat':
      case 'streaming':
      case 'long_task':
        return 'claude' // Best quality/price for chat

      case 'transcription':
        return 'groq' // 93% cheaper than OpenAI

      case 'ocr':
        return 'tesseract' // Free OCR

      default:
        return 'claude'
    }
  }

  /**
   * Get Claude client
   */
  getClaude(): Anthropic {
    return this.anthropic
  }

  /**
   * Get Groq client
   */
  getGroq(): Groq {
    return this.groq
  }

  /**
   * Get OpenAI client (fallback)
   */
  getOpenAI() {
    return getOpenAIClient()
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
