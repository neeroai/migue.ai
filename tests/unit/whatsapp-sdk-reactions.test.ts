/**
 * WhatsApp SDK Reactions Test
 * Tests message reaction functionality from SDK wrapper
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock whatsapp-client-sdk before importing wrapper
const mockReactWithLike = jest.fn();
const mockReactWithLove = jest.fn();
const mockReactWithFire = jest.fn();
const mockReactWithCheck = jest.fn();
const mockSendReaction = jest.fn();
const mockMarkMessageAsRead = jest.fn();

jest.mock('whatsapp-client-sdk', () => ({
  WhatsAppClient: jest.fn().mockImplementation(() => ({
    reactWithLike: mockReactWithLike,
    reactWithLove: mockReactWithLove,
    reactWithFire: mockReactWithFire,
    reactWithCheck: mockReactWithCheck,
    sendReaction: mockSendReaction,
    markMessageAsRead: mockMarkMessageAsRead,
  })),
}));

describe('WhatsApp SDK Reactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReactWithLike.mockResolvedValue({ success: true, messageId: 'test-msg-id' });
    mockReactWithLove.mockResolvedValue({ success: true, messageId: 'test-msg-id' });
    mockReactWithFire.mockResolvedValue({ success: true, messageId: 'test-msg-id' });
    mockReactWithCheck.mockResolvedValue({ success: true, messageId: 'test-msg-id' });
    mockSendReaction.mockResolvedValue({ success: true, messageId: 'test-msg-id' });
    mockMarkMessageAsRead.mockResolvedValue({ success: true });
  });

  it('should send like reaction', async () => {
    const { reactWithLike } = await import('../../lib/whatsapp-sdk-wrapper');
    await reactWithLike('+1234567890', 'wamid.123');

    expect(mockReactWithLike).toHaveBeenCalledWith('+1234567890', 'wamid.123');
  });

  it('should send love reaction', async () => {
    const { reactWithLove } = await import('../../lib/whatsapp-sdk-wrapper');
    await reactWithLove('+1234567890', 'wamid.123');

    expect(mockReactWithLove).toHaveBeenCalledWith('+1234567890', 'wamid.123');
  });

  it('should send fire reaction', async () => {
    const { reactWithFire } = await import('../../lib/whatsapp-sdk-wrapper');
    await reactWithFire('+1234567890', 'wamid.123');

    expect(mockReactWithFire).toHaveBeenCalledWith('+1234567890', 'wamid.123');
  });

  it('should send check reaction', async () => {
    const { reactWithCheck } = await import('../../lib/whatsapp-sdk-wrapper');
    await reactWithCheck('+1234567890', 'wamid.123');

    expect(mockReactWithCheck).toHaveBeenCalledWith('+1234567890', 'wamid.123');
  });

  it('should send custom emoji reaction', async () => {
    const { sendReaction } = await import('../../lib/whatsapp-sdk-wrapper');
    await sendReaction('+1234567890', 'wamid.123', '🎉');

    expect(mockSendReaction).toHaveBeenCalledWith('+1234567890', 'wamid.123', '🎉');
  });

  it('should mark message as read', async () => {
    const { markMessageAsRead } = await import('../../lib/whatsapp-sdk-wrapper');
    await markMessageAsRead('wamid.123');

    expect(mockMarkMessageAsRead).toHaveBeenCalledWith('wamid.123');
  });
});
