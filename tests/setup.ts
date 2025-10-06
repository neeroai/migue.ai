import '@edge-runtime/jest-expect';

// Mock environment variables for tests
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_TOKEN = 'test-whatsapp-token';
process.env.WHATSAPP_PHONE_ID = 'test-phone-id';
process.env.WHATSAPP_APP_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'; // Valid JWT format
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';
process.env.GROQ_API_KEY = 'gsk_test-key';
process.env.NODE_ENV = 'test';
process.env.TIMEZONE = 'America/Mexico_City';
process.env.LOG_LEVEL = 'error'; // Suppress logs in tests

// Global test timeout
jest.setTimeout(10000);
