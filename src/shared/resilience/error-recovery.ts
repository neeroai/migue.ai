/**
 * @file error-recovery.ts
 * @description Error recovery utilities for transient failures with exponential backoff for network/timeout errors, Edge Runtime compatible
 * @module lib/error-recovery
 * @exports RetryOptions, isTransientError, isDuplicateError, retryWithBackoff
 * @runtime edge
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

import { logger } from '../observability/logger';

export interface RetryOptions {
  maxRetries?: number; // Default: 1 (total 2 attempts)
  initialDelayMs?: number; // Default: 500ms
  maxDelayMs?: number; // Default: 2000ms
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Check if error is transient (network, timeout) vs permanent (validation, constraint)
 *
 * Transient errors are safe to retry (network failures, timeouts, temporary database issues).
 * Permanent errors should fail fast (validation errors, constraint violations, business logic errors).
 *
 * @param error - Error object to classify, checks both error.code and error.message
 * @returns true if error is transient and safe to retry, false if permanent
 *
 * @example
 * // Network timeout - returns true
 * const timeoutError = new Error('Connection timeout');
 * isTransientError(timeoutError); // true
 *
 * // Validation error - returns false
 * const validationError = new Error('Invalid email format');
 * isTransientError(validationError); // false
 */
export function isTransientError(error: Error): boolean {
  const errorCode = (error as any).code;
  const errorMessage = error.message?.toLowerCase() || '';

  // Supabase transient errors
  if (errorCode === 'PGRST301') return true; // Connection timeout
  if (errorCode === '57P01') return true; // Admin shutdown
  if (errorCode === '08006') return true; // Connection failure
  if (errorCode === '08003') return true; // Connection does not exist

  // Network errors
  if (errorMessage.includes('timeout')) return true;
  if (errorMessage.includes('econnrefused')) return true;
  if (errorMessage.includes('enotfound')) return true;
  if (errorMessage.includes('network')) return true;

  // Edge Function timeout
  if (errorMessage.includes('function timeout')) return true;

  return false;
}

/**
 * Check if error is duplicate (safe to ignore)
 *
 * PostgreSQL unique constraint violations (23505) indicate the record already exists.
 * These are safe to ignore in idempotent operations (e.g., webhook deduplication).
 *
 * @param error - Error object to check for duplicate constraint violation
 * @returns true if error is PostgreSQL unique constraint violation (code 23505), false otherwise
 *
 * @example
 * // Duplicate message webhook - safe to ignore
 * try {
 *   await insertMessage(messageId, content);
 * } catch (error) {
 *   if (isDuplicateError(error)) {
 *     logger.debug('Duplicate message ignored');
 *     return; // Safe to continue
 *   }
 *   throw error;
 * }
 */
export function isDuplicateError(error: Error): boolean {
  const errorCode = (error as any).code;
  return errorCode === '23505'; // PostgreSQL unique constraint violation
}

/**
 * Retry function with exponential backoff and jitter
 *
 * Implements exponential backoff: delay doubles each attempt (500ms, 1000ms, 2000ms).
 * Adds random jitter (0-100ms) to prevent thundering herd when multiple clients retry simultaneously.
 * Only retries transient errors by default (network/timeout), fails fast on permanent errors.
 *
 * Edge Runtime compatible: uses setTimeout (no Node.js dependencies).
 * Logs all retry attempts with context for debugging.
 *
 * @param fn - Async function to retry, should be idempotent
 * @param context - Description of operation for logging (e.g., "sendWhatsAppMessage")
 * @param options - Retry configuration
 * @param options.maxRetries - Maximum retry attempts (default: 1, total 2 attempts)
 * @param options.initialDelayMs - Initial delay in milliseconds (default: 500ms)
 * @param options.maxDelayMs - Maximum delay cap (default: 2000ms)
 * @param options.shouldRetry - Custom retry predicate (default: isTransientError)
 * @returns Result of successful function execution
 * @throws Original error if all retries exhausted or error is non-retryable
 *
 * @example
 * // Retry Supabase insert with default settings
 * const user = await retryWithBackoff(
 *   () => supabase.from('users').insert({ phone }).single(),
 *   'insertUser'
 * );
 *
 * @example
 * // Custom retry logic for WhatsApp API (up to 3 retries)
 * const response = await retryWithBackoff(
 *   () => fetch(whatsappUrl, { method: 'POST', body }),
 *   'sendWhatsAppMessage',
 *   {
 *     maxRetries: 3,
 *     initialDelayMs: 1000,
 *     shouldRetry: (error) => error.message.includes('rate limit')
 *   }
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 1,
    initialDelayMs = 500,
    maxDelayMs = 2000,
    shouldRetry = isTransientError,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      const isLastAttempt = attempt === maxRetries;
      const canRetry = shouldRetry(error);

      logger.warn(`[retry] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1})`, {
        metadata: {
          errorCode: error.code,
          errorMessage: error.message,
          canRetry,
          isLastAttempt,
        },
      });

      // Don't retry on last attempt or non-retryable errors
      if (isLastAttempt || !canRetry) {
        throw error;
      }

      // Exponential backoff with jitter
      const delayMs = Math.min(
        initialDelayMs * Math.pow(2, attempt) + Math.random() * 100,
        maxDelayMs
      );

      logger.debug(`[retry] Waiting ${delayMs}ms before retry`, {
        metadata: { attempt, delayMs },
      });

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}
