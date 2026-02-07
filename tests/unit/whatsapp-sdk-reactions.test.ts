/**
 * WhatsApp Reactions Test
 * Tests message reaction functionality from lib/whatsapp.ts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock environment variables
process.env.WHATSAPP_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_ID = 'test-phone-id';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('WhatsApp Reactions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear WhatsApp module caches
    const { _clearCaches } = await import('../../src/shared/infra/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'test-msg-id' }] }),
      text: async () => '',
    } as Response);
  });



  it('should send check reaction', async () => {
    const { reactWithCheck } = await import('../../src/shared/infra/whatsapp');

    const result = await reactWithCheck('+1234567890', 'wamid.123');

    expect(result).toBe('test-msg-id');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"emoji":"✅"'),
      })
    );
  });

  it('should send custom emoji reaction', async () => {
    const { sendReaction } = await import('../../src/shared/infra/whatsapp');

    const result = await sendReaction('+1234567890', 'wamid.123', '🎉');

    expect(result).toBe('test-msg-id');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string
    );
    expect(callBody.reaction.emoji).toBe('🎉');
    expect(callBody.reaction.message_id).toBe('wamid.123');
  });

  it('should remove reaction', async () => {
    const { removeReaction } = await import('../../src/shared/infra/whatsapp');

    const result = await removeReaction('+1234567890', 'wamid.123');

    expect(result).toBe('test-msg-id');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string
    );
    expect(callBody.reaction.emoji).toBe('');
    expect(callBody.reaction.message_id).toBe('wamid.123');
  });

  it('should mark message as read', async () => {
    const { markAsRead } = await import('../../src/shared/infra/whatsapp');

    await markAsRead('wamid.123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"status":"read"'),
      })
    );

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string
    );
    expect(callBody.message_id).toBe('wamid.123');
  });
});
