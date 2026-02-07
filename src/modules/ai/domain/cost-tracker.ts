/**
 * @file ai-cost-tracker.ts
 * @description Multi-provider AI cost tracking (OpenAI, Gemini)
 * @module lib
 * @exports trackUsage, getBudgetStatus, canAffordRequest, CostTracker
 * @date 2026-02-02 11:00
 * @updated 2026-02-02 11:00
 *
 * Features:
 * - Multi-provider tracking (OpenAI, Gemini)
 * - Real-time usage tracking (token-based)
 * - Daily/monthly budget monitoring
 * - Automatic alerts when limits exceeded
 * - Per-user and per-conversation analytics
 * - Database logging for historical analysis
 */

import type { UsageMetrics, CostMetrics } from '@/src/shared/infra/openai/response-handler'
import { logger } from '../../../shared/observability/logger'
import { getSupabaseServerClient } from '../../../shared/infra/db/supabase'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Budget limits (USD)
 * Can be configured via environment variables or uses defaults
 */
export const BUDGET_LIMITS = {
  dailyMax: parseFloat(process.env.OPENAI_DAILY_LIMIT_USD ?? '3.0'),
  monthlyMax: parseFloat(process.env.OPENAI_MONTHLY_LIMIT_USD ?? '90.0'),
  perUserDailyMax: parseFloat(process.env.OPENAI_PER_USER_DAILY_LIMIT_USD ?? '0.5'),
  emergencyThreshold: 1.0, // Switch to emergency mode at $1 remaining
}

/**
 * Alert thresholds (percentage of limit)
 */
const ALERT_THRESHOLDS = {
  warning: 0.8, // 80% of limit
  critical: 0.95, // 95% of limit
}

// ============================================================================
// Types
// ============================================================================

export type UsageRecord = {
  timestamp: Date
  provider: 'openai' | 'gemini'
  model: string
  usage: UsageMetrics
  cost: CostMetrics
  conversationId?: string
  userId?: string
  messageId?: string
}

export type BudgetStatus = {
  dailySpent: number
  dailyRemaining: number
  dailyLimit: number
  monthlySpent: number
  monthlyRemaining: number
  monthlyLimit: number
  isEmergencyMode: boolean
  percentUsed: number
}

export type UserSpending = {
  userId: string
  dailySpent: number
  monthlySpent: number
  requestCount: number
  lastRequest: Date
}

// ============================================================================
// In-Memory Tracking
// ============================================================================

/**
 * Cost Tracker (Singleton)
 * Tracks spending in-memory for fast budget decisions
 */
export class CostTracker {
  private dailySpent: number = 0
  private monthlySpent: number = 0
  private lastResetDate: string
  private lastMonthResetDate: string
  private userSpending: Map<string, UserSpending> = new Map()
  private usageHistory: UsageRecord[] = []
  private hydrationPromise: Promise<void> | null = null
  private isHydrated: boolean = false
  private budgetStatusCache: { status: BudgetStatus; timestamp: number } | null = null
  private readonly BUDGET_CACHE_TTL_MS = 30_000 // 30 seconds

  constructor() {
    const now = new Date()
    this.lastResetDate = now.toISOString().split('T')[0]! // YYYY-MM-DD
    this.lastMonthResetDate = now.toISOString().slice(0, 7) // YYYY-MM
  }

  /**
   * Hydrate from database (call once at startup)
   * Uses module-level promise pattern: sync getter, async backfill
   */
  async hydrateFromDatabase(): Promise<void> {
    if (this.isHydrated) return
    if (this.hydrationPromise) return this.hydrationPromise

    this.hydrationPromise = (async () => {
      if (process.env.NODE_ENV === 'test') {
        this.isHydrated = true
        return
      }

      try {
        const supabase = getSupabaseServerClient()
        const now = new Date()
        const todayUtc = now.toISOString().split('T')[0]!
        const currentMonthUtc = now.toISOString().slice(0, 7)

        // Query today's spending (using generated usage_date_utc column)
        const { data: dailyData, error: dailyError } = await supabase
          .from('openai_usage')
          .select('total_cost, user_id')
          .eq('usage_date_utc', todayUtc)

        if (dailyError) {
          logger.error('[CostTracker] Failed to hydrate daily spending', dailyError)
        } else if (dailyData) {
          this.dailySpent = dailyData.reduce((sum, row) => sum + Number(row.total_cost), 0)

          // Rebuild user daily spending
          dailyData.forEach((row) => {
            if (row.user_id) {
              const existing = this.userSpending.get(row.user_id)
              const cost = Number(row.total_cost)
              if (existing) {
                existing.dailySpent += cost
              } else {
                this.userSpending.set(row.user_id, {
                  userId: row.user_id,
                  dailySpent: cost,
                  monthlySpent: 0, // Will be filled below
                  requestCount: 1,
                  lastRequest: new Date(),
                })
              }
            }
          })
        }

        // Query this month's spending
        const { data: monthlyData, error: monthlyError } = await supabase
          .from('openai_usage')
          .select('total_cost, user_id')
          .gte('timestamp', `${currentMonthUtc}-01T00:00:00Z`)

        if (monthlyError) {
          logger.error('[CostTracker] Failed to hydrate monthly spending', monthlyError)
        } else if (monthlyData) {
          this.monthlySpent = monthlyData.reduce((sum, row) => sum + Number(row.total_cost), 0)

          // Update user monthly spending
          monthlyData.forEach((row) => {
            if (row.user_id) {
              const existing = this.userSpending.get(row.user_id)
              const cost = Number(row.total_cost)
              if (existing) {
                existing.monthlySpent += cost
              } else {
                this.userSpending.set(row.user_id, {
                  userId: row.user_id,
                  dailySpent: 0, // Only monthly data
                  monthlySpent: cost,
                  requestCount: 1,
                  lastRequest: new Date(),
                })
              }
            }
          })
        }

        this.isHydrated = true
        logger.info('[CostTracker] Hydrated from database', {
          metadata: {
            dailySpent: `$${this.dailySpent.toFixed(4)}`,
            monthlySpent: `$${this.monthlySpent.toFixed(4)}`,
            userCount: this.userSpending.size,
          },
        })
      } catch (error: any) {
        logger.error('[CostTracker] Hydration error', error)
        // Don't throw - allow tracker to continue with zero values
        this.isHydrated = true
      }
    })()

    return this.hydrationPromise
  }

  /**
   * Ensure hydrated before returning budget status
   * Call this once at the start of request processing
   */
  async ensureHydrated(): Promise<void> {
    await this.hydrateFromDatabase()
  }

  /**
   * Check hydration state (useful for cold start gating)
   */
  isHydratedState(): boolean {
    return this.isHydrated
  }

  /**
   * Track a usage record
   * Automatically updates daily/monthly totals and checks budgets
   */
  trackUsage(record: UsageRecord): void {
    // Auto-reset if new day
    this.checkAndResetDaily()
    this.checkAndResetMonthly()

    // Update global spending
    this.dailySpent += record.cost.totalCost
    this.monthlySpent += record.cost.totalCost

    // Invalidate budget status cache
    this.budgetStatusCache = null

    // Update user spending
    if (record.userId) {
      this.trackUserSpending(record.userId, record.cost.totalCost)
    }

    // Add to history (keep last 1000 records in memory)
    this.usageHistory.push(record)
    if (this.usageHistory.length > 1000) {
      this.usageHistory.shift() // Remove oldest
    }

    // Log usage
    this.logUsage(record)

    // Check budget and send alerts if needed
    this.checkBudgetAlerts()

    // Persist to database (fire-and-forget)
    void this.persistUsageToDatabase(record)
  }

  /**
   * Get current budget status
   * Cached for 30s to reduce computation overhead
   */
  getBudgetStatus(): BudgetStatus {
    // Check cache first
    const now = Date.now()
    if (this.budgetStatusCache && (now - this.budgetStatusCache.timestamp) < this.BUDGET_CACHE_TTL_MS) {
      return this.budgetStatusCache.status
    }

    // Cache miss or expired - recompute
    this.checkAndResetDaily()
    this.checkAndResetMonthly()

    const dailyRemaining = Math.max(0, BUDGET_LIMITS.dailyMax - this.dailySpent)
    const monthlyRemaining = Math.max(
      0,
      BUDGET_LIMITS.monthlyMax - this.monthlySpent
    )
    const isEmergencyMode = dailyRemaining < BUDGET_LIMITS.emergencyThreshold
    const percentUsed = (this.dailySpent / BUDGET_LIMITS.dailyMax) * 100

    const status: BudgetStatus = {
      dailySpent: this.dailySpent,
      dailyRemaining,
      dailyLimit: BUDGET_LIMITS.dailyMax,
      monthlySpent: this.monthlySpent,
      monthlyRemaining,
      monthlyLimit: BUDGET_LIMITS.monthlyMax,
      isEmergencyMode,
      percentUsed,
    }

    // Store in cache
    this.budgetStatusCache = { status, timestamp: now }

    return status
  }

  /**
   * Check if user has exceeded their daily budget
   */
  isUserOverBudget(userId: string): boolean {
    const userStats = this.userSpending.get(userId)
    if (!userStats) return false
    return userStats.dailySpent >= BUDGET_LIMITS.perUserDailyMax
  }

  /**
   * Get user spending stats
   */
  getUserSpending(userId: string): UserSpending | null {
    return this.userSpending.get(userId) ?? null
  }

  /**
   * Get daily report
   */
  getDailyReport(): {
    totalSpent: number
    totalRequests: number
    averageCostPerRequest: number
    topUsers: Array<{ userId: string; spent: number }>
  } {
    const users = Array.from(this.userSpending.entries())
      .map(([userId, stats]) => ({ userId, spent: stats.dailySpent }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10)

    const totalRequests = this.usageHistory.filter((record) => {
      const recordDate = record.timestamp.toISOString().split('T')[0]
      return recordDate === this.lastResetDate
    }).length

    return {
      totalSpent: this.dailySpent,
      totalRequests,
      averageCostPerRequest:
        totalRequests > 0 ? this.dailySpent / totalRequests : 0,
      topUsers: users,
    }
  }

  /**
   * Reset daily spending (call at midnight)
   */
  resetDaily(): void {
    logger.info('[CostTracker] Daily budget reset', {
      metadata: {
        previousSpent: `$${this.dailySpent.toFixed(4)}`,
        date: this.lastResetDate,
      },
    })

    this.dailySpent = 0
    this.lastResetDate = new Date().toISOString().split('T')[0]!

    // Reset user daily spending
    this.userSpending.forEach((stats) => {
      stats.dailySpent = 0
    })
  }

  /**
   * Reset monthly spending (call at start of month)
   */
  resetMonthly(): void {
    logger.info('[CostTracker] Monthly budget reset', {
      metadata: {
        previousSpent: `$${this.monthlySpent.toFixed(4)}`,
        month: this.lastMonthResetDate,
      },
    })

    this.monthlySpent = 0
    this.lastMonthResetDate = new Date().toISOString().slice(0, 7)

    // Reset user monthly spending
    this.userSpending.forEach((stats) => {
      stats.monthlySpent = 0
    })
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private checkAndResetDaily(): void {
    const today = new Date().toISOString().split('T')[0]!
    if (today !== this.lastResetDate) {
      this.resetDaily()
    }
  }

  private checkAndResetMonthly(): void {
    const currentMonth = new Date().toISOString().slice(0, 7)
    if (currentMonth !== this.lastMonthResetDate) {
      this.resetMonthly()
    }
  }

  private trackUserSpending(userId: string, cost: number): void {
    const existing = this.userSpending.get(userId)

    if (existing) {
      existing.dailySpent += cost
      existing.monthlySpent += cost
      existing.requestCount += 1
      existing.lastRequest = new Date()
    } else {
      this.userSpending.set(userId, {
        userId,
        dailySpent: cost,
        monthlySpent: cost,
        requestCount: 1,
        lastRequest: new Date(),
      })
    }
  }

  private logUsage(record: UsageRecord): void {
    logger.info('[CostTracker] Usage tracked', {
      ...(record.conversationId && { conversationId: record.conversationId }),
      ...(record.userId && { userId: record.userId }),
      metadata: {
        provider: record.provider,
        model: record.model,
        tokens: record.usage.totalTokens,
        cost: `$${record.cost.totalCost.toFixed(6)}`,
        dailyTotal: `$${this.dailySpent.toFixed(4)}`,
        dailyRemaining: `$${(BUDGET_LIMITS.dailyMax - this.dailySpent).toFixed(4)}`,
        ...(record.messageId && { messageId: record.messageId }),
      },
    })
  }

  private checkBudgetAlerts(): void {
    const status = this.getBudgetStatus()

    // Critical alert (95% of daily budget)
    if (
      status.percentUsed >= ALERT_THRESHOLDS.critical * 100 &&
      status.percentUsed < 100
    ) {
      logger.warn('[CostTracker] CRITICAL: Daily budget almost exceeded!', {
        metadata: {
          spent: `$${status.dailySpent.toFixed(4)}`,
          limit: `$${status.dailyLimit.toFixed(2)}`,
          remaining: `$${status.dailyRemaining.toFixed(4)}`,
          percentUsed: `${status.percentUsed.toFixed(1)}%`,
        },
      })
    }

    // Warning alert (80% of daily budget)
    else if (
      status.percentUsed >= ALERT_THRESHOLDS.warning * 100 &&
      status.percentUsed < ALERT_THRESHOLDS.critical * 100
    ) {
      logger.warn('[CostTracker] WARNING: Daily budget threshold reached', {
        metadata: {
          spent: `$${status.dailySpent.toFixed(4)}`,
          limit: `$${status.dailyLimit.toFixed(2)}`,
          remaining: `$${status.dailyRemaining.toFixed(4)}`,
          percentUsed: `${status.percentUsed.toFixed(1)}%`,
        },
      })
    }

    // Emergency mode
    if (status.isEmergencyMode) {
      logger.warn('[CostTracker] EMERGENCY MODE ACTIVATED', {
        metadata: {
          remaining: `$${status.dailyRemaining.toFixed(4)}`,
          threshold: `$${BUDGET_LIMITS.emergencyThreshold.toFixed(2)}`,
          action: 'Switching to free-tier providers only',
        },
      })
    }
  }

  private async persistUsageToDatabase(record: UsageRecord): Promise<void> {
    if (process.env.NODE_ENV === 'test') return
    try {
      const supabase = getSupabaseServerClient()

      const { error } = await supabase.from('openai_usage').insert({
        provider: record.provider,
        model: record.model,
        prompt_tokens: record.usage.promptTokens,
        completion_tokens: record.usage.completionTokens,
        total_tokens: record.usage.totalTokens,
        input_cost: record.cost.inputCost,
        output_cost: record.cost.outputCost,
        total_cost: record.cost.totalCost,
        conversation_id: record.conversationId ?? null,
        user_id: record.userId ?? null,
        message_id: record.messageId ?? null,
        timestamp: record.timestamp.toISOString(),
      })

      if (error) {
        logger.error('[CostTracker] Failed to persist usage to database', error)
      }
    } catch (error: any) {
      logger.error('[CostTracker] Database persist error', error)
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let costTrackerInstance: CostTracker | null = null

export function getCostTracker(): CostTracker {
  if (!costTrackerInstance) {
    costTrackerInstance = new CostTracker()
  }
  return costTrackerInstance
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Track usage (convenience wrapper)
 * @param provider - AI provider ('openai' | 'gemini')
 * @param model - Model name (e.g., 'gpt-4o-mini', 'gemini-2.5-flash-lite')
 * @param usage - Usage metrics (tokens)
 * @param cost - Cost metrics (USD)
 * @param context - Optional context (conversationId, userId, messageId)
 */
export function trackUsage(
  provider: 'openai' | 'gemini',
  model: string,
  usage: UsageMetrics,
  cost: CostMetrics,
  context?: {
    conversationId?: string
    userId?: string
    messageId?: string
  }
): void {
  const tracker = getCostTracker()
  tracker.trackUsage({
    timestamp: new Date(),
    provider,
    model,
    usage,
    cost,
    ...context,
  })
}

/**
 * Get budget status (convenience wrapper)
 */
export function getBudgetStatus(): BudgetStatus {
  return getCostTracker().getBudgetStatus()
}

/**
 * Check if daily budget allows new request
 */
export function canAffordRequest(estimatedCost: number = 0.001): boolean {
  const status = getBudgetStatus()
  return status.dailyRemaining >= estimatedCost
}

/**
 * Check if user is over budget
 */
export function isUserOverBudget(userId: string): boolean {
  return getCostTracker().isUserOverBudget(userId)
}
