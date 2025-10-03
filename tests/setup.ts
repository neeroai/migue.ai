import '@edge-runtime/jest-expect';

// Mock environment variables for tests
process.env.WHATSAPP_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_TOKEN = 'test-whatsapp-token';
process.env.WHATSAPP_PHONE_ID = 'test-phone-id';
process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.OPENAI_API_KEY = 'sk-test-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_KEY = 'test-supabase-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

// Global test timeout
jest.setTimeout(10000);
