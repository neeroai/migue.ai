/**
 * OpenAI Cost Tracker Tests
 * Tests for budget monitoring and usage tracking
 */

import {
  CostTracker,
  BUDGET_LIMITS,
  trackUsage,
  getBudgetStatus,
  canAffordRequest,
} from '../../lib/ai-cost-tracker'
import type { UsageMetrics, CostMetrics } from '../../lib/openai-response-handler'

describe('openai-cost-tracker', () => {
  let tracker: CostTracker

  beforeEach(() => {
    tracker = new CostTracker()
  })

  describe('CostTracker', () => {
    it('should initialize with zero spending', () => {
      const status = tracker.getBudgetStatus()

      expect(status.dailySpent).toBe(0)
      expect(status.monthlySpent).toBe(0)
      expect(status.dailyRemaining).toBe(BUDGET_LIMITS.dailyMax)
      expect(status.monthlyRemaining).toBe(BUDGET_LIMITS.monthlyMax)
      expect(status.isEmergencyMode).toBe(false)
      expect(status.percentUsed).toBe(0)
    })

    it('should track usage and update spending', () => {
      const usage: UsageMetrics = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost: CostMetrics = {
        inputCost: 0.00015,
        outputCost: 0.0003,
        totalCost: 0.00045,
        model: 'gpt-4o-mini',
      }

      tracker.trackUsage({
        timestamp: new Date(),
        model: 'gpt-4o-mini',
        usage,
        cost,
        userId: 'user123',
      })

      const status = tracker.getBudgetStatus()

      expect(status.dailySpent).toBeCloseTo(0.00045, 6)
      expect(status.monthlySpent).toBeCloseTo(0.00045, 6)
      expect(status.dailyRemaining).toBeCloseTo(
        BUDGET_LIMITS.dailyMax - 0.00045,
        6
      )
    })

    it('should track multiple requests', () => {
      const usage: UsageMetrics = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost: CostMetrics = {
        inputCost: 0.00015,
        outputCost: 0.0003,
        totalCost: 0.00045,
        model: 'gpt-4o-mini',
      }

      // Track 3 requests
      for (let i = 0; i < 3; i++) {
        tracker.trackUsage({
          timestamp: new Date(),
          model: 'gpt-4o-mini',
          usage,
          cost,
          userId: 'user123',
        })
      }

      const status = tracker.getBudgetStatus()

      expect(status.dailySpent).toBeCloseTo(0.00045 * 3, 6)
      expect(status.monthlySpent).toBeCloseTo(0.00045 * 3, 6)
    })

    it('should enter emergency mode when budget low', () => {
      const usage: UsageMetrics = {
        promptTokens: 100000,
        completionTokens: 50000,
        totalTokens: 150000,
      }

      // Spend close to daily limit ($2.50 out of $3.00, leaving $0.50 remaining)
      const cost: CostMetrics = {
        inputCost: 0.015,
        outputCost: 0.03,
        totalCost: 2.5, // $2.50, leaves $0.50 remaining (below $1 threshold)
        model: 'gpt-4o-mini',
      }

      tracker.trackUsage({
        timestamp: new Date(),
        model: 'gpt-4o-mini',
        usage,
        cost,
        userId: 'user123',
      })

      const status = tracker.getBudgetStatus()

      expect(status.isEmergencyMode).toBe(true)
      expect(status.dailyRemaining).toBeLessThan(
        BUDGET_LIMITS.emergencyThreshold
      )
    })

    it('should track per-user spending', () => {
      const usage: UsageMetrics = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost: CostMetrics = {
        inputCost: 0.00015,
        outputCost: 0.0003,
        totalCost: 0.00045,
        model: 'gpt-4o-mini',
      }

      // Track for user1
      tracker.trackUsage({
        timestamp: new Date(),
        model: 'gpt-4o-mini',
        usage,
        cost,
        userId: 'user1',
      })

      // Track for user2
      tracker.trackUsage({
        timestamp: new Date(),
        model: 'gpt-4o-mini',
        usage,
        cost,
        userId: 'user2',
      })

      const user1Stats = tracker.getUserSpending('user1')
      const user2Stats = tracker.getUserSpending('user2')

      expect(user1Stats?.dailySpent).toBeCloseTo(0.00045, 6)
      expect(user2Stats?.dailySpent).toBeCloseTo(0.00045, 6)
      expect(user1Stats?.requestCount).toBe(1)
      expect(user2Stats?.requestCount).toBe(1)
    })

    it('should detect when user is over budget', () => {
      const usage: UsageMetrics = {
        promptTokens: 100000,
        completionTokens: 50000,
        totalTokens: 150000,
      }

      // Spend over per-user limit
      const cost: CostMetrics = {
        inputCost: 0.015,
        outputCost: 0.03,
        totalCost: 0.6, // $0.60, over $0.50 per-user limit
        model: 'gpt-4o-mini',
      }

      tracker.trackUsage({
        timestamp: new Date(),
        model: 'gpt-4o-mini',
        usage,
        cost,
        userId: 'user123',
      })

      expect(tracker.isUserOverBudget('user123')).toBe(true)
    })

    it('should generate daily report', () => {
      const usage: UsageMetrics = {
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      }

      const cost: CostMetrics = {
        inputCost: 0.00015,
        outputCost: 0.0003,
        totalCost: 0.00045,
        model: 'gpt-4o-mini',
      }

      // Track requests for 3 different users
      ;['user1', 'user2', 'user3'].forEach((userId) => {
        tracker.trackUsage({
          timestamp: new Date(),
          model: 'gpt-4o-mini',
          usage,
          cost,
          userId,
        })
      })

      const report = tracker.getDailyReport()

      expect(report.totalSpent).toBeCloseTo(0.00045 * 3, 6)
      expect(report.totalRequests).toBe(3)
      expect(report.averageCostPerRequest).toBeCloseTo(0.00045, 6)
      expect(report.topUsers).toHaveLength(3)
    })
  })

  describe('convenience functions', () => {
    it('should check if request can be afforded', () => {
      // Initially, budget is available
      expect(canAffordRequest(0.001)).toBe(true)

      // Spend almost all budget ($2.99 out of $3.00 daily limit)
      trackUsage(
        'openai',
        'gpt-4o-mini',
        { promptTokens: 100000, completionTokens: 50000, totalTokens: 150000 },
        { inputCost: 0.015, outputCost: 0.03, totalCost: 2.99, model: 'gpt-4o-mini' },
        { userId: 'user123' }
      )

      // Now large request should not be affordable
      expect(canAffordRequest(1.0)).toBe(false)
      // But small request still OK ($0.01 remaining)
      expect(canAffordRequest(0.001)).toBe(true)
    })
  })
})
