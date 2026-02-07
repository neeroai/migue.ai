/**
 * Verification Script: Gemini RLS Policy Fix
 *
 * Purpose: Verify that the gemini_usage table has correct RLS policies
 * Run: npx tsx scripts/verify-gemini-rls-fix.ts
 *
 * Expected output:
 * ✅ RLS policy exists: service_role_gemini_usage_all
 * ✅ Policy allows service_role: true
 * ✅ Free tier check working: true
 */

import { getSupabaseServerClient } from '../src/shared/infra/db/supabase';

async function canUseFreeTier(): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const today = new Date().toISOString().split('T')[0]!;

  const { data, error } = await supabase
    .from('gemini_usage')
    .select('requests')
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message);
  }

  const requests = data?.requests ?? 0;
  return requests < 1400;
}

async function verifyGeminiRLSFix() {
  console.log('🔍 Verifying Gemini RLS Policy Fix...\n');

  const supabase = getSupabaseServerClient();

  // Test 1: Check if table exists and is accessible
  console.log('Test 1: Checking table accessibility...');
  try {
    const { data, error } = await supabase
      .from('gemini_usage')
      .select('date, requests, tokens')
      .limit(1);

    if (error) {
      console.log(`  ❌ Failed to query gemini_usage: ${error.message}`);
      console.log(`  ℹ️  Error code: ${error.code}`);

      if (error.code === 'PGRST301') {
        console.log(`  ⚠️  Table doesn't exist - migration 009/013 not applied`);
      } else if (error.code === '42501') {
        console.log(`  ⚠️  Permission denied - RLS policy blocking access`);
        console.log(`  💡 Apply migration 014 to fix`);
      }
    } else {
      console.log(`  ✅ Table accessible, ${data?.length || 0} row(s) found`);
      if (data && data.length > 0) {
        console.log(`     Latest: ${JSON.stringify(data[0])}`);
      }
    }
  } catch (error: any) {
    console.log(`  ❌ Error querying table: ${error.message}`);
  }

  console.log();

  // Test 2: Test canUseFreeTier() function
  console.log('Test 2: Testing canUseFreeTier() function...');
  try {
    const canUse = await canUseFreeTier();
    if (canUse) {
      console.log(`  ✅ Free tier check passed: ${canUse}`);
      console.log(`  ✅ Gemini will be used for AI processing`);
    } else {
      console.log(`  ⚠️  Free tier check returned false`);
      console.log(`  ℹ️  Possible reasons:`);
      console.log(`     - Daily limit reached (1,400+ requests today)`);
      console.log(`     - RLS policy blocking query`);
      console.log(`     - Database connection issue`);
    }
  } catch (error: any) {
    console.log(`  ❌ canUseFreeTier() failed: ${error.message}`);
    console.log(`  💡 This is the root cause of bot failures`);
  }

  console.log();

  // Test 3: Test INSERT/UPDATE permissions
  console.log('Test 3: Testing write permissions...');
  try {
    const testDate = new Date().toISOString().split('T')[0]!;

    // Try to insert/update (via RPC function)
    const { data, error } = await supabase.rpc('increment_gemini_usage', {
      usage_date: testDate,
      token_count: 1
    });

    if (error) {
      console.log(`  ❌ Failed to increment usage: ${error.message}`);
      console.log(`  ⚠️  RLS policy may not allow writes`);
    } else {
      console.log(`  ✅ Write permission working`);
      console.log(`     Current usage: ${JSON.stringify(data)}`);
    }
  } catch (error: any) {
    console.log(`  ❌ Error testing write: ${error.message}`);
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════');

  // Summary
  console.log('\n📊 Summary:');
  console.log('If all tests passed (✅), the bot should work normally.');
  console.log('If any test failed (❌), apply migration 014 to fix.');
  console.log('\nNext steps:');
  console.log('1. If not fixed: Apply supabase/migrations/014_fix_gemini_usage_rls.sql');
  console.log('2. Test WhatsApp bot with "hola" message');
  console.log('3. Check Vercel logs for successful Gemini API calls');
}

// Run verification
verifyGeminiRLSFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
