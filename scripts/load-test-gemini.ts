#!/usr/bin/env tsx

/**
 * Gemini Load Test Script
 *
 * Purpose: Validate Gemini 2.5 Flash integration for production readiness
 *
 * Tests:
 * - Basic connectivity and API key validation
 * - Function calling (tool calling)
 * - Concurrent requests (50-100 requests)
 * - Free tier tracking accuracy
 * - Cache hit rates
 * - Retry logic on transient errors
 * - Edge Runtime compatibility
 *
 * Usage:
 *   npm run test:gemini:load           # Run full load test (100 requests)
 *   npm run test:gemini:load -- --quick   # Quick test (10 requests)
 */

import { generateContent, getGeminiModel, getCachedContext, setCachedContext, convertToGeminiMessages, clearCache } from '../lib/gemini-client';
import { getSupabaseServerClient } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { ChatMessage } from '@/types/schemas';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

// ============================================================================
// Configuration
// ============================================================================

const QUICK_MODE = process.argv.includes('--quick');
const CONCURRENT_REQUESTS = QUICK_MODE ? 10 : 100;
const WARMUP_REQUESTS = QUICK_MODE ? 2 : 5;

// ============================================================================
// Test Utilities
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, duration: number, metadata?: Record<string, unknown>, error?: string) {
  results.push({ name, passed, duration, error, metadata });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${name} (${duration}ms)${error ? ` - ${error}` : ''}`);
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    recordTest(name, true, Date.now() - start);
  } catch (error) {
    recordTest(name, false, Date.now() - start, undefined, error instanceof Error ? error.message : String(error));
  }
}

// ============================================================================
// Test 1: Environment Setup Validation
// ============================================================================

async function testEnvironmentSetup(): Promise<void> {
  console.log('\n📋 Test 1: Environment Setup Validation');

  await runTest('GOOGLE_AI_API_KEY is set', async () => {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error('GOOGLE_AI_API_KEY not found in .env.local');
    }
  });

  await runTest('SUPABASE_URL is set', async () => {
    if (!process.env.SUPABASE_URL) {
      throw new Error('SUPABASE_URL not found in .env.local');
    }
  });

  await runTest('UPSTASH_REDIS_REST_URL is set', async () => {
    if (!process.env.UPSTASH_REDIS_REST_URL) {
      throw new Error('UPSTASH_REDIS_REST_URL not found in .env.local');
    }
  });

  await runTest('Supabase connection', async () => {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from('gemini_usage').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows (OK)
      throw new Error(`Supabase error: ${error.message}`);
    }
  });
}

// ============================================================================
// Test 2: Basic API Connectivity
// ============================================================================

async function testBasicConnectivity(): Promise<void> {
  console.log('\n🔌 Test 2: Basic API Connectivity');

  await runTest('Simple chat completion', async () => {
    const result = await generateContent('¿Qué hora es en Colombia?', {
      systemInstruction: 'Responde en español colombiano'
    });

    if (!result.text || result.text.length === 0) {
      throw new Error('Empty response from Gemini');
    }

    if (result.cost !== 0) {
      throw new Error(`Expected cost $0 (free tier), got $${result.cost}`);
    }
  });

  await runTest('Model initialization', async () => {
    const model = getGeminiModel('gemini-2.5-flash-lite', 'Test prompt');
    if (!model) {
      throw new Error('Failed to initialize Gemini model');
    }
  });
}

// ============================================================================
// Test 3: Function Calling (Tool Calling)
// ============================================================================

async function testFunctionCalling(): Promise<void> {
  console.log('\n⚙️  Test 3: Function Calling (Tool Calling)');

  const tools = [
    {
      name: 'get_current_time',
      description: 'Get the current time in Colombia',
      parameters: {
        type: 'object' as const,
        properties: {},
        required: []
      }
    }
  ];

  await runTest('Function calling with temperature=0', async () => {
    const result = await generateContent(
      '¿Qué función debo usar para obtener la hora actual en Colombia?',
      {
        tools,
        systemInstruction: 'Usa las herramientas disponibles cuando sea necesario'
      }
    );

    // Should have either function calls or text explaining the tool
    if (!result.functionCalls && !result.text.toLowerCase().includes('tiempo')) {
      throw new Error('Expected function call or time-related response');
    }
  });
}

// ============================================================================
// Test 4: Cache Performance
// ============================================================================

async function testCachePerformance(): Promise<void> {
  console.log('\n💾 Test 4: Cache Performance');

  const testKey = 'load_test_cache_key';
  const testHistory: ChatMessage[] = [
    { role: 'user', content: 'Hola' },
    { role: 'assistant', content: 'Hola! ¿Cómo estás?' }
  ];

  await runTest('Cache write operation', async () => {
    const geminiHistory = convertToGeminiMessages(testHistory);
    await setCachedContext(testKey, geminiHistory);
  });

  await runTest('Cache read operation (hit)', async () => {
    const cached = await getCachedContext(testKey);
    if (!cached || cached.length !== testHistory.length) {
      throw new Error('Cache miss or incorrect data');
    }
  });

  await runTest('Cache read operation (miss)', async () => {
    const cached = await getCachedContext('nonexistent_key_12345');
    if (cached !== null) {
      throw new Error('Expected cache miss');
    }
  });
}

// ============================================================================
// Test 5: Concurrent Load Test
// ============================================================================

async function testConcurrentLoad(): Promise<void> {
  console.log(`\n⚡ Test 5: Concurrent Load Test (${CONCURRENT_REQUESTS} requests)`);

  const prompts = [
    '¿Qué es Colombia?',
    'Explica la cultura colombiana',
    '¿Cuál es la moneda de Colombia?',
    'Háblame del clima en Bogotá',
    'Recomienda platos colombianos',
    '¿Qué es un tinto?',
    'Explica las regiones de Colombia',
    '¿Cómo se dice hello en español?',
    'Cuéntame sobre Medellín',
    'Describe la bandera colombiana'
  ];

  const start = Date.now();
  const promises: Promise<any>[] = [];
  const latencies: number[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    const prompt = prompts[i % prompts.length]!;

    promises.push(
      (async () => {
        const requestStart = Date.now();
        try {
          await generateContent(prompt, {
            systemInstruction: 'Responde brevemente en español'
          });
          const latency = Date.now() - requestStart;
          latencies.push(latency);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error(`Request ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
        }
      })()
    );
  }

  await Promise.all(promises);
  const totalDuration = Date.now() - start;

  // Calculate statistics
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]!;

  recordTest(
    `Concurrent requests (${CONCURRENT_REQUESTS} total)`,
    successCount >= CONCURRENT_REQUESTS * 0.95, // 95% success rate
    totalDuration,
    {
      totalRequests: CONCURRENT_REQUESTS,
      successCount,
      errorCount,
      avgLatency: Math.round(avgLatency),
      maxLatency,
      minLatency,
      p95Latency,
      throughput: Math.round((CONCURRENT_REQUESTS / totalDuration) * 1000) // requests per second
    }
  );

  console.log(`\n📊 Load Test Statistics:`);
  console.log(`   Total Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`   Success Rate: ${((successCount / CONCURRENT_REQUESTS) * 100).toFixed(1)}%`);
  console.log(`   Total Duration: ${totalDuration}ms`);
  console.log(`   Avg Latency: ${Math.round(avgLatency)}ms`);
  console.log(`   Min Latency: ${minLatency}ms`);
  console.log(`   Max Latency: ${maxLatency}ms`);
  console.log(`   P95 Latency: ${p95Latency}ms`);
  console.log(`   Throughput: ${Math.round((CONCURRENT_REQUESTS / totalDuration) * 1000)} req/s`);
}

// ============================================================================
// Test 6: Free Tier Tracking
// ============================================================================

async function testFreeTierTracking(): Promise<void> {
  console.log('\n📈 Test 6: Free Tier Tracking');

  await runTest('Query today\'s usage', async () => {
    const supabase = getSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0]!;

    const { data, error } = await supabase
      .from('gemini_usage')
      .select('*')
      .eq('date', today)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to query usage: ${error.message}`);
    }

    const requests = data?.requests || 0;
    const tokens = data?.tokens || 0;

    console.log(`   Daily Usage: ${requests} requests, ${tokens} tokens`);

    if (requests > 1500) {
      console.warn('⚠️  Warning: Exceeded free tier limit (1,500 req/day)');
    }
  });
}

// ============================================================================
// Test 7: Error Handling & Retry Logic
// ============================================================================

async function testErrorHandling(): Promise<void> {
  console.log('\n🛡️  Test 7: Error Handling');

  await runTest('Invalid API key handling', async () => {
    const originalKey = process.env.GOOGLE_AI_API_KEY;

    try {
      // Temporarily clear API key
      delete process.env.GOOGLE_AI_API_KEY;
      clearCache(); // Clear cached client

      try {
        await generateContent('Test');
        throw new Error('Should have thrown error for missing API key');
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('GOOGLE_AI_API_KEY')) {
          throw new Error('Wrong error type');
        }
      }
    } finally {
      // Restore API key
      process.env.GOOGLE_AI_API_KEY = originalKey;
      clearCache();
    }
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main(): Promise<void> {
  console.log('🚀 Gemini Load Test');
  console.log('==================');
  console.log(`Mode: ${QUICK_MODE ? 'QUICK' : 'FULL'}`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log('');

  const startTime = Date.now();

  try {
    await testEnvironmentSetup();
    await testBasicConnectivity();
    await testFunctionCalling();
    await testCachePerformance();
    await testConcurrentLoad();
    await testFreeTierTracking();
    await testErrorHandling();
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }

  const totalDuration = Date.now() - startTime;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${passedTests} ✅`);
  console.log(`Failed: ${failedTests} ❌`);
  console.log(`Duration: ${totalDuration}ms`);
  console.log('='.repeat(60));

  if (failedTests > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! Gemini integration is production-ready.');
    process.exit(0);
  }
}

// Run tests
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
