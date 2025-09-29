// Global test setup
import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.local' });

// Mock environment variables for tests
process.env.WHATSAPP_TOKEN = 'test_token';
process.env.WHATSAPP_PHONE_ID = 'test_phone_id';
process.env.WHATSAPP_VERIFY_TOKEN = 'test_verify_token';
process.env.WHATSAPP_APP_SECRET = 'test_app_secret';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test_supabase_key';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Global test timeout
jest.setTimeout(10000);