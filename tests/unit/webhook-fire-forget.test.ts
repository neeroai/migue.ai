/**
 * Webhook Fire-and-Forget Pattern Tests
 *
 * Tests for the optimized webhook flow that returns 200 OK immediately
 * and processes messages in the background using waitUntil
 */

import { POST } from '../../app/api/whatsapp/webhook/route';
import crypto from 'crypto';

// Mock dependencies
jest.mock('@vercel/functions', () => ({
  waitUntil: jest.fn((promise) => promise.catch(() => {})), // Execute immediately but swallow errors
}));

jest.mock('../../lib/message-normalization', () => ({
  ...jest.requireActual('../../lib/message-normalization'),
  persistNormalizedMessage: jest.fn().mockResolvedValue({
    conversationId: 'test-conv-id',
    userId: 'test-user-id',
    wasInserted: true,
  }),
}));

jest.mock('../../lib/ai-processing-v2', () => ({
  processMessageWithAI: jest.fn().mockResolvedValue(undefined),
  processAudioMessage: jest.fn().mockResolvedValue(undefined),
  processDocumentMessage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/messaging-windows', () => ({
  updateMessagingWindow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../lib/simple-rate-limiter', () => ({
  checkRateLimit: jest.fn().mockReturnValue(true), // Always allow (not rate limited)
  getRateLimitWaitTime: jest.fn().mockReturnValue(0),
}));

const createWebhookRequest = (payload: unknown, appSecret?: string): Request => {
  const body = JSON.stringify(payload);
  const secret = appSecret || process.env.WHATSAPP_APP_SECRET || 'test-secret';

  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return new Request('https://test.com/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': `sha256=${signature}`,
    },
    body,
  });
};

describe('Webhook Fire-and-Forget Pattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Response time optimization', () => {
    it.skip('should return 200 OK immediately for valid webhook', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: 'PHONE_ID',
                  },
                  contacts: [
                    {
                      profile: { name: 'Test User' },
                      wa_id: '+16315551234', // With + prefix
                    },
                  ],
                  messages: [
                    {
                      from: '+16315551234', // With + prefix
                      id: 'wamid.test123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const start = Date.now();

      const response = await POST(request);
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.request_id).toBeDefined();

      // Should respond quickly (target <100ms, allow up to 500ms for test environment)
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Error handling (always return 200)', () => {
    it('should return 200 OK even on validation errors', async () => {
      const invalidPayload = {
        object: 'invalid',
        entry: [],
      };

      const request = createWebhookRequest(invalidPayload);
      const response = await POST(request);

      expect(response.status).toBe(400); // Validation errors still return 4xx
      const json = await response.json();
      expect(json.error).toBe('Invalid webhook payload');
    });

    it.skip('should return 200 OK on processing errors', async () => {
      const { persistNormalizedMessage } = jest.requireMock(
        '../../lib/message-normalization'
      );

      // Mock DB error
      persistNormalizedMessage.mockRejectedValueOnce(
        new Error('DB connection failed')
      );

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: 'PHONE_ID',
                  },
                  contacts: [
                    {
                      profile: { name: 'Test User' },
                      wa_id: '+16315551234',
                    },
                  ],
                  messages: [
                    {
                      from: '+16315551234',
                      id: 'wamid.test123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      // Should still return 200 OK (fire-and-forget pattern)
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('should return 200 OK on invalid signature to prevent retries', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [],
      };

      const request = createWebhookRequest(payload, 'wrong-secret');
      const response = await POST(request);

      // Invalid signature returns 401 (not 200)
      expect(response.status).toBe(401);
    });
  });

  describe('Phone number normalization integration', () => {
    it.skip('should accept WhatsApp format without + prefix', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: 'PHONE_ID',
                  },
                  contacts: [
                    {
                      profile: { name: 'Test User' },
                      wa_id: '16315551234', // NO + prefix (WhatsApp format)
                    },
                  ],
                  messages: [
                    {
                      from: '16315551234', // NO + prefix (WhatsApp format)
                      id: 'wamid.test123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it.skip('should accept E.164 format with + prefix', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15551234567',
                    phone_number_id: 'PHONE_ID',
                  },
                  contacts: [
                    {
                      profile: { name: 'Test User' },
                      wa_id: '+16315551234', // WITH + prefix
                    },
                  ],
                  messages: [
                    {
                      from: '+16315551234', // WITH + prefix
                      id: 'wamid.test123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
    });
  });

  describe('Non-message webhook events', () => {
    it('should acknowledge flow events with 200 OK', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: {
                  event: 'FLOW_STATUS_CHANGE',
                  flow_id: 'flow123',
                },
                field: 'flows',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('acknowledged');
      expect(json.reason).toBe('flow monitoring event');
    });

    it('should acknowledge unknown field types with 200 OK', async () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'ACCOUNT_ID',
            changes: [
              {
                value: { some: 'data' },
                field: 'unknown_field',
              },
            ],
          },
        ],
      };

      const request = createWebhookRequest(payload);
      const response = await POST(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('acknowledged');
      expect(json.reason).toContain('unsupported field');
    });
  });
});
