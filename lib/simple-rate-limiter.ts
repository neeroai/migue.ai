/**
 * Simple Rate Limiter - In-Memory Throttling
 *
 * CRITICAL FIX (2025-10-11): Prevent burst attacks and spam
 * - Minimum 5 seconds between messages per user
 * - In-memory tracking (resets on cold start, but good enough for MVP)
 *
 * Future improvements:
 * - Persist in Supabase for cross-instance rate limiting
 * - Configurable limits per user type (free vs paid)
 * - Exponential backoff for repeat offenders
 */

import { logger } from './logger'

// Track last message timestamp per phone number
const userLastMessage = new Map<string, number>()

// Configuration
const MIN_INTERVAL_MS = 5000 // 5 seconds between messages
const CLEANUP_INTERVAL_MS = 300000 // Clean up old entries every 5 minutes

/**
 * Check if user is within rate limit
 *
 * @param phoneNumber User's phone number (unique identifier)
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now()
  const lastMessageTime = userLastMessage.get(phoneNumber)

  // First message from this user - allow
  if (!lastMessageTime) {
    userLastMessage.set(phoneNumber, now)
    return true
  }

  // Calculate time since last message
  const timeSinceLastMessage = now - lastMessageTime

  // Too fast - rate limited
  if (timeSinceLastMessage < MIN_INTERVAL_MS) {
    logger.warn('[rate-limiter] User rate limited', {
      metadata: {
        phoneNumber: phoneNumber.slice(0, 8) + '***', // Privacy: mask phone
        timeSinceLastMessage,
        minInterval: MIN_INTERVAL_MS,
        waitTime: MIN_INTERVAL_MS - timeSinceLastMessage
      }
    })
    return false
  }

  // Allowed - update last message time
  userLastMessage.set(phoneNumber, now)
  return true
}

/**
 * Get remaining wait time for rate limited user
 *
 * @param phoneNumber User's phone number
 * @returns milliseconds until next message allowed (0 if allowed now)
 */
export function getRateLimitWaitTime(phoneNumber: string): number {
  const lastMessageTime = userLastMessage.get(phoneNumber)

  if (!lastMessageTime) {
    return 0 // No history - allowed immediately
  }

  const timeSinceLastMessage = Date.now() - lastMessageTime
  const waitTime = MIN_INTERVAL_MS - timeSinceLastMessage

  return waitTime > 0 ? waitTime : 0
}

/**
 * Reset rate limit for a user (for testing or admin override)
 *
 * @param phoneNumber User's phone number
 */
export function resetRateLimit(phoneNumber: string): void {
  userLastMessage.delete(phoneNumber)
  logger.debug('[rate-limiter] Rate limit reset', {
    metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' }
  })
}

/**
 * Periodic cleanup of old entries to prevent memory leak
 * Called automatically via setInterval
 */
function cleanupOldEntries(): void {
  const now = Date.now()
  const maxAge = 3600000 // 1 hour
  let removedCount = 0

  for (const [phoneNumber, timestamp] of userLastMessage.entries()) {
    if (now - timestamp > maxAge) {
      userLastMessage.delete(phoneNumber)
      removedCount++
    }
  }

  if (removedCount > 0) {
    logger.debug('[rate-limiter] Cleanup completed', {
      metadata: { removedEntries: removedCount, remainingEntries: userLastMessage.size }
    })
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS)

/**
 * Get current stats (for monitoring/debugging)
 */
export function getRateLimiterStats(): {
  trackedUsers: number
  minInterval: number
} {
  return {
    trackedUsers: userLastMessage.size,
    minInterval: MIN_INTERVAL_MS
  }
}
