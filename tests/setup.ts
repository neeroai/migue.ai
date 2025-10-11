import '@edge-runtime/jest-expect';
import { config } from 'dotenv';
import path from 'path';

// ============================================================================
// Best Practice 2025: Load .env.local for Integration Tests
// ============================================================================

const envPath = path.resolve(process.cwd(), '.env.local');
config({ path: envPath });

console.log('✅ Test environment setup:', {
  testType: process.env.TEST_TYPE || 'unit',
  geminiConfigured: !!process.env.GOOGLE_AI_API_KEY,
  supabaseConfigured: !!process.env.SUPABASE_URL,
  upstashConfigured: !!process.env.UPSTASH_REDIS_REST_URL
});

// ============================================================================
// Validate Required Environment Variables for Integration Tests
// ============================================================================

const requiredEnvVars = [
  'GOOGLE_AI_API_KEY',         // Gemini API
  'SUPABASE_URL',              // Database
  'SUPABASE_KEY',              // Database auth
  'UPSTASH_REDIS_REST_URL',    // Context caching
  'UPSTASH_REDIS_REST_TOKEN'   // Context caching
];

if (process.env.TEST_TYPE === 'integration') {
  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing env vars for integration tests:', missing.join(', '));
    console.error('📝 Fix: Copy .env.example to .env.local and configure API keys\n');
    process.exit(1);
  }

  console.log('✅ All required env vars configured for integration tests\n');
}

// ============================================================================
// Mock Environment Variables for Unit Tests (Fast, No API Calls)
// ============================================================================

if (process.env.TEST_TYPE !== 'integration') {
  // Override with mocks only for unit tests
  process.env.WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'test-verify-token';
  process.env.WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || 'test-whatsapp-token';
  process.env.WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || 'test-phone-id';
  process.env.WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET || 'test-secret';
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
  process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
  process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-google-client-secret';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key';
  process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'gsk_test-key';

  // Keep Supabase/Upstash mocks for unit tests
  if (!process.env.SUPABASE_URL) {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'; // Valid JWT format
  }

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  }
}

// ============================================================================
// Common Environment Variables
// ============================================================================

process.env.NODE_ENV = 'test';
process.env.TIMEZONE = 'America/Mexico_City';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // Suppress logs in tests

// Global test timeout (longer for integration tests)
const timeout = process.env.TEST_TYPE === 'integration' ? 30000 : 10000;
jest.setTimeout(timeout);

console.log(`⏱️  Test timeout: ${timeout}ms\n`);
