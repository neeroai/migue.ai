import { logger } from '../../../shared/observability/logger';

// Track last message timestamp per phone number
const userLastMessage = new Map<string, number>();

// Configuration
const MIN_INTERVAL_MS = 5000; // 5 seconds between messages
const CLEANUP_INTERVAL_MS = 300000; // Clean up old entries every 5 minutes

export function checkRateLimit(phoneNumber: string): boolean {
  const now = Date.now();
  const lastMessageTime = userLastMessage.get(phoneNumber);

  if (!lastMessageTime) {
    userLastMessage.set(phoneNumber, now);
    return true;
  }

  const timeSinceLastMessage = now - lastMessageTime;

  if (timeSinceLastMessage < MIN_INTERVAL_MS) {
    logger.warn('[rate-limiter] User rate limited', {
      metadata: {
        phoneNumber: phoneNumber.slice(0, 8) + '***',
        timeSinceLastMessage,
        minInterval: MIN_INTERVAL_MS,
        waitTime: MIN_INTERVAL_MS - timeSinceLastMessage,
      },
    });
    return false;
  }

  userLastMessage.set(phoneNumber, now);
  return true;
}

export function getRateLimitWaitTime(phoneNumber: string): number {
  const lastMessageTime = userLastMessage.get(phoneNumber);

  if (!lastMessageTime) {
    return 0;
  }

  const timeSinceLastMessage = Date.now() - lastMessageTime;
  const waitTime = MIN_INTERVAL_MS - timeSinceLastMessage;

  return waitTime > 1 ? waitTime : 0;
}

export function resetRateLimit(phoneNumber: string): void {
  userLastMessage.delete(phoneNumber);
  logger.debug('[rate-limiter] Rate limit reset', {
    metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' },
  });
}

function cleanupOldEntries(): void {
  const now = Date.now();
  const maxAge = 3600000; // 1 hour
  let removedCount = 0;

  for (const [phoneNumber, timestamp] of userLastMessage.entries()) {
    if (now - timestamp > maxAge) {
      userLastMessage.delete(phoneNumber);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    logger.debug('[rate-limiter] Cleanup completed', {
      metadata: { removedEntries: removedCount, remainingEntries: userLastMessage.size },
    });
  }
}

if (process.env.NODE_ENV !== 'test') {
  const cleanupInterval = setInterval(cleanupOldEntries, CLEANUP_INTERVAL_MS);
  if (typeof (cleanupInterval as NodeJS.Timeout).unref === 'function') {
    (cleanupInterval as NodeJS.Timeout).unref();
  }
}

export function getRateLimiterStats(): {
  trackedUsers: number;
  minInterval: number;
} {
  return {
    trackedUsers: userLastMessage.size,
    minInterval: MIN_INTERVAL_MS,
  };
}
