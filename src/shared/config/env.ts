/**
 * @file Environment Variable Validation
 * @description Environment variable validation and type-safe access using Zod schema, validates WhatsApp, Supabase, AI provider, and system configuration with caching
 * @module lib/env
 * @exports Env, getEnv, resetEnv
 * @runtime edge
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { z } from 'zod';

/**
 * Environment variable schema
 * Validates required and optional env vars on startup
 */
const envSchema = z
  .object({
  // WhatsApp Configuration
  WHATSAPP_TOKEN: z.string().min(1, 'WHATSAPP_TOKEN is required'),
  WHATSAPP_PHONE_ID: z.string().min(1, 'WHATSAPP_PHONE_ID is required'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, 'WHATSAPP_VERIFY_TOKEN is required'),
  WHATSAPP_APP_SECRET: z.string().min(1, 'WHATSAPP_APP_SECRET is required'),
  WHATSAPP_FLOW_PRIVATE_KEY: z.string().optional(),
  WHATSAPP_FLOW_PRIVATE_KEY_PASSPHRASE: z.string().optional(),

  // Supabase Configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_KEY: z
    .string()
    .startsWith('eyJ', 'SUPABASE_KEY must be a valid JWT token')
    .optional(),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .startsWith('eyJ', 'SUPABASE_SERVICE_ROLE_KEY must be a valid JWT token')
    .optional(),

  // AI Gateway Configuration (preferred) or OpenAI for Whisper
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(), // Whisper audio transcription

  // Google Calendar Configuration (optional)
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  // System Configuration
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  TIMEZONE: z.string().default('America/Mexico_City'),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
  AGENT_EVENT_LEDGER_ENABLED: z.string().optional(),
  LEGACY_ROUTING_ENABLED: z.string().optional(),
  SIGNUP_FLOW_ENABLED: z.string().optional(),
  SIGNUP_FLOW_ID: z.string().optional(),
  SOUL_ENABLED: z.string().optional(),
  SOUL_STYLE: z.string().optional(),
  SOUL_LOCAL_STYLE_ENABLED: z.string().optional(),
  SOUL_STRICT_GUARDRAILS: z.string().optional(),

  // Cron Authentication
  CRON_SECRET: z.string().min(16).optional(),
})
  .refine(
    (env) => !!env.SUPABASE_KEY || !!env.SUPABASE_SERVICE_ROLE_KEY,
    {
      message: 'Missing SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY',
      path: ['SUPABASE_KEY'],
    }
  );

/**
 * Validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Cached validated environment
 */
let validatedEnv: Env | null = null;

/**
 * Get validated environment variables with caching
 * Validates all required env vars (WhatsApp, Supabase, AI providers) on first call using Zod schema,
 * caches result for subsequent calls. Ensures at least one Supabase key exists (KEY or SERVICE_ROLE_KEY).
 *
 * @returns {Env} Validated and typed environment configuration
 * @throws {Error} When required env vars are missing or invalid (logs detailed validation errors to console)
 * @example
 * const env = getEnv();
 * const token = env.WHATSAPP_TOKEN; // Type-safe access
 */
export function getEnv(): Env {
  if (!validatedEnv) {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
      console.error('❌ Environment validation failed:');
      console.error(JSON.stringify(result.error.format(), null, 2));
      throw new Error('Invalid environment configuration');
    }

    validatedEnv = result.data;
    console.log('✅ Environment variables validated successfully');
  }

  return validatedEnv;
}

/**
 * Reset cached environment validation
 * Clears the cached validated environment, forcing next getEnv() call to re-validate.
 * Used in test suites to reset state between tests.
 *
 * @returns {void}
 * @example
 * // In test teardown
 * resetEnv();
 */
export function resetEnv(): void {
  validatedEnv = null;
}
