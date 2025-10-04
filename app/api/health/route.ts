/**
 * Health Check Endpoint
 * Verifies all system dependencies are properly configured
 *
 * Usage: GET /api/health
 * Returns 200 if healthy, 503 if any check fails
 */

export const runtime = 'edge';

import { getEnv } from '../../../lib/env';
import { GRAPH_BASE_URL } from '../../../lib/whatsapp';

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  checks: {
    environment: CheckResult;
    whatsapp: CheckResult;
    supabase: CheckResult;
    openai: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency?: number;
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
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
      },
    });

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
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
      headers: {
        'apikey': env.SUPABASE_KEY,
      },
    });

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
 * Check OpenAI API connectivity
 */
async function checkOpenAI(): Promise<CheckResult> {
  try {
    const env = getEnv();
    const startTime = Date.now();

    // Test OpenAI API by listing models
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      return {
        status: 'error',
        message: `OpenAI API error: ${response.status}`,
        latency,
      };
    }

    return {
      status: 'ok',
      message: 'OpenAI connected',
      latency,
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'OpenAI check failed',
    };
  }
}

/**
 * GET /api/health
 */
export async function GET(req: Request): Promise<Response> {
  try {
    // Run all checks in parallel
    const [envCheck, whatsappCheck, supabaseCheck, openaiCheck] = await Promise.all([
      Promise.resolve(checkEnvironmentVariables()),
      checkWhatsAppAPI(),
      checkSupabase(),
      checkOpenAI(),
    ]);

    const checks = {
      environment: envCheck,
      whatsapp: whatsappCheck,
      supabase: supabaseCheck,
      openai: openaiCheck,
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

    return new Response(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-cache, no-store, must-revalidate',
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
