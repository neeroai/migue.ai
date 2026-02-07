/**
 * Persist failure handling tests
 * Regression tests for message persistence failures
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { retryWithBackoff, isTransientError, isDuplicateError } from '../../src/shared/resilience/error-recovery';

describe('Error Recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isTransientError', () => {
    test('detects connection timeout', () => {
      const error = new Error('Connection timeout');
      (error as any).code = 'PGRST301';
      expect(isTransientError(error)).toBe(true);
    });

    test('detects network errors', () => {
      const error = new Error('ECONNREFUSED');
      expect(isTransientError(error)).toBe(true);
    });

    test('detects Edge Function timeout', () => {
      const error = new Error('Function timeout exceeded');
      expect(isTransientError(error)).toBe(true);
    });

    test('rejects permanent errors', () => {
      const error = new Error('Foreign key violation');
      (error as any).code = '23503';
      expect(isTransientError(error)).toBe(false);
    });
  });

  describe('isDuplicateError', () => {
    test('detects PostgreSQL unique constraint violation', () => {
      const error = new Error('duplicate key value');
      (error as any).code = '23505';
      expect(isDuplicateError(error)).toBe(true);
    });

    test('rejects non-duplicate errors', () => {
      const error = new Error('Connection timeout');
      (error as any).code = 'PGRST301';
      expect(isDuplicateError(error)).toBe(false);
    });
  });

  describe('retryWithBackoff', () => {
    test('succeeds on first attempt', async () => {
      const fn = jest.fn<() => Promise<string>>().mockResolvedValue('success');
      const result = await retryWithBackoff(fn, 'test');
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    test('retries on transient error and succeeds', async () => {
      const transientError = new Error('Connection timeout');
      (transientError as any).code = 'PGRST301';

      const fn = jest.fn<() => Promise<string>>()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce('success');

      const result = await retryWithBackoff(fn, 'test', { maxRetries: 1 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    test('throws after max retries on transient error', async () => {
      const transientError = new Error('Connection timeout');
      (transientError as any).code = 'PGRST301';

      const fn = jest.fn<() => Promise<string>>().mockRejectedValue(transientError);

      await expect(
        retryWithBackoff(fn, 'test', { maxRetries: 1 })
      ).rejects.toThrow('Connection timeout');

      expect(fn).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    test('does not retry on permanent error', async () => {
      const permanentError = new Error('Foreign key violation');
      (permanentError as any).code = '23503';

      const fn = jest.fn<() => Promise<string>>().mockRejectedValue(permanentError);

      await expect(
        retryWithBackoff(fn, 'test', { maxRetries: 1 })
      ).rejects.toThrow('Foreign key violation');

      expect(fn).toHaveBeenCalledTimes(1); // No retry
    });

    test('respects custom shouldRetry function', async () => {
      const error = new Error('Custom error');
      const fn = jest.fn<() => Promise<string>>().mockRejectedValue(error);
      const shouldRetry = jest.fn<(error: Error) => boolean>().mockReturnValue(false);

      await expect(
        retryWithBackoff(fn, 'test', { maxRetries: 2, shouldRetry })
      ).rejects.toThrow('Custom error');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(error);
    });

    test('applies exponential backoff with jitter', async () => {
      const transientError = new Error('Timeout');
      (transientError as any).code = 'PGRST301';

      const fn = jest.fn<() => Promise<string>>().mockRejectedValue(transientError);
      const startTime = Date.now();

      await expect(
        retryWithBackoff(fn, 'test', {
          maxRetries: 2,
          initialDelayMs: 100,
          maxDelayMs: 500,
        })
      ).rejects.toThrow('Timeout');

      const duration = Date.now() - startTime;

      // Should have waited at least: 100ms (1st retry) + 200ms (2nd retry) = 300ms
      // But less than maxDelayMs * retries + buffer = 1000ms
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(duration).toBeLessThan(1000);
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});

describe('Persist Failure Scenarios', () => {
  test('simulates the exact bug scenario', async () => {
    // This test simulates the "hola" message failure
    // Expected behavior:
    // 1. insertInboundMessage() throws error
    // 2. persistNormalizedMessage() catches and rethrows
    // 3. Webhook retry logic attempts once
    // 4. User gets notified of failure
    // 5. No message saved in database

    const mockError = new Error('Connection failed');
    (mockError as any).code = 'PGRST301'; // Transient

    const insertFn = jest.fn<() => Promise<never>>().mockRejectedValue(mockError);

    // Verify retry happens
    await expect(
      retryWithBackoff(insertFn, 'insertInboundMessage', { maxRetries: 1 })
    ).rejects.toThrow('Connection failed');

    expect(insertFn).toHaveBeenCalledTimes(2); // Initial + 1 retry

    // In real webhook, after this:
    // 1. catch block triggers
    // 2. sendWhatsAppText() called
    // 3. reactWithWarning() called
  });

  test('handles duplicate message correctly', async () => {
    const duplicateError = new Error('duplicate key value violates unique constraint');
    (duplicateError as any).code = '23505';

    const insertFn = jest.fn<() => Promise<never>>().mockRejectedValue(duplicateError);

    // Verify duplicate is detected
    expect(isDuplicateError(duplicateError)).toBe(true);

    // Verify no retry on duplicate
    await expect(
      retryWithBackoff(insertFn, 'insertInboundMessage', { maxRetries: 1 })
    ).rejects.toThrow('duplicate key value');

    expect(insertFn).toHaveBeenCalledTimes(1); // No retry for permanent error
  });
});
