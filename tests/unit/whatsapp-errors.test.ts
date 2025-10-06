/**
 * WhatsApp Error Hints Unit Tests
 * Tests for error hint system providing actionable guidance
 */

import { describe, test, expect } from '@jest/globals';
import { getWhatsAppErrorHint, WhatsAppAPIError } from '@/lib/whatsapp-errors';

describe('getWhatsAppErrorHint', () => {
  describe('Meta Graph API error codes', () => {
    test('provides hint for expired token (error 190)', () => {
      const hint = getWhatsAppErrorHint({
        status: 401,
        errorCode: 190,
      });

      expect(hint).toContain('Access token expired');
      expect(hint).toContain('https://developers.facebook.com/apps');
      expect(hint).toContain('whatsapp_business_messaging permission');
      expect(hint).toContain('System user tokens never expire');
    });

    test('provides hint for invalid phone number ID (error 100, subcode 33)', () => {
      const hint = getWhatsAppErrorHint({
        status: 400,
        errorCode: 100,
        errorSubcode: 33,
      });

      expect(hint).toContain('Invalid Phone Number ID');
      expect(hint).toContain('https://business.facebook.com');
      expect(hint).toContain('15-digit number');
    });

    test('provides hint for generic error 100 (invalid parameter)', () => {
      const hint = getWhatsAppErrorHint({
        status: 400,
        errorCode: 100,
      });

      expect(hint).toContain('Invalid parameter');
      expect(hint).toContain('button/list limits');
      expect(hint).toContain('3 buttons max, 10 list rows max');
    });

    test('provides hint for recipient cannot be messaged (error 131026)', () => {
      const hint = getWhatsAppErrorHint({
        status: 400,
        errorCode: 131026,
      });

      expect(hint).toContain('Recipient cannot be messaged');
      expect(hint).toContain('blocked');
      expect(hint).toContain('opted in');
      expect(hint).toContain('24-hour conversation window');
    });

    test('provides hint for message outside window (error 131031)', () => {
      const hint = getWhatsAppErrorHint({
        status: 400,
        errorCode: 131031,
      });

      expect(hint).toContain('outside 24-hour conversation window');
      expect(hint).toContain('approved message template');
      expect(hint).toContain('Templates:');
    });
  });

  describe('HTTP status codes', () => {
    test('provides hint for 400 Bad Request', () => {
      const hint = getWhatsAppErrorHint({ status: 400 });

      expect(hint).toContain('Bad Request');
      expect(hint).toContain('Invalid payload');
      expect(hint).toContain('button/list character limits');
    });

    test('provides hint for 401 Unauthorized', () => {
      const hint = getWhatsAppErrorHint({ status: 401 });

      expect(hint).toContain('Unauthorized');
      expect(hint).toContain('Access token invalid');
      expect(hint).toContain('WHATSAPP_TOKEN');
    });

    test('provides hint for 403 Forbidden', () => {
      const hint = getWhatsAppErrorHint({ status: 403 });

      expect(hint).toContain('Forbidden');
      expect(hint).toContain('permissions');
      expect(hint).toContain('250 messages/sec');
      expect(hint).toContain('1000 messages/day (Sandbox');
      expect(hint).toContain('10,000 messages/day (Tier 1');
    });

    test('provides hint for 404 Not Found', () => {
      const hint = getWhatsAppErrorHint({ status: 404 });

      expect(hint).toContain('Not Found');
      expect(hint).toContain('Phone Number ID');
      expect(hint).toContain('WHATSAPP_PHONE_ID');
      expect(hint).toContain('E.164 format');
    });

    test('provides hint for 429 Rate Limit', () => {
      const hint = getWhatsAppErrorHint({ status: 429 });

      expect(hint).toContain('Rate Limit');
      expect(hint).toContain('250 msg/sec');
      expect(hint).toContain('exponential backoff');
      expect(hint).toContain('1s, 2s, 4s, 8s');
      expect(hint).toContain('Upstash/Redis');
    });

    test('provides hint for 500 Internal Server Error', () => {
      const hint = getWhatsAppErrorHint({ status: 500 });

      expect(hint).toContain('Internal Server Error');
      expect(hint).toContain('exponential backoff');
      expect(hint).toContain('https://status.fb.com');
      expect(hint).toContain('developers.facebook.com/support');
    });

    test('provides hint for 503 Service Unavailable', () => {
      const hint = getWhatsAppErrorHint({ status: 503 });

      expect(hint).toContain('Service Unavailable');
      expect(hint).toContain('temporary outage');
      expect(hint).toContain('Retry in 60 seconds');
      expect(hint).toContain('dead letter queue');
    });
  });

  describe('Generic errors', () => {
    test('provides generic hint for unknown status code', () => {
      const hint = getWhatsAppErrorHint({ status: 418 }); // I'm a teapot

      expect(hint).toContain('WhatsApp API Error 418');
      expect(hint).toContain('developers.facebook.com/apps');
      expect(hint).toContain('business.facebook.com');
      expect(hint).toContain('phone number status');
    });

    test('includes error code in generic hint when provided', () => {
      const hint = getWhatsAppErrorHint({
        status: 418,
        errorCode: 999,
      });

      expect(hint).toContain('error code 999');
    });

    test('handles missing error message gracefully', () => {
      const hint = getWhatsAppErrorHint({
        status: 500,
        errorCode: undefined,
        errorSubcode: undefined,
        message: undefined,
      });

      expect(hint).toContain('Internal Server Error');
      expect(hint).not.toContain('undefined');
    });
  });

  describe('Error hint structure', () => {
    test('all hints include actionable arrows (→)', () => {
      const statuses = [400, 401, 403, 404, 429, 500, 503];

      statuses.forEach((status) => {
        const hint = getWhatsAppErrorHint({ status });
        expect(hint).toContain('→');
      });
    });

    test('all hints include relevant URLs', () => {
      const hint400 = getWhatsAppErrorHint({ status: 400 });
      const hint401 = getWhatsAppErrorHint({ status: 401 });
      const hint500 = getWhatsAppErrorHint({ status: 500 });

      expect(hint400).toMatch(/https?:\/\//);
      expect(hint401).toMatch(/https?:\/\//);
      expect(hint500).toMatch(/https?:\/\//);
    });

    test('hints are multi-line with clear structure', () => {
      const hint = getWhatsAppErrorHint({ status: 403 });
      const lines = hint.split('\n');

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('Forbidden');
    });
  });
});

describe('WhatsAppAPIError', () => {
  test('creates error with hint and details', () => {
    const details = {
      status: 429,
      errorCode: undefined,
      errorSubcode: undefined,
      message: 'Rate limit exceeded',
    };
    const hint = getWhatsAppErrorHint(details);
    const error = new WhatsAppAPIError(details, hint);

    expect(error.name).toBe('WhatsAppAPIError');
    expect(error.details).toEqual(details);
    expect(error.hint).toBe(hint);
    expect(error.message).toContain('Rate Limit');
    expect(error.message).toContain('Error details:');
    expect(error.message).toContain('"status": 429');
  });

  test('error message includes formatted JSON details', () => {
    const details = {
      status: 401,
      errorCode: 190,
      errorSubcode: undefined,
      message: 'Invalid OAuth access token',
    };
    const hint = getWhatsAppErrorHint(details);
    const error = new WhatsAppAPIError(details, hint);

    expect(error.message).toContain('"errorCode": 190');
    expect(error.message).toContain('"message": "Invalid OAuth access token"');
  });

  test('error can be thrown and caught', () => {
    const details = { status: 500 };
    const hint = getWhatsAppErrorHint(details);

    expect(() => {
      throw new WhatsAppAPIError(details, hint);
    }).toThrow(WhatsAppAPIError);

    try {
      throw new WhatsAppAPIError(details, hint);
    } catch (err) {
      expect(err).toBeInstanceOf(WhatsAppAPIError);
      if (err instanceof WhatsAppAPIError) {
        expect(err.details.status).toBe(500);
        expect(err.hint).toContain('Internal Server Error');
      }
    }
  });

  test('error includes stack trace', () => {
    const details = { status: 400 };
    const hint = getWhatsAppErrorHint(details);
    const error = new WhatsAppAPIError(details, hint);

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('WhatsAppAPIError');
  });
});
