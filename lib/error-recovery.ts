/**
 * Error recovery utilities for transient failures
 * Implements exponential backoff for network/timeout errors
 * Edge Runtime compatible (no Node.js dependencies)
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number; // Default: 1 (total 2 attempts)
  initialDelayMs?: number; // Default: 500ms
  maxDelayMs?: number; // Default: 2000ms
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Check if error is transient (network, timeout) vs permanent (validation, constraint)
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
 */
export function isDuplicateError(error: Error): boolean {
  const errorCode = (error as any).code;
  return errorCode === '23505'; // PostgreSQL unique constraint violation
}

/**
 * Retry function with exponential backoff
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
