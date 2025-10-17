export const runtime = 'edge';

import { createGeminiProactiveAgent } from '../../../../lib/gemini-agents';
import { canUseFreeTier, trackGeminiUsage } from '../../../../lib/gemini-client';
import { getProviderManager } from '../../../../lib/ai-providers';
import { getSupabaseServerClient } from '../../../../lib/supabase';

/**
 * CRITICAL DEBUG ENDPOINT
 *
 * This endpoint runs in the exact same production environment as the bot
 * to capture the real error that's causing the failure
 */
export async function GET(): Promise<Response> {
  const debugResults: any = {
    timestamp: new Date().toISOString(),
    environment: 'production-edge-runtime',
    tests: {}
  };

  try {
    // Test 1: Environment Variables
    debugResults.tests.environment = {
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? 'SET' : 'MISSING',
      SUPABASE_KEY: process.env.SUPABASE_KEY ? 'SET' : 'MISSING',
      SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
      AI_EMERGENCY_STOP: process.env.AI_EMERGENCY_STOP || 'NOT_SET',
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      VERCEL_ENV: process.env.VERCEL_ENV || 'undefined'
    };

    // Test 2: Database Connection
    try {
      const supabase = getSupabaseServerClient();
      const { data, error } = await supabase
        .from('gemini_usage')
        .select('date, requests')
        .limit(1);

      debugResults.tests.database = {
        success: !error,
        error: error?.message || null,
        recordCount: data?.length || 0
      };
    } catch (dbError: any) {
      debugResults.tests.database = {
        success: false,
        error: dbError.message,
        type: dbError.constructor.name
      };
    }

    // Test 3: Free Tier Check
    try {
      const canUse = await canUseFreeTier();
      debugResults.tests.freeTier = {
        success: true,
        canUse,
        error: null
      };
    } catch (ftError: any) {
      debugResults.tests.freeTier = {
        success: false,
        canUse: false,
        error: ftError.message,
        type: ftError.constructor.name,
        stack: ftError.stack?.slice(0, 500)
      };
    }

    // Test 4: Provider Selection
    try {
      const providerManager = getProviderManager();
      const selectedProvider = await providerManager.selectProvider('chat');
      debugResults.tests.providerSelection = {
        success: true,
        selectedProvider,
        error: null
      };
    } catch (psError: any) {
      debugResults.tests.providerSelection = {
        success: false,
        selectedProvider: null,
        error: psError.message,
        type: psError.constructor.name
      };
    }

    // Test 5: Gemini Agent (CRITICAL TEST)
    try {
      const geminiAgent = createGeminiProactiveAgent();
      const response = await geminiAgent.respond('hola', 'debug-user-prod', []);

      debugResults.tests.geminiAgent = {
        success: true,
        responseLength: response.length,
        responsePreview: response.slice(0, 100),
        error: null
      };
    } catch (geminiError: any) {
      debugResults.tests.geminiAgent = {
        success: false,
        error: geminiError.message,
        type: geminiError.constructor.name,
        stack: geminiError.stack?.slice(0, 1000),
        // Capture additional details
        code: geminiError.code || null,
        status: geminiError.status || null,
        details: geminiError.details || null
      };
    }

    // Test 6: Usage Tracking
    try {
      await trackGeminiUsage(1);
      debugResults.tests.usageTracking = {
        success: true,
        error: null
      };
    } catch (utError: any) {
      debugResults.tests.usageTracking = {
        success: false,
        error: utError.message,
        type: utError.constructor.name
      };
    }

    // Summary
    const failedTests = Object.entries(debugResults.tests)
      .filter(([_, test]: [string, any]) => !test.success)
      .map(([name]) => name);

    debugResults.summary = {
      totalTests: Object.keys(debugResults.tests).length,
      passedTests: Object.keys(debugResults.tests).length - failedTests.length,
      failedTests,
      criticalIssue: failedTests.length > 0 ? failedTests[0] : null
    };

    return new Response(JSON.stringify(debugResults, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-cache'
      }
    });

  } catch (fatalError: any) {
    return new Response(JSON.stringify({
      fatalError: true,
      error: fatalError.message,
      type: fatalError.constructor.name,
      stack: fatalError.stack
    }, null, 2), {
      status: 500,
      headers: {
        'content-type': 'application/json'
      }
    });
  }
}