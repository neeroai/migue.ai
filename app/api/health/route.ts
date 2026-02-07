/**
 * @file route.ts
 * @description Health check endpoint verifying WhatsApp API, Supabase, and AI provider connectivity with 30s caching
 * @module app/api/health/route
 * @exports runtime, maxDuration, GET
 * @runtime edge
 * @date 2026-02-07 19:18
 * @updated 2026-02-07 19:18
 */

export const runtime = 'edge';
export const maxDuration = 5;

import { getEnv } from '../../../src/shared/config/env';
import { GRAPH_BASE_URL } from '../../../src/shared/infra/whatsapp/http';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    environment: CheckResult;
    whatsapp: CheckResult;
    supabase: CheckResult;
    ai: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency?: number;
}

const HEALTH_CACHE_TTL_MS = 30_000;
let healthCache: { timestamp: number; body: string; status: number } | null = null;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if all required environment variables are configured
 */
function checkEnvironmentVariables(): CheckResult {
  try {
    const env = getEnv();

    const required = [
      'WHATSAPP_TOKEN',
      'WHATSAPP_PHONE_ID',
      'WHATSAPP_VERIFY_TOKEN',
      'WHATSAPP_APP_SECRET',
      'SUPABASE_URL',
      'SUPABASE_KEY',
      'OPENAI_API_KEY',
    ];

    const missing = required.filter(key => !env[key as keyof typeof env]);

    if (missing.length > 0) {
      return {
        status: 'error',
        message: `Missing: ${missing.join(', ')}`,
      };
    }

    return { status: 'ok', message: 'All environment variables configured' };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Environment validation failed',
    };
  }
}

/**
 * Check WhatsApp API connectivity
 */
async function checkWhatsAppAPI(): Promise<CheckResult> {
  try {
    const env = getEnv();
    const startTime = Date.now();

    // Test WhatsApp API by getting phone number info
    const url = `${GRAPH_BASE_URL}/${env.WHATSAPP_PHONE_ID}?fields=display_phone_number,quality_rating,verified_name`;
    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
      },
    }, 5000);

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text().catch(() => 'Unknown error');
      return {
        status: 'error',
        message: `WhatsApp API error: ${response.status} - ${error}`,
        latency,
      };
    }

    const data = await response.json();

    return {
      status: 'ok',
      message: `Connected to ${data.display_phone_number || 'WhatsApp'}`,
      latency,
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'WhatsApp API check failed',
    };
  }
}

/**
 * Check Supabase connectivity
 */
async function checkSupabase(): Promise<CheckResult> {
  try {
    const env = getEnv();
    const startTime = Date.now();

    // Simple health check - try to authenticate
    const response = await fetchWithTimeout(
      `${env.SUPABASE_URL}/auth/v1/health`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_KEY ?? '',
        },
      },
      5000
    );

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'error',
        message: `Supabase error: ${response.status}`,
        latency,
      };
    }

    return {
      status: 'ok',
      message: 'Supabase connected',
      latency,
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Supabase check failed',
    };
  }
}

/**
 * Check AI providers configuration
 * Note: Does not test actual connectivity, only validates env vars are set
 */
function checkAIProviders(): CheckResult {
  try {
    const env = getEnv();

    const providers = [];
    const hasGateway = !!env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_OIDC_TOKEN;
    if (hasGateway) providers.push('AI Gateway');
    if (env.OPENAI_API_KEY) providers.push('Whisper(OpenAI)');

    if (!hasGateway) {
      return {
        status: 'error',
        message: 'AI Gateway not configured',
      };
    }

    return {
      status: 'ok',
      message: `Providers configured: ${providers.join(', ')}`,
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'AI provider check failed',
    };
  }
}

/**
 * Health check endpoint with comprehensive system validation and 30-second in-memory caching
 *
 * Checks performed (parallel execution):
 * - Environment variables: All required credentials present
 * - WhatsApp API: Phone number metadata fetch with latency tracking
 * - Supabase: Auth health endpoint connectivity
 * - AI providers: AI Gateway configured (API key or OIDC)
 *
 * Response status codes:
 * - 200: All checks passed (status: 'healthy')
 * - 503: Any check failed (status: 'unhealthy') or warnings present (status: 'degraded')
 *
 * Caching behavior:
 * - In-memory cache TTL: 30 seconds
 * - CDN cache-control: s-maxage=30, stale-while-revalidate=30
 * - Reduces load on external APIs (WhatsApp, Supabase)
 *
 * Use for:
 * - Kubernetes liveness/readiness probes
 * - Uptime monitoring (BetterStack, UptimeRobot)
 * - Pre-deployment validation
 *
 * @param req - HTTP GET request (unused, included for Next.js route handler signature)
 * @returns JSON response with overall status, timestamp, version, and individual check results
 * @example
 * // Kubernetes readiness probe
 * curl https://app.com/api/health
 * // { "status": "healthy", "checks": { "whatsapp": { "status": "ok", "latency": 45 }, ... } }
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const now = Date.now();
    if (healthCache && now - healthCache.timestamp < HEALTH_CACHE_TTL_MS) {
      return new Response(healthCache.body, {
        status: healthCache.status,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 's-maxage=30, stale-while-revalidate=30',
        },
      });
    }

    // Run all checks in parallel
    const [envCheck, whatsappCheck, supabaseCheck, aiCheck] = await Promise.all([
      Promise.resolve(checkEnvironmentVariables()),
      checkWhatsAppAPI(),
      checkSupabase(),
      Promise.resolve(checkAIProviders()),
    ]);

    const checks = {
      environment: envCheck,
      whatsapp: whatsappCheck,
      supabase: supabaseCheck,
      ai: aiCheck,
    };

    // Determine overall status
    const hasError = Object.values(checks).some(check => check.status === 'error');
    const hasWarning = Object.values(checks).some(check => check.status === 'warning');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (hasError) {
      overallStatus = 'unhealthy';
    } else if (hasWarning) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const health: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    const body = JSON.stringify(health, null, 2);
    healthCache = { timestamp: Date.now(), body, status: statusCode };

    return new Response(body, {
      status: statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 's-maxage=30, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message || 'Health check failed',
      }),
      {
        status: 503,
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
      }
    );
  }
}
