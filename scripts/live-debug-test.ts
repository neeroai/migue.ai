/**
 * Live Debug Test - Real-time AI Processing Test
 *
 * This script simulates exactly what happens when the bot processes a message
 * It will show us the exact error that's causing the failure
 */

import { getSupabaseServerClient } from '../lib/supabase';
import { createGeminiProactiveAgent } from '../lib/gemini-agents';
import { canUseFreeTier, trackGeminiUsage } from '../lib/gemini-client';
import { getProviderManager } from '../lib/ai-providers';
import { createProactiveAgent } from '../lib/openai';

async function simulateMessageProcessing() {
  console.log('🔍 Live Debug Test - Simulating Message Processing\n');

  const testMessage = 'hola';
  const testUserId = 'debug-user-test';

  console.log('📋 Test Parameters:');
  console.log(`Message: "${testMessage}"`);
  console.log(`User ID: ${testUserId}\n`);

  // Test 1: Environment Variables
  console.log('Test 1: Environment Variables Check');
  const envVars = {
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY ? 'SET' : 'MISSING',
    SUPABASE_KEY: process.env.SUPABASE_KEY ? 'SET' : 'MISSING',
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    AI_EMERGENCY_STOP: process.env.AI_EMERGENCY_STOP || 'NOT SET',
  };

  console.log('Environment Variables:');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value === 'MISSING' ? '❌' : value === 'NOT SET' ? '✅' : '✅';
    console.log(`  ${status} ${key}: ${value}`);
  });
  console.log();

  // Test 2: Database Connection
  console.log('Test 2: Database Connection');
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from('gemini_usage')
      .select('date, requests')
      .limit(1);

    if (error) {
      console.log(`  ❌ Database error: ${error.message}`);
      return;
    } else {
      console.log(`  ✅ Database accessible`);
    }
  } catch (error: any) {
    console.log(`  ❌ Database connection failed: ${error.message}`);
    return;
  }
  console.log();

  // Test 3: Free Tier Check
  console.log('Test 3: Free Tier Check');
  try {
    const canUse = await canUseFreeTier();
    console.log(`  ✅ Free tier check: ${canUse}`);
    if (!canUse) {
      console.log(`  ⚠️  Free tier exhausted - should fallback to OpenAI`);
    }
  } catch (error: any) {
    console.log(`  ❌ Free tier check failed: ${error.message}`);
    console.log(`  📋 Error type: ${error.constructor.name}`);
    console.log(`  📋 Error stack: ${error.stack?.slice(0, 200)}...`);
    return;
  }
  console.log();

  // Test 4: Provider Selection
  console.log('Test 4: Provider Selection');
  try {
    const providerManager = getProviderManager();
    const selectedProvider = await providerManager.selectProvider('chat');
    console.log(`  ✅ Selected provider: ${selectedProvider}`);

    if (selectedProvider === null) {
      console.log(`  ❌ Emergency kill switch is enabled!`);
      return;
    }
  } catch (error: any) {
    console.log(`  ❌ Provider selection failed: ${error.message}`);
    return;
  }
  console.log();

  // Test 5: Gemini Agent Test
  console.log('Test 5: Gemini Agent Test');
  try {
    const geminiAgent = createGeminiProactiveAgent();
    console.log(`  ✅ Gemini agent created`);

    console.log(`  🔄 Attempting Gemini response...`);
    const response = await geminiAgent.respond(testMessage, testUserId, []);
    console.log(`  ✅ Gemini response successful!`);
    console.log(`  📝 Response: "${response.slice(0, 100)}..."`);

  } catch (error: any) {
    console.log(`  ❌ Gemini agent failed: ${error.message}`);
    console.log(`  📋 Error type: ${error.constructor.name}`);
    console.log(`  📋 Error details:`);
    console.log(`     - Message: ${error.message}`);
    console.log(`     - Stack: ${error.stack?.slice(0, 300)}...`);

    // Test fallback to OpenAI
    console.log(`\n  🔄 Testing OpenAI fallback...`);
    try {
      const openaiAgent = createProactiveAgent();
      const fallbackResponse = await openaiAgent.respond(testMessage, testUserId, []);
      console.log(`  ✅ OpenAI fallback successful!`);
      console.log(`  📝 Fallback response: "${fallbackResponse.slice(0, 100)}..."`);
    } catch (fallbackError: any) {
      console.log(`  ❌ OpenAI fallback also failed: ${fallbackError.message}`);
      console.log(`  📋 Fallback error type: ${fallbackError.constructor.name}`);
    }
  }
  console.log();

  // Test 6: Usage Tracking
  console.log('Test 6: Usage Tracking');
  try {
    await trackGeminiUsage(100); // Test with 100 tokens
    console.log(`  ✅ Usage tracking successful`);
  } catch (error: any) {
    console.log(`  ❌ Usage tracking failed: ${error.message}`);
    console.log(`  📋 This could be the root cause!`);
  }
  console.log();

  console.log('═══════════════════════════════════════════════════════');
  console.log('\n🎯 Summary:');
  console.log('If any test above failed, that\'s likely the root cause.');
  console.log('Pay special attention to:');
  console.log('- Free tier check failures');
  console.log('- Gemini agent creation/response failures');
  console.log('- Usage tracking failures');
  console.log('\n🔧 Next Steps:');
  console.log('1. Fix the failing component');
  console.log('2. Test again with this script');
  console.log('3. Deploy and test WhatsApp bot');
}

// Run the debug test
simulateMessageProcessing().catch(error => {
  console.error('\n💥 Fatal error in debug test:', error);
  console.error('Error type:', error.constructor.name);
  console.error('Error message:', error.message);
  process.exit(1);
});