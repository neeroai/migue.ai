/**
 * Phone Number E.164 Normalization Tests
 *
 * Tests for the updated PhoneNumberSchema that normalizes phone numbers
 * from WhatsApp format (no +) to E.164 format (+country code)
 */

import { PhoneNumberSchema } from '../../types/schemas';

describe('Phone Number E.164 Normalization', () => {
  describe('WhatsApp format normalization (no + prefix)', () => {
    it('should normalize US number without + prefix', () => {
      const result = PhoneNumberSchema.parse('16315551234');
      expect(result).toBe('+16315551234');
    });

    it('should normalize international number without + prefix', () => {
      const result = PhoneNumberSchema.parse('442071234567');
      expect(result).toBe('+442071234567');
    });

    it('should normalize Mexican number without + prefix', () => {
      const result = PhoneNumberSchema.parse('5215551234567');
      expect(result).toBe('+5215551234567');
    });
  });

  describe('Already formatted E.164 numbers', () => {
    it('should accept US number with + prefix', () => {
      const result = PhoneNumberSchema.parse('+16315551234');
      expect(result).toBe('+16315551234');
    });

    it('should accept UK number with + prefix', () => {
      const result = PhoneNumberSchema.parse('+442071234567');
      expect(result).toBe('+442071234567');
    });

    it('should accept Mexican number with + prefix', () => {
      const result = PhoneNumberSchema.parse('+5215551234567');
      expect(result).toBe('+5215551234567');
    });
  });

  describe('Invalid phone numbers', () => {
    it('should reject number starting with +0 (invalid country code)', () => {
      expect(() => PhoneNumberSchema.parse('+0123456789')).toThrow(
        'Invalid E.164 phone number'
      );
    });

    it('should reject number starting with 0 (becomes +0 after transform)', () => {
      expect(() => PhoneNumberSchema.parse('0123456789')).toThrow(
        'Invalid E.164 phone number'
      );
    });

    it('should reject number that is too short (<8 digits after +)', () => {
      expect(() => PhoneNumberSchema.parse('+1234567')).toThrow(
        'Invalid E.164 phone number'
      );
    });

    it('should reject number that is too long (>15 digits after +)', () => {
      expect(() => PhoneNumberSchema.parse('+1234567890123456')).toThrow(
        'Invalid E.164 phone number'
      );
    });

    it('should reject empty string', () => {
      expect(() => PhoneNumberSchema.parse('')).toThrow();
    });

    it('should reject number with letters', () => {
      expect(() => PhoneNumberSchema.parse('+16315551ABC')).toThrow(
        'Invalid E.164 phone number'
      );
    });
  });

  describe('Special character handling', () => {
    it('should remove spaces from phone number', () => {
      const result = PhoneNumberSchema.parse('+1 631 555 1234');
      expect(result).toBe('+16315551234');
    });

    it('should remove hyphens from phone number', () => {
      const result = PhoneNumberSchema.parse('+1-631-555-1234');
      expect(result).toBe('+16315551234');
    });

    it('should remove parentheses from phone number', () => {
      const result = PhoneNumberSchema.parse('+1(631)555-1234');
      expect(result).toBe('+16315551234');
    });

    it('should handle multiple special characters', () => {
      const result = PhoneNumberSchema.parse('+1 (631) 555-1234');
      expect(result).toBe('+16315551234');
    });

    it('should add + and remove special characters', () => {
      const result = PhoneNumberSchema.parse('1 (631) 555-1234');
      expect(result).toBe('+16315551234');
    });
  });

  describe('Edge cases', () => {
    it('should handle minimum valid length (8 digits)', () => {
      const result = PhoneNumberSchema.parse('+12345678'); // 8 digits
      expect(result).toBe('+12345678');
    });

    it('should handle maximum valid length (15 digits)', () => {
      const result = PhoneNumberSchema.parse('+123456789012345'); // 15 digits
      expect(result).toBe('+123456789012345');
    });

    it('should handle country code 1 (US/Canada)', () => {
      const result = PhoneNumberSchema.parse('16315551234');
      expect(result).toBe('+16315551234');
    });

    it('should handle country code 44 (UK)', () => {
      const result = PhoneNumberSchema.parse('442071234567');
      expect(result).toBe('+442071234567');
    });

    it('should handle country code 86 (China)', () => {
      const result = PhoneNumberSchema.parse('8613812345678');
      expect(result).toBe('+8613812345678');
    });
  });

  describe('Database constraint alignment', () => {
    it('should match DB regex: ^\\+[1-9][0-9]{7,14}$', () => {
      const dbRegex = /^\+[1-9][0-9]{7,14}$/;

      // Valid numbers should match DB constraint
      expect(PhoneNumberSchema.parse('16315551234')).toMatch(dbRegex);
      expect(PhoneNumberSchema.parse('+16315551234')).toMatch(dbRegex);
      expect(PhoneNumberSchema.parse('442071234567')).toMatch(dbRegex);
      expect(PhoneNumberSchema.parse('+5215551234567')).toMatch(dbRegex);
    });

    it('should reject numbers that violate DB constraint', () => {
      // Numbers starting with 0 (would become +0 after transform)
      expect(() => PhoneNumberSchema.parse('0123456789')).toThrow();
      expect(() => PhoneNumberSchema.parse('+0123456789')).toThrow();

      // Too short
      expect(() => PhoneNumberSchema.parse('+1234567')).toThrow();

      // Too long
      expect(() => PhoneNumberSchema.parse('+1234567890123456')).toThrow();
    });
  });

  describe('Real-world WhatsApp examples', () => {
    it('should handle WhatsApp US webhook format', () => {
      // WhatsApp sends without +
      const waFormat = '16315551234';
      const result = PhoneNumberSchema.parse(waFormat);
      expect(result).toBe('+16315551234');
    });

    it('should handle WhatsApp international webhook format', () => {
      // WhatsApp sends without +
      const waFormat = '442071234567';
      const result = PhoneNumberSchema.parse(waFormat);
      expect(result).toBe('+442071234567');
    });

    it('should handle WhatsApp Mexican webhook format', () => {
      // WhatsApp sends without +
      const waFormat = '5215551234567';
      const result = PhoneNumberSchema.parse(waFormat);
      expect(result).toBe('+5215551234567');
    });
  });
});
