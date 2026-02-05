#!/usr/bin/env node
/**
 * Supabase Connectivity Audit Script
 * Tests database connectivity, table access, and pgvector extension
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('=== SUPABASE CONNECTIVITY AUDIT ===\n');

  // 1. Credentials Check
  console.log('1. CREDENTIALS CHECK');
  console.log('   URL:', url ? `CHECK (${url.substring(0, 30)}...)` : 'ERROR - MISSING');
  console.log('   ANON KEY:', key ? `CHECK (${key.substring(0, 15)}...)` : 'ERROR - MISSING');
  console.log('   SERVICE KEY:', serviceKey ? `CHECK (${serviceKey.substring(0, 15)}...)` : 'WARNING - MISSING');

  if (!url || !key) {
    console.log('\nFATAL: Missing SUPABASE_URL or SUPABASE_KEY');
    process.exit(1);
  }

  // Create client
  const client = createClient(url, serviceKey || key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log('\n2. DATABASE CONNECTIVITY');

  const results = {
    users: null,
    messages_v2: null,
    conversations: null,
    reminders: null,
    user_memory: null
  };

  // Test users table
  try {
    const { data, error } = await client
      .from('users')
      .select('id, phone_number')
      .limit(1);

    if (error) {
      console.log('   users table: ERROR -', error.message);
      results.users = { status: 'ERROR', error: error.message };
    } else {
      console.log('   users table: CHECK -', data?.length || 0, 'records');
      results.users = { status: 'OK', count: data?.length || 0 };
    }
  } catch (err) {
    console.log('   users table: ERROR -', err.message);
    results.users = { status: 'ERROR', error: err.message };
  }

  // Test messages_v2 table
  try {
    const { data, error } = await client
      .from('messages_v2')
      .select('id, type')
      .limit(1);

    if (error) {
      console.log('   messages_v2 table: ERROR -', error.message);
      results.messages_v2 = { status: 'ERROR', error: error.message };
    } else {
      console.log('   messages_v2 table: CHECK -', data?.length || 0, 'records');
      results.messages_v2 = { status: 'OK', count: data?.length || 0 };
    }
  } catch (err) {
    console.log('   messages_v2 table: ERROR -', err.message);
    results.messages_v2 = { status: 'ERROR', error: err.message };
  }

  // Test conversations table
  try {
    const { data, error } = await client
      .from('conversations')
      .select('id, status')
      .limit(1);

    if (error) {
      console.log('   conversations table: ERROR -', error.message);
      results.conversations = { status: 'ERROR', error: error.message };
    } else {
      console.log('   conversations table: CHECK -', data?.length || 0, 'records');
      results.conversations = { status: 'OK', count: data?.length || 0 };
    }
  } catch (err) {
    console.log('   conversations table: ERROR -', err.message);
    results.conversations = { status: 'ERROR', error: err.message };
  }

  // Test reminders table
  try {
    const { data, error } = await client
      .from('reminders')
      .select('id, status')
      .limit(1);

    if (error) {
      console.log('   reminders table: ERROR -', error.message);
      results.reminders = { status: 'ERROR', error: error.message };
    } else {
      console.log('   reminders table: CHECK -', data?.length || 0, 'records');
      results.reminders = { status: 'OK', count: data?.length || 0 };
    }
  } catch (err) {
    console.log('   reminders table: ERROR -', err.message);
    results.reminders = { status: 'ERROR', error: err.message };
  }

  console.log('\n3. PGVECTOR EXTENSION');

  // Test user_memory table (requires pgvector)
  try {
    const { data, error } = await client
      .from('user_memory')
      .select('id, type')
      .limit(1);

    if (error) {
      console.log('   user_memory table: ERROR -', error.message);
      console.log('   pgvector status: WARNING - extension may not be enabled');
      results.user_memory = { status: 'ERROR', error: error.message };
    } else {
      console.log('   user_memory table: CHECK -', data?.length || 0, 'records');
      console.log('   pgvector status: CHECK (extension working)');
      results.user_memory = { status: 'OK', count: data?.length || 0 };
    }
  } catch (err) {
    console.log('   user_memory table: ERROR -', err.message);
    console.log('   pgvector status: WARNING - extension may not be enabled');
    results.user_memory = { status: 'ERROR', error: err.message };
  }

  console.log('\n4. RLS POLICIES');

  if (serviceKey) {
    console.log('   Service role key: CHECK (bypasses RLS)');
  } else {
    console.log('   Service role key: WARNING - using anon key (RLS active)');
  }

  console.log('\n=== SUMMARY ===\n');

  // Calculate overall status
  const errors = Object.values(results).filter(r => r && r.status === 'ERROR');
  const ok = Object.values(results).filter(r => r && r.status === 'OK');

  console.log('Tables checked:', Object.keys(results).length);
  console.log('OK:', ok.length);
  console.log('ERRORS:', errors.length);

  if (errors.length === 0) {
    console.log('\nSTATUS: HEALTHY - All systems operational');
    console.log('Connection: OK');
    console.log('Core tables: OK');
    console.log('pgvector: OK');
    return 0;
  } else if (errors.length <= 1 && results.user_memory?.status === 'ERROR') {
    console.log('\nSTATUS: DEGRADED - Core tables OK, pgvector may be missing');
    console.log('Connection: OK');
    console.log('Core tables: OK');
    console.log('pgvector: WARNING');
    return 0;
  } else {
    console.log('\nSTATUS: UNHEALTHY - Database connectivity issues');
    console.log('\nErrors detected:');
    Object.entries(results).forEach(([table, result]) => {
      if (result && result.status === 'ERROR') {
        console.log(`  - ${table}: ${result.error}`);
      }
    });
    return 1;
  }
}

main()
  .then(code => process.exit(code))
  .catch(err => {
    console.error('\nFATAL ERROR:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
