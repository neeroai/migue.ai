/**
 * WhatsApp SDK Edge Runtime Compatibility Test
 * Tests if whatsapp-client-sdk works in Edge Runtime environment
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('WhatsApp SDK Edge Compatibility', () => {
  it('should import WhatsAppClient without errors', async () => {
    // Test if the package can be imported in Edge environment
    const { WhatsAppClient } = await import('whatsapp-client-sdk');
    expect(WhatsAppClient).toBeDefined();
  });

  it('should initialize client with config', async () => {
    const { WhatsAppClient } = await import('whatsapp-client-sdk');

    // Use valid-length test tokens (minimum 20 characters)
    const client = new WhatsAppClient({
      accessToken: 'test-token-12345678901234567890',
      phoneNumberId: 'test-phone-id-1234567890',
      webhookVerifyToken: 'test-verify-token-12345'
    });

    expect(client).toBeDefined();
  });

  it('should have required methods available', async () => {
    const { WhatsAppClient } = await import('whatsapp-client-sdk');

    const client = new WhatsAppClient({
      accessToken: 'test-token-12345678901234567890',
      phoneNumberId: 'test-phone-id-1234567890',
      webhookVerifyToken: 'test-verify-token-12345'
    });

    // Check for key methods we want to use
    expect(typeof client.sendText).toBe('function');
    expect(typeof client.sendReaction).toBe('function');
    expect(typeof client.reactWithLike).toBe('function');
    expect(typeof client.sendBroadcastText).toBe('function');
    expect(typeof client.createWebhookProcessor).toBe('function');
  });
});
