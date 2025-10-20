/**
 * Multi-Provider AI System
 * Intelligent selection between OpenAI and Claude based on cost/quality
 *
 * Cost optimization:
 * - OpenAI GPT-4o-mini: $0.15/$0.60 per 1M tokens - PRIMARY (96% cheaper than Claude)
 * - OpenAI Whisper: $0.36/hour (Audio transcription)
 * - Tesseract OCR: Free (100% savings vs GPT-4 Vision)
 * - Claude Sonnet: $3/$15 per 1M tokens (Fallback)
 */

import Anthropic from '@anthropic-ai/sdk'
import { getOpenAIClient } from './openai'
import { logger } from './logger'

export type TaskType = 'chat' | 'transcription' | 'ocr' | 'long_task' | 'streaming'

export type ProviderName = 'claude' | 'openai' | 'tesseract'

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
    openai: 0.00005,   // ~$0.00005 per message (GPT-4o-mini, 500 tokens)
    claude: 0.0003,    // Fallback
  },
  transcription: {
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
  private dailySpent: number = 0

  constructor() {
    const anthropicKey = process.env.ANTHROPIC_API_KEY

    if (!anthropicKey) {
      logger.warn('ANTHROPIC_API_KEY not set - Claude unavailable, will use OpenAI fallback')
    }

    // Only initialize clients if API keys are provided
    // Using dummy key 'missing' to prevent SDK errors during initialization
    this.anthropic = new Anthropic({
      apiKey: anthropicKey || 'sk-ant-missing',
    })
  }

  /**
   * Select best provider for task considering budget
   * @returns Provider name or null if emergency stop is enabled
   */
  async selectProvider(task: TaskType): Promise<ProviderName | null> {
    // CRITICAL: Emergency kill switch for cost control
    // Set AI_EMERGENCY_STOP=true in Vercel Dashboard to disable all AI processing
    if (process.env.AI_EMERGENCY_STOP === 'true') {
      logger.warn('[emergency] AI processing disabled via kill switch', {
        metadata: {
          task,
          envVariable: 'AI_EMERGENCY_STOP=true',
          action: 'All AI requests blocked'
        }
      })
      return null
    }

    const remainingBudget = COST_LIMITS.dailyMax - this.dailySpent

    // Emergency mode: use only free/cheap options
    if (remainingBudget < COST_LIMITS.emergencyMode) {
      logger.warn(`Low budget: $${remainingBudget.toFixed(2)} remaining`)

      switch (task) {
        case 'chat':
        case 'streaming':
        case 'long_task':
          return 'openai' // GPT-4o-mini
        case 'transcription':
          return 'openai' // OpenAI Whisper
        case 'ocr':
          return 'tesseract' // Free OCR
        default:
          return 'openai'
      }
    }

    // Normal mode: OpenAI primary, Claude fallback
    switch (task) {
      case 'chat':
      case 'streaming':
      case 'long_task':
        logger.info('Using OpenAI GPT-4o-mini (primary provider)')
        return 'openai' // GPT-4o-mini primary

      case 'transcription':
        return 'openai' // OpenAI Whisper

      case 'ocr':
        return 'tesseract' // Free OCR primary

      default:
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
   * Get OpenAI client (primary provider)
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
