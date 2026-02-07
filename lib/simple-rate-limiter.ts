/**
 * @file Simple Rate Limiter
 * @description In-memory rate limiting with 5-second minimum interval per user, automatic cleanup, and monitoring stats for Edge Runtime spam prevention
 * @module lib/simple-rate-limiter
 * @exports checkRateLimit, getRateLimitWaitTime, resetRateLimit, getRateLimiterStats
 * @runtime edge
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { logger } from './logger'

// Track last message timestamp per phone number
const userLastMessage = new Map<string, number>()

// Configuration
const MIN_INTERVAL_MS = 5000 // 5 seconds between messages
const CLEANUP_INTERVAL_MS = 300000 // Clean up old entries every 5 minutes

/**
 * Check if user is within rate limit
 * Enforces 5-second minimum interval between messages per phone number.
 * First message from user always allowed. In-memory tracking (resets on Edge Function cold start).
 * Logs warning with masked phone when rate limited.
 *
 * @param {string} phoneNumber - User's phone number (unique identifier, e.g., '1234567890')
 * @returns {boolean} true if allowed (5+ seconds since last message or first message), false if rate limited
 * @example
 * if (!checkRateLimit(phoneNumber)) {
 *   return new Response('Rate limited', { status: 429 });
 * }
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
 * Calculates milliseconds until user can send next message based on 5-second minimum interval.
 * Returns 0 if user has no history or can send immediately.
 *
 * @param {string} phoneNumber - User's phone number
 * @returns {number} Milliseconds until next message allowed (0 if allowed now, positive if rate limited)
 * @example
 * const waitMs = getRateLimitWaitTime(phoneNumber);
 * if (waitMs > 0) {
 *   await sendWhatsAppText(phoneNumber, `Please wait ${Math.ceil(waitMs / 1000)}s`);
 * }
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
 * Reset rate limit for a user
 * Clears rate limit state for phone number, allowing immediate next message.
 * Use in tests to reset state or for admin override. Logs debug message with masked phone.
 *
 * @param {string} phoneNumber - User's phone number to reset
 * @returns {void}
 * @example
 * // In test teardown
 * resetRateLimit('1234567890');
 *
 * // Admin override for VIP user
 * if (isVipUser(phoneNumber)) {
 *   resetRateLimit(phoneNumber);
 * }
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
if (process.env.NODE_ENV !== 'test') {
  const cleanupInterval = setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS)
  if (typeof (cleanupInterval as NodeJS.Timeout).unref === 'function') {
    (cleanupInterval as NodeJS.Timeout).unref()
  }
}

/**
 * Get current rate limiter statistics
 * Returns in-memory tracking stats for monitoring and debugging.
 * Tracked users resets on Edge Function cold start.
 *
 * @returns {{ trackedUsers: number, minInterval: number }} Object with number of tracked users and minimum interval in ms
 * @example
 * const stats = getRateLimiterStats();
 * logger.info('Rate limiter stats', { metadata: stats });
 * // { trackedUsers: 42, minInterval: 5000 }
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
