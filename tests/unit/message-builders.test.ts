/**
 * Message Builders Unit Tests
 * Tests for type-safe WhatsApp message construction
 */

import { describe, test, expect } from '@jest/globals';
import { ButtonMessage, ListMessage } from '@/src/shared/infra/whatsapp/message-builders';

describe('ButtonMessage', () => {
  test('creates valid button message payload', () => {
    const message = new ButtonMessage('Choose your option', [
      { id: 'opt1', title: 'Option 1' },
      { id: 'opt2', title: 'Option 2' },
    ]);

    const payload = message.toPayload('+1234567890');

    expect(payload.messaging_product).toBe('whatsapp');
    expect(payload.to).toBe('+1234567890');
    expect(payload.type).toBe('interactive');
    expect(payload.interactive.type).toBe('button');
    expect(payload.interactive.body.text).toBe('Choose your option');
    expect(payload.interactive.action.buttons).toHaveLength(2);
    expect(payload.interactive.action.buttons[0]!.reply.id).toBe('opt1');
    expect(payload.interactive.action.buttons[0]!.reply.title).toBe('Option 1');
  });

  test('includes optional header and footer', () => {
    const message = new ButtonMessage(
      'Body text',
      [{ id: '1', title: 'Button' }],
      {
        header: 'Header text',
        footer: 'Footer text',
      }
    );

    const payload = message.toPayload('+1234567890');

    expect(payload.interactive.header).toEqual({
      type: 'text',
      text: 'Header text',
    });
    expect(payload.interactive.footer).toEqual({
      text: 'Footer text',
    });
  });

  test('throws error when no buttons provided', () => {
    expect(() => {
      new ButtonMessage('Choose', []);
    }).toThrow('At least 1 button required');
  });

  test('throws error when more than 3 buttons', () => {
    expect(() => {
      new ButtonMessage('Choose', [
        { id: '1', title: 'Option 1' },
        { id: '2', title: 'Option 2' },
        { id: '3', title: 'Option 3' },
        { id: '4', title: 'Option 4' },
      ]);
    }).toThrow('Max 3 buttons allowed');
  });

  test('throws error when button title exceeds 20 characters', () => {
    expect(() => {
      new ButtonMessage('Choose', [
        { id: '1', title: 'This title is way too long for WhatsApp' },
      ]);
    }).toThrow('exceeds 20 character limit');
  });

  test('throws error when button ID exceeds 256 characters', () => {
    const longId = 'x'.repeat(257);
    expect(() => {
      new ButtonMessage('Choose', [{ id: longId, title: 'Button' }]);
    }).toThrow('exceeds 256 character limit');
  });

  test('throws error when body text exceeds 1024 characters', () => {
    const longBody = 'x'.repeat(1025);
    expect(() => {
      new ButtonMessage(longBody, [{ id: '1', title: 'Button' }]);
    }).toThrow('Body text exceeds 1024 character limit');
  });

  test('throws error when header exceeds 60 characters', () => {
    const longHeader = 'x'.repeat(61);
    expect(() => {
      new ButtonMessage('Body', [{ id: '1', title: 'Button' }], {
        header: longHeader,
      });
    }).toThrow('Header text exceeds 60 character limit');
  });

  test('throws error when footer exceeds 60 characters', () => {
    const longFooter = 'x'.repeat(61);
    expect(() => {
      new ButtonMessage('Body', [{ id: '1', title: 'Button' }], {
        footer: longFooter,
      });
    }).toThrow('Footer text exceeds 60 character limit');
  });

  test('validates exactly 3 buttons is allowed', () => {
    expect(() => {
      new ButtonMessage('Choose', [
        { id: '1', title: 'Option 1' },
        { id: '2', title: 'Option 2' },
        { id: '3', title: 'Option 3' },
      ]);
    }).not.toThrow();
  });
});

describe('ListMessage', () => {
  test('creates valid list message payload', () => {
    const message = new ListMessage('Select a service', 'View Services', [
      { id: '1', title: 'Service A', description: 'Description A' },
      { id: '2', title: 'Service B' },
    ]);

    const payload = message.toPayload('+1234567890');

    expect(payload.messaging_product).toBe('whatsapp');
    expect(payload.to).toBe('+1234567890');
    expect(payload.type).toBe('interactive');
    expect(payload.interactive.type).toBe('list');
    expect(payload.interactive.body.text).toBe('Select a service');
    expect(payload.interactive.action.button).toBe('View Services');
    expect(payload.interactive.action.sections).toHaveLength(1);
    expect(payload.interactive.action.sections[0]!.rows).toHaveLength(2);
    expect(payload.interactive.action.sections[0]!.rows[0]!.id).toBe('1');
    expect(payload.interactive.action.sections[0]!.rows[0]!.title).toBe('Service A');
    expect(payload.interactive.action.sections[0]!.rows[0]!.description).toBe('Description A');
    expect(payload.interactive.action.sections[0]!.rows[1]!.description).toBeUndefined();
  });

  test('includes optional section title, header, and footer', () => {
    const message = new ListMessage(
      'Body text',
      'Button',
      [{ id: '1', title: 'Row' }],
      {
        sectionTitle: 'Section Title',
        header: 'Header text',
        footer: 'Footer text',
      }
    );

    const payload = message.toPayload('+1234567890');

    expect(payload.interactive.action.sections[0]!.title).toBe('Section Title');
    expect(payload.interactive.header).toEqual({
      type: 'text',
      text: 'Header text',
    });
    expect(payload.interactive.footer).toEqual({
      text: 'Footer text',
    });
  });

  test('throws error when no rows provided', () => {
    expect(() => {
      new ListMessage('Body', 'Button', []);
    }).toThrow('At least 1 row required');
  });

  test('throws error when more than 10 rows', () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({
      id: `${i}`,
      title: `Option ${i}`,
    }));

    expect(() => {
      new ListMessage('Body', 'Button', rows);
    }).toThrow('Max 10 rows');
  });

  test('throws error when button text exceeds 20 characters', () => {
    expect(() => {
      new ListMessage('Body', 'This button text is way too long', [
        { id: '1', title: 'Row' },
      ]);
    }).toThrow('exceeds 20 character limit');
  });

  test('throws error when row title exceeds 24 characters', () => {
    expect(() => {
      new ListMessage('Body', 'Button', [
        { id: '1', title: 'This row title is way too long for WhatsApp' },
      ]);
    }).toThrow('exceeds 24 character limit');
  });

  test('throws error when row description exceeds 72 characters', () => {
    const longDescription = 'x'.repeat(73);
    expect(() => {
      new ListMessage('Body', 'Button', [
        { id: '1', title: 'Row', description: longDescription },
      ]);
    }).toThrow('Row description exceeds 72 character limit');
  });

  test('throws error when row ID exceeds 200 characters', () => {
    const longId = 'x'.repeat(201);
    expect(() => {
      new ListMessage('Body', 'Button', [{ id: longId, title: 'Row' }]);
    }).toThrow('exceeds 200 character limit');
  });

  test('throws error when section title exceeds 24 characters', () => {
    const longTitle = 'x'.repeat(25);
    expect(() => {
      new ListMessage('Body', 'Button', [{ id: '1', title: 'Row' }], {
        sectionTitle: longTitle,
      });
    }).toThrow('Section title exceeds 24 character limit');
  });

  test('validates exactly 10 rows is allowed', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`,
      title: `Option ${i}`,
    }));

    expect(() => {
      new ListMessage('Body', 'Button', rows);
    }).not.toThrow();
  });

  test('omits description when not provided', () => {
    const message = new ListMessage('Body', 'Button', [
      { id: '1', title: 'Row without description' },
    ]);

    const payload = message.toPayload('+1234567890');
    expect(payload.interactive.action.sections[0]!.rows[0]!.description).toBeUndefined();
  });
});
