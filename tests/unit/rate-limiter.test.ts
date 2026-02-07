/**
 * Rate Limiter Tests - Critical Fix #3 (2025-10-11)
 *
 * Tests for the rate limiting system that prevents spam attacks and burst costs
 * Context: $277 incident - burst of messages without throttling
 *
 * REGRESSION TEST: These tests MUST pass after implementing rate limiting
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import {
  checkRateLimit,
  getRateLimitWaitTime,
  resetRateLimit,
  getRateLimiterStats,
} from '../../src/modules/webhook/domain/rate-limiter'

describe('Rate Limiter - Critical Fix #3', () => {
  const testPhone = '+573001234567'
  const MIN_INTERVAL_MS = 5000 // 5 seconds

  beforeEach(() => {
    // Reset rate limit before each test
    resetRateLimit(testPhone)
  })

  describe('checkRateLimit()', () => {
    it('should allow first message from user', () => {
      const isAllowed = checkRateLimit(testPhone)
      expect(isAllowed).toBe(true)
    })

    it('should block message within 5 seconds', () => {
      // First message - allowed
      const first = checkRateLimit(testPhone)
      expect(first).toBe(true)

      // Immediate second message - blocked
      const second = checkRateLimit(testPhone)
      expect(second).toBe(false)
    })

    it('should allow message after 5 seconds', async () => {
      // First message - allowed
      const first = checkRateLimit(testPhone)
      expect(first).toBe(true)

      // Wait 5 seconds
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS))

      // Second message after 5s - allowed
      const second = checkRateLimit(testPhone)
      expect(second).toBe(true)
    })

    it('should track different users independently', () => {
      const phone1 = '+573001111111'
      const phone2 = '+573002222222'

      // Both users can send first message
      expect(checkRateLimit(phone1)).toBe(true)
      expect(checkRateLimit(phone2)).toBe(true)

      // Both blocked immediately after
      expect(checkRateLimit(phone1)).toBe(false)
      expect(checkRateLimit(phone2)).toBe(false)
    })

    it('should prevent burst attack (50 rapid messages)', () => {
      const phone = '+573009999999'

      // First message allowed
      expect(checkRateLimit(phone)).toBe(true)

      // Next 49 messages all blocked
      for (let i = 0; i < 49; i++) {
        const result = checkRateLimit(phone)
        expect(result).toBe(false)
      }
    })
  })

  describe('getRateLimitWaitTime()', () => {
    it('should return 0 for first-time user', () => {
      const waitTime = getRateLimitWaitTime(testPhone)
      expect(waitTime).toBe(0)
    })

    it('should return remaining wait time after message', () => {
      // Send first message
      checkRateLimit(testPhone)

      // Check wait time (should be ~5000ms)
      const waitTime = getRateLimitWaitTime(testPhone)
      expect(waitTime).toBeGreaterThan(4900) // Account for execution time
      expect(waitTime).toBeLessThanOrEqual(MIN_INTERVAL_MS)
    })

    it('should return 0 after wait period expires', async () => {
      // Send first message
      checkRateLimit(testPhone)

      // Wait 5 seconds
      await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS))

      // Wait time should be 0
      const waitTime = getRateLimitWaitTime(testPhone)
      expect(waitTime).toBe(0)
    })
  })

  describe('resetRateLimit()', () => {
    it('should allow message immediately after reset', () => {
      // First message
      checkRateLimit(testPhone)

      // Should be blocked
      expect(checkRateLimit(testPhone)).toBe(false)

      // Reset
      resetRateLimit(testPhone)

      // Should be allowed now
      expect(checkRateLimit(testPhone)).toBe(true)
    })
  })

  describe('getRateLimiterStats()', () => {
    it('should return current statistics', () => {
      const stats = getRateLimiterStats()

      expect(stats).toHaveProperty('trackedUsers')
      expect(stats).toHaveProperty('minInterval')
      expect(stats.minInterval).toBe(MIN_INTERVAL_MS)
      expect(typeof stats.trackedUsers).toBe('number')
    })

    it('should track user count', () => {
      // Use unique phone numbers to avoid conflicts with other tests
      const uniquePhone1 = `+5730011${Date.now()}11`
      const uniquePhone2 = `+5730022${Date.now()}22`
      const uniquePhone3 = `+5730033${Date.now()}33`

      const initialStats = getRateLimiterStats()
      const initialCount = initialStats.trackedUsers

      // Add 3 new users
      checkRateLimit(uniquePhone1)
      checkRateLimit(uniquePhone2)
      checkRateLimit(uniquePhone3)

      const newStats = getRateLimiterStats()
      // Should have at least 3 more users (might be more if other tests ran)
      expect(newStats.trackedUsers).toBeGreaterThan(initialCount)
      expect(newStats.trackedUsers - initialCount).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined phone number', () => {
      // @ts-expect-error Testing edge case
      const result = checkRateLimit(undefined)
      // Should not crash - result can be true or false
      expect(typeof result).toBe('boolean')
    })

    it('should handle empty string phone', () => {
      const result = checkRateLimit('')
      expect(typeof result).toBe('boolean')
    })

    it('should handle very long phone number', () => {
      const longPhone = '+' + '1'.repeat(100)
      const result = checkRateLimit(longPhone)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('$277 Incident Prevention', () => {
    it('should prevent burst attack scenario (REGRESSION TEST)', () => {
      const phone = '+573005555555'
      let allowed = 0
      let blocked = 0

      // Simulate 100 rapid messages (like the $277 incident)
      for (let i = 0; i < 100; i++) {
        if (checkRateLimit(phone)) {
          allowed++
        } else {
          blocked++
        }
      }

      // Only 1 message should be allowed
      expect(allowed).toBe(1)
      expect(blocked).toBe(99)
    })

    it('should limit to max 12 messages per minute', () => {
      const phone = '+573006666666'
      let allowed = 0

      // Try to send 1 message every 5 seconds = 12 per minute
      // But we can only test synchronously, so we just check the limit exists
      const firstAllowed = checkRateLimit(phone)
      expect(firstAllowed).toBe(true)
      allowed++

      // All subsequent attempts in same tick are blocked
      for (let i = 0; i < 11; i++) {
        const result = checkRateLimit(phone)
        if (result) allowed++
      }

      // Only 1 should be allowed (no time passed)
      expect(allowed).toBe(1)
    })
  })
})
