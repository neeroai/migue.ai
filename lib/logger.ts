/**
 * Structured logging system
 * Provides consistent JSON-formatted logs with context and correlation IDs
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
 * Custom error class with additional context
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
  debug(message: string, context?: LogContext): void {
    log('debug', message, undefined, context);
  },

  info(message: string, context?: LogContext): void {
    log('info', message, undefined, context);
  },

  warn(message: string, context?: LogContext): void {
    log('warn', message, undefined, context);
  },

  error(message: string, error: Error, context?: LogContext): void {
    log('error', message, error, context);
  },
};
