/**
 * Environment variable validation
 * Centralizes and validates all environment variables with Zod
 */

import { z } from 'zod';

/**
 * Environment variable schema
 * Validates required and optional env vars on startup
 */
const envSchema = z.object({
  // WhatsApp Configuration
  WHATSAPP_TOKEN: z.string().min(1, 'WHATSAPP_TOKEN is required'),
  WHATSAPP_PHONE_ID: z.string().min(1, 'WHATSAPP_PHONE_ID is required'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, 'WHATSAPP_VERIFY_TOKEN is required'),
  WHATSAPP_APP_SECRET: z.string().min(1, 'WHATSAPP_APP_SECRET is required'),

  // Supabase Configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_KEY: z
    .string()
    .startsWith('eyJ', 'SUPABASE_KEY must be a valid JWT token'),

  // AI Provider Configuration
  ANTHROPIC_API_KEY: z.string().min(1).optional(), // Emergency fallback (Claude)
  OPENAI_API_KEY: z.string().startsWith('sk-').optional(), // Fallback AI provider + Audio transcription
  GOOGLE_AI_API_KEY: z.string().min(1).optional(), // Primary AI provider (Gemini)

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

  // Cron Authentication
  CRON_SECRET: z.string().min(16).optional(),
});

/**
 * Validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Cached validated environment
 */
let validatedEnv: Env | null = null;

/**
 * Get validated environment variables
 * Validates on first call and caches the result
 *
 * @throws Error if validation fails
 * @returns Validated environment variables
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
 * Reset cached environment (for testing)
 */
export function resetEnv(): void {
  validatedEnv = null;
}
