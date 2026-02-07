import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  sendCTAButton,
  requestLocation,
  sendLocation,
  requestCallPermission,
  blockPhoneNumber,
  unblockPhoneNumber,
} from '../../src/shared/infra/whatsapp';
import { sendFlow, generateFlowToken } from '../../src/shared/infra/whatsapp/flows';
import { extractFirstCallEvent } from '../../types/schemas';

// Mock environment variables
const mockEnv = {
  WHATSAPP_TOKEN: 'test-token',
  WHATSAPP_PHONE_ID: 'test-phone-id',
};

// Mock fetch globally
global.fetch = jest.fn();

describe('WhatsApp v23.0 Features', () => {
  beforeEach(() => {
    // Set environment variables
    Object.assign(process.env, mockEnv);
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('CTA Buttons', () => {
    it('should send CTA button with valid URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-123' }] }),
      });

      const result = await sendCTAButton(
        '+1234567890',
        'Check out our website',
        'Visit Now',
        'https://example.com'
      );

      expect(result).toBe('msg-123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: expect.stringContaining('"type":"interactive"'),
        })
      );
    });

    it('should reject button text longer than 20 characters', async () => {
      const result = await sendCTAButton(
        '+1234567890',
        'Body text',
        'This button text is way too long',
        'https://example.com'
      );

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reject invalid URL format', async () => {
      const result = await sendCTAButton(
        '+1234567890',
        'Body text',
        'Click',
        'not-a-valid-url'
      );

      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should include optional header and footer', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-123' }] }),
      });

      await sendCTAButton(
        '+1234567890',
        'Body text',
        'Click',
        'https://example.com',
        {
          header: 'Special Offer',
          footer: 'Limited time only',
        }
      );

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs![1].body);

      expect(body.interactive.header).toEqual({
        type: 'text',
        text: 'Special Offer',
      });
      expect(body.interactive.footer).toEqual({
        text: 'Limited time only',
      });
    });
  });

  describe('Location Features', () => {
    it('should request user location', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-456' }] }),
      });

      const result = await requestLocation(
        '+1234567890',
        'Please share your location for delivery'
      );

      expect(result).toBe('msg-456');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs![1].body);

      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('location_request_message');
      expect(body.interactive.action.name).toBe('send_location');
    });

    it('should send location to user', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-789' }] }),
      });

      const result = await sendLocation('+1234567890', {
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'San Francisco Office',
        address: '123 Market St, San Francisco, CA',
      });

      expect(result).toBe('msg-789');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs![1].body);

      expect(body.type).toBe('location');
      expect(body.location.latitude).toBe(37.7749);
      expect(body.location.longitude).toBe(-122.4194);
    });
  });

  describe('Call Permission', () => {
    it('should request call permission', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'msg-call-123' }] }),
      });

      const result = await requestCallPermission(
        '+1234567890',
        'May we call you to discuss your order?'
      );

      expect(result).toBe('msg-call-123');

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(callArgs![1].body);

      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('call_permission_request');
      expect(body.interactive.action.name).toBe('request_call_permission');
    });
  });

  describe('Block API', () => {
    it('should block a phone number', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await blockPhoneNumber('+9876543210');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/block'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"+9876543210"'),
        })
      );
    });

    it('should unblock a phone number', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await unblockPhoneNumber('+9876543210');

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/block/%2B9876543210'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('should return false on block API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Error blocking number',
      });

      const result = await blockPhoneNumber('+9876543210');

      expect(result).toBe(false);
    });
  });

  describe('WhatsApp Flows', () => {
    it('should generate unique flow tokens', () => {
      const token1 = generateFlowToken();
      const token2 = generateFlowToken();

      expect(token1).toHaveLength(64); // 32 bytes as hex = 64 chars
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
    });

    it('should extract call event from webhook payload', () => {
      const payload = {
        object: 'whatsapp_business_account' as const,
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'call_events' as const,
                value: {
                  messaging_product: 'whatsapp' as const,
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'phone-123',
                  },
                  call_event: {
                    type: 'call_accepted' as const,
                    call_id: 'call-123',
                    from: '+1111111111',
                    to: '+2222222222',
                    timestamp: '2025-01-01T00:00:00Z',
                  },
                },
              },
            ],
          },
        ],
      };

      const callEvent = extractFirstCallEvent(payload);

      expect(callEvent).toBeDefined();
      expect(callEvent?.type).toBe('call_accepted');
      expect(callEvent?.call_id).toBe('call-123');
    });

    it('should return null for non-call-event payload', () => {
      const payload = {
        object: 'whatsapp_business_account' as const,
        entry: [
          {
            id: 'entry-1',
            changes: [
              {
                field: 'messages' as const,
                value: {
                  messaging_product: 'whatsapp' as const,
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'phone-123',
                  },
                  messages: [],
                },
              },
            ],
          },
        ],
      };

      const callEvent = extractFirstCallEvent(payload);
      expect(callEvent).toBeNull();
    });
  });
});

describe('WhatsApp v23.0 Integration', () => {
  it('should handle complete CTA button flow', async () => {
    // 1. Send CTA button
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'cta-msg-1' }] }),
    });

    const messageId = await sendCTAButton(
      '+1234567890',
      'Visit our store',
      'Shop Now',
      'https://shop.example.com'
    );

    expect(messageId).toBe('cta-msg-1');

    // 2. Verify the payload structure
    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const payload = JSON.parse(callArgs![1].body);

    expect(payload).toMatchObject({
      messaging_product: 'whatsapp',
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: 'Visit our store' },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: 'Shop Now',
            url: 'https://shop.example.com',
          },
        },
      },
    });
  });
});