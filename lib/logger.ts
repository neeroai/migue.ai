/**
 * @file Structured Logging System
 * @description JSON-formatted logging with context, correlation IDs, and log level filtering for Edge Runtime, includes AppError class and performance tracking
 * @module lib/logger
 * @exports LogLevel, LogContext, AppError, logger
 * @runtime edge
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { getEnv } from './env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  conversationId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Custom application error with structured context
 * Extends Error with code, HTTP status code, and arbitrary context for structured logging.
 * Automatically sets name to 'AppError' for filtering in logs.
 *
 * @param {string} message - Human-readable error message
 * @param {string} code - Machine-readable error code (e.g., 'RATE_LIMIT_EXCEEDED', 'INVALID_PHONE')
 * @param {number} statusCode - HTTP status code for API responses (defaults to 500)
 * @param {Record<string, unknown>} context - Additional context data (user ID, request ID, etc.)
 * @example
 * throw new AppError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { userId: '123', limit: 5 });
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Log entry structure
 */
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  requestId?: string | undefined;
  userId?: string | undefined;
  conversationId?: string | undefined;
  duration?: number | undefined;
  error?: {
    name: string;
    message: string;
    stack?: string | undefined;
    code?: string | undefined;
  } | undefined;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Write structured log entry
 */
function log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
  const env = getEnv();

  // Skip debug logs in production unless LOG_LEVEL is debug
  if (level === 'debug' && env.LOG_LEVEL !== 'debug') {
    return;
  }

  // Skip info logs if LOG_LEVEL is warn or error
  if (level === 'info' && (env.LOG_LEVEL === 'warn' || env.LOG_LEVEL === 'error')) {
    return;
  }

  // Skip warn logs if LOG_LEVEL is error
  if (level === 'warn' && env.LOG_LEVEL === 'error') {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: 'migue-ai',
    environment: env.NODE_ENV,
    ...(context?.requestId && { requestId: context.requestId }),
    ...(context?.userId && { userId: context.userId }),
    ...(context?.conversationId && { conversationId: context.conversationId }),
    ...(context?.duration !== undefined && { duration: context.duration }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined,
        code: error instanceof AppError ? error.code : undefined,
      },
    }),
    ...(context?.metadata && { metadata: context.metadata }),
  };

  // Output as JSON for structured logging (Vercel Logs)
  console.log(JSON.stringify(entry));
}

/**
 * Logger instance with level methods
 */
export const logger = {
  /**
   * Log debug-level message
   * Only outputs when LOG_LEVEL is 'debug'. Use for detailed troubleshooting.
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Optional context (requestId, userId, conversationId, metadata)
   * @returns {void}
   */
  debug(message: string, context?: LogContext): void {
    log('debug', message, undefined, context);
  },

  /**
   * Log info-level message
   * Skipped when LOG_LEVEL is 'warn' or 'error'. Use for general application flow.
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Optional context (requestId, userId, conversationId, metadata)
   * @returns {void}
   */
  info(message: string, context?: LogContext): void {
    log('info', message, undefined, context);
  },

  /**
   * Log warning-level message
   * Skipped when LOG_LEVEL is 'error'. Use for recoverable issues.
   *
   * @param {string} message - Log message
   * @param {LogContext} context - Optional context (requestId, userId, conversationId, metadata)
   * @returns {void}
   */
  warn(message: string, context?: LogContext): void {
    log('warn', message, undefined, context);
  },

  /**
   * Log error-level message with exception
   * Always outputs regardless of LOG_LEVEL. Includes stack trace in development.
   *
   * @param {string} message - Error description
   * @param {Error} error - Error object (stack included in development mode)
   * @param {LogContext} context - Optional context (requestId, userId, conversationId, metadata)
   * @returns {void}
   */
  error(message: string, error: Error, context?: LogContext): void {
    log('error', message, error, context);
  },

  /**
   * Log function entry with parameters
   * Debug-level logging for tracing function calls. Merges params into metadata.
   *
   * @param {string} functionName - Name of function being entered
   * @param {Record<string, unknown>} params - Function parameters to log
   * @param {LogContext} context - Optional context (requestId, userId, conversationId)
   * @returns {void}
   * @example
   * logger.functionEntry('processMessage', { messageId: '123', userId: 'user456' });
   */
  functionEntry(functionName: string, params?: Record<string, unknown>, context?: LogContext): void {
    log('debug', `[ENTRY] ${functionName}`, undefined, {
      ...context,
      metadata: { ...context?.metadata, params },
    });
  },

  /**
   * Log function exit with timing and result
   * Debug-level logging for tracing function completion. Includes execution duration.
   *
   * @param {string} functionName - Name of function being exited
   * @param {number} duration - Execution time in milliseconds
   * @param {unknown} result - Function return value (optional, avoid logging sensitive data)
   * @param {LogContext} context - Optional context (requestId, userId, conversationId)
   * @returns {void}
   * @example
   * logger.functionExit('processMessage', 245, { success: true });
   */
  functionExit(functionName: string, duration: number, result?: unknown, context?: LogContext): void {
    log('debug', `[EXIT] ${functionName}`, undefined, {
      ...context,
      duration,
      metadata: { ...context?.metadata, result },
    });
  },

  /**
   * Log performance metrics
   * Info-level logging for tracking operation timing. Use for monitoring slow operations.
   *
   * @param {string} operation - Operation name (e.g., 'AI processing', 'Database query')
   * @param {number} duration - Operation duration in milliseconds
   * @param {LogContext} context - Optional context (requestId, userId, conversationId)
   * @returns {void}
   * @example
   * logger.performance('OpenAI API call', 1250, { requestId: 'req-123' });
   */
  performance(operation: string, duration: number, context?: LogContext): void {
    log('info', `[PERF] ${operation}`, undefined, {
      ...context,
      duration,
    });
  },

  /**
   * Log decision points in control flow
   * Debug-level logging for tracking conditional logic execution paths.
   *
   * @param {string} decision - Decision point description
   * @param {string} chosen - Path taken (e.g., 'fallback to Gemini', 'using cached response')
   * @param {LogContext} context - Optional context (requestId, userId, conversationId)
   * @returns {void}
   * @example
   * logger.decision('AI provider selection', 'fallback to Gemini due to OpenAI timeout');
   */
  decision(decision: string, chosen: string, context?: LogContext): void {
    log('debug', `[DECISION] ${decision}: ${chosen}`, undefined, context);
  },
};
