/**
 * WhatsApp Features Test
 * Tests reactions, enhanced typing indicators, and read receipts
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
    const { _clearCaches } = await import('../../lib/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_123' }] }),
      text: async () => '',
    } as Response);
  });

  it('should send emoji reaction', async () => {
    const { sendReaction } = await import('../../lib/whatsapp');

    const result = await sendReaction('1234567890', 'wamid.ABC123', '🔥');

    expect(result).toBe('msg_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        }),
        body: expect.stringContaining('"type":"reaction"'),
      })
    );

    const callBody = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string);
    expect(callBody.reaction.emoji).toBe('🔥');
    expect(callBody.reaction.message_id).toBe('wamid.ABC123');
  });

  it('should remove reaction with empty emoji', async () => {
    const { removeReaction } = await import('../../lib/whatsapp');

    await removeReaction('1234567890', 'wamid.ABC123');

    const callBody = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string);
    expect(callBody.reaction.emoji).toBe('');
  });

  it('should send check reaction', async () => {
    const { reactWithCheck } = await import('../../lib/whatsapp');

    await reactWithCheck('1234567890', 'wamid.ABC123');

    const callBody = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string);
    expect(callBody.reaction.emoji).toBe('✅');
  });

  it('should send thinking reaction', async () => {
    const { reactWithThinking } = await import('../../lib/whatsapp');

    await reactWithThinking('1234567890', 'wamid.ABC123');

    const callBody = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string);
    expect(callBody.reaction.emoji).toBe('🤔');
  });


  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Invalid message ID',
    } as Response);

    const { sendReaction } = await import('../../lib/whatsapp');
    const { WhatsAppAPIError } = await import('../../lib/whatsapp-errors');

    await expect(sendReaction('1234567890', 'invalid', '🔥')).rejects.toThrow(
      WhatsAppAPIError
    );
  });
});

describe('WhatsApp Read Receipts', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear WhatsApp module caches
    const { _clearCaches } = await import('../../lib/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      text: async () => '',
    } as Response);
  });

  it('should mark message as read', async () => {
    const { markAsRead } = await import('../../lib/whatsapp');

    await markAsRead('wamid.ABC123');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
      })
    );

    const callBody = JSON.parse((global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!.body as string);
    expect(callBody.status).toBe('read');
    expect(callBody.message_id).toBe('wamid.ABC123');
    expect(callBody.typing_indicator).toBeUndefined();
  });

  it('should handle missing credentials', async () => {
    const originalToken = process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_TOKEN;

    const { markAsRead } = await import('../../lib/whatsapp');

    await expect(markAsRead('wamid.ABC123')).rejects.toThrow(
      'Missing WhatsApp credentials'
    );

    process.env.WHATSAPP_TOKEN = originalToken;
  });
});

describe('Enhanced Typing Manager', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Clear WhatsApp module caches
    const { _clearCaches } = await import('../../lib/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
      text: async () => '',
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start typing indicator', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');
    await typing.start();

    expect(global.fetch).toHaveBeenCalled();
    expect(typing.isActive()).toBe(true);
  });

  it('should stop typing indicator', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');
    await typing.start();
    await typing.stop();

    expect(typing.isActive()).toBe(false);
  });

  it('should not start typing if already active', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');
    await typing.start();

    jest.clearAllMocks();
    await typing.start();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should start typing with duration and auto-stop', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');
    await typing.startWithDuration(5);

    expect(typing.isActive()).toBe(true);

    // Fast-forward time by 5 seconds
    jest.advanceTimersByTime(5000);

    expect(typing.isActive()).toBe(false);
  });

  it('should limit duration to 25 seconds max', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');
    await typing.startWithDuration(30); // Request 30 seconds

    expect(typing.isActive()).toBe(true);

    // Fast-forward by 25 seconds (max allowed)
    jest.advanceTimersByTime(25000);

    expect(typing.isActive()).toBe(false);

    // Fast-forward another 5 seconds to verify it stopped at 25s
    jest.advanceTimersByTime(5000);

    expect(typing.isActive()).toBe(false);
  });

  it('should clear previous timeout when calling startWithDuration again', async () => {
    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');

    await typing.startWithDuration(10);
    expect(typing.isActive()).toBe(true);

    // Start new duration before first one expires
    jest.advanceTimersByTime(5000);
    await typing.startWithDuration(10);

    // Old timeout should be cleared, only new one active
    jest.advanceTimersByTime(5000); // Total 10s from first call
    expect(typing.isActive()).toBe(true); // Still active due to new timeout

    jest.advanceTimersByTime(5000); // 10s from second call
    expect(typing.isActive()).toBe(false); // Now inactive
  });

  it('should handle API errors gracefully', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { createTypingManager } = await import('../../lib/whatsapp');

    const typing = createTypingManager('1234567890', 'wamid.ABC123');

    // Should not throw error, just log it
    await typing.start();

    expect(typing.isActive()).toBe(false);
  });
});
