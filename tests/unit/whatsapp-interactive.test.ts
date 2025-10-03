/**
 * WhatsApp Interactive Features Test
 * Tests for interactive buttons and lists (sendInteractiveButtons, sendInteractiveList)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock environment variables
process.env.WHATSAPP_TOKEN = 'test-token';
process.env.WHATSAPP_PHONE_ID = 'test-phone-id';

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('WhatsApp Interactive Buttons', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear WhatsApp module caches
    const { _clearCaches } = await import('../../lib/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_interactive_123' }] }),
      text: async () => '',
    } as Response);
  });

  it('should send interactive buttons', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [
      { id: 'btn_1', title: 'Option 1' },
      { id: 'btn_2', title: 'Option 2' },
      { id: 'btn_3', title: 'Option 3' },
    ];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Choose an option:',
      buttons
    );

    expect(result).toBe('msg_interactive_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: expect.stringContaining('"type":"interactive"'),
      })
    );

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.type).toBe('interactive');
    expect(callBody.interactive.type).toBe('button');
    expect(callBody.interactive.body.text).toBe('Choose an option:');
    expect(callBody.interactive.action.buttons).toHaveLength(3);
    expect(callBody.interactive.action.buttons[0]!.reply.id).toBe('btn_1');
    expect(callBody.interactive.action.buttons[0]!.reply.title).toBe(
      'Option 1'
    );
  });

  it('should send interactive buttons with 1 button', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [{ id: 'btn_single', title: 'Single Button' }];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Single option',
      buttons
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.action.buttons).toHaveLength(1);
    expect(callBody.interactive.action.buttons[0]!.reply.id).toBe(
      'btn_single'
    );
  });

  it('should send interactive buttons with 2 buttons', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [
      { id: 'btn_yes', title: 'Yes' },
      { id: 'btn_no', title: 'No' },
    ];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Confirm?',
      buttons
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.action.buttons).toHaveLength(2);
  });

  it('should handle API errors for buttons', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid button format' } }),
      text: async () => '',
    } as Response);

    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [{ id: 'btn_1', title: 'Option 1' }];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Choose:',
      buttons
    );

    expect(result).toBeNull();
  });

  it('should handle missing credentials', async () => {
    const originalToken = process.env.WHATSAPP_TOKEN;
    const originalPhoneId = process.env.WHATSAPP_PHONE_ID;

    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_PHONE_ID;

    // Clear module cache to reload with new env
    jest.resetModules();

    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [{ id: 'btn_1', title: 'Option 1' }];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Choose:',
      buttons
    );

    expect(result).toBeNull();

    // Restore environment
    process.env.WHATSAPP_TOKEN = originalToken;
    process.env.WHATSAPP_PHONE_ID = originalPhoneId;
    jest.resetModules();
  });

  it('should send buttons with header option', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [
      { id: 'btn_1', title: 'Option 1' },
      { id: 'btn_2', title: 'Option 2' },
    ];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Choose an option:',
      buttons,
      { header: 'Important Question' }
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.header).toBeDefined();
    expect(callBody.interactive.header.type).toBe('text');
    expect(callBody.interactive.header.text).toBe('Important Question');
  });

  it('should send buttons with footer option', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [{ id: 'btn_1', title: 'Confirm' }];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Proceed?',
      buttons,
      { footer: 'Powered by migue.ai' }
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.footer).toBeDefined();
    expect(callBody.interactive.footer.text).toBe('Powered by migue.ai');
  });

  it('should send buttons with reply-to message ID', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [{ id: 'btn_yes', title: 'Yes' }];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Confirm this action?',
      buttons,
      { replyToMessageId: 'wamid.ORIGINAL_MSG_123' }
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.context).toBeDefined();
    expect(callBody.context.message_id).toBe('wamid.ORIGINAL_MSG_123');
  });

  it('should send buttons with all options (header, footer, reply-to)', async () => {
    const { sendInteractiveButtons } = await import('../../lib/whatsapp');

    const buttons = [
      { id: 'btn_accept', title: 'Accept' },
      { id: 'btn_decline', title: 'Decline' },
    ];

    const result = await sendInteractiveButtons(
      '1234567890',
      'Do you accept the terms?',
      buttons,
      {
        header: 'Terms & Conditions',
        footer: 'Reply to continue',
        replyToMessageId: 'wamid.TERMS_MSG_456',
      }
    );

    expect(result).toBe('msg_interactive_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.header.text).toBe('Terms & Conditions');
    expect(callBody.interactive.footer.text).toBe('Reply to continue');
    expect(callBody.context.message_id).toBe('wamid.TERMS_MSG_456');
  });
});

describe('WhatsApp Interactive Lists', () => {
  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear WhatsApp module caches
    const { _clearCaches } = await import('../../lib/whatsapp');
    _clearCaches();

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg_list_123' }] }),
      text: async () => '',
    } as Response);
  });

  it('should send interactive list', async () => {
    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = [
      { id: 'row_1', title: 'Option 1', description: 'First option' },
      { id: 'row_2', title: 'Option 2', description: 'Second option' },
      { id: 'row_3', title: 'Option 3' },
    ];

    const result = await sendInteractiveList(
      '1234567890',
      'Select an option:',
      'View Options',
      rows,
      'Available Options'
    );

    expect(result).toBe('msg_list_123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/test-phone-id/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        }),
        body: expect.stringContaining('"type":"interactive"'),
      })
    );

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.type).toBe('interactive');
    expect(callBody.interactive.type).toBe('list');
    expect(callBody.interactive.body.text).toBe('Select an option:');
    expect(callBody.interactive.action.button).toBe('View Options');
    expect(callBody.interactive.action.sections).toHaveLength(1);
    expect(callBody.interactive.action.sections[0]!.title).toBe(
      'Available Options'
    );
    expect(callBody.interactive.action.sections[0]!.rows).toHaveLength(3);
    expect(callBody.interactive.action.sections[0]!.rows[0]!.id).toBe('row_1');
    expect(callBody.interactive.action.sections[0]!.rows[0]!.title).toBe(
      'Option 1'
    );
    expect(callBody.interactive.action.sections[0]!.rows[0]!.description).toBe(
      'First option'
    );
  });

  it('should send interactive list with default section title', async () => {
    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = [
      { id: 'row_1', title: 'Option 1' },
      { id: 'row_2', title: 'Option 2' },
    ];

    const result = await sendInteractiveList(
      '1234567890',
      'Select:',
      'Choose',
      rows
    );

    expect(result).toBe('msg_list_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.action.sections[0]!.title).toBe('Opciones');
  });

  it('should send interactive list without descriptions', async () => {
    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = [
      { id: 'row_1', title: 'Option 1' },
      { id: 'row_2', title: 'Option 2' },
      { id: 'row_3', title: 'Option 3' },
    ];

    const result = await sendInteractiveList(
      '1234567890',
      'Pick one:',
      'Select',
      rows
    );

    expect(result).toBe('msg_list_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.action.sections[0]!.rows).toHaveLength(3);
    expect(callBody.interactive.action.sections[0]!.rows[0]!.description).toBeUndefined();
  });

  it('should handle API errors for lists', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Invalid list format' } }),
      text: async () => '',
    } as Response);

    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = [{ id: 'row_1', title: 'Option 1' }];

    const result = await sendInteractiveList(
      '1234567890',
      'Select:',
      'Choose',
      rows
    );

    expect(result).toBeNull();
  });

  it('should handle missing credentials for lists', async () => {
    const originalToken = process.env.WHATSAPP_TOKEN;
    const originalPhoneId = process.env.WHATSAPP_PHONE_ID;

    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_PHONE_ID;

    // Clear module cache to reload with new env
    jest.resetModules();

    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = [{ id: 'row_1', title: 'Option 1' }];

    const result = await sendInteractiveList(
      '1234567890',
      'Select:',
      'Choose',
      rows
    );

    expect(result).toBeNull();

    // Restore environment
    process.env.WHATSAPP_TOKEN = originalToken;
    process.env.WHATSAPP_PHONE_ID = originalPhoneId;
    jest.resetModules();
  });

  it('should handle lists with many rows', async () => {
    const { sendInteractiveList } = await import('../../lib/whatsapp');

    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `row_${i + 1}`,
      title: `Option ${i + 1}`,
      description: `Description ${i + 1}`,
    }));

    const result = await sendInteractiveList(
      '1234567890',
      'Select from 10 options:',
      'View All',
      rows
    );

    expect(result).toBe('msg_list_123');

    const callBody = JSON.parse(
      (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0]![1]!
        .body as string
    );

    expect(callBody.interactive.action.sections[0]!.rows).toHaveLength(10);
  });
});
