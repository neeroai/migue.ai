/**
 * @file ButtonMessage Builder
 * @description Type-safe WhatsApp interactive button messages with API v23.0 validation (max 3 buttons, title ≤20 chars, body ≤1024 chars)
 * @module lib/message-builders/buttons
 * @exports ButtonMessage
 * @runtime edge
 * @see https://github.com/Secreto31126/whatsapp-api-js
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:46
 */

import type { WhatsAppMessagePayload, MessageOptions } from './types';

/**
 * Type-safe builder for WhatsApp interactive button messages with automatic validation
 * @throws {Error} If buttons array is empty or exceeds 3 buttons
 * @throws {Error} If any button title exceeds 20 chars or ID exceeds 256 chars
 * @throws {Error} If body exceeds 1024 chars, header/footer exceed 60 chars
 * @example
 * const msg = new ButtonMessage('Choose an option:', [
 *   { id: 'yes', title: 'Yes' },
 *   { id: 'no', title: 'No' }
 * ]);
 * await sendWhatsAppRequest(msg.toPayload(phoneNumber));
 */
export class ButtonMessage {
  /**
   * Creates a validated button message instance
   * @param body - Main message text (max 1024 chars)
   * @param buttons - 1-3 buttons with id (max 256 chars) and title (max 20 chars)
   * @param options - Optional header/footer (max 60 chars each)
   * @throws {Error} Validation errors thrown immediately at construction time
   */
  constructor(
    private body: string,
    private buttons: Array<{ id: string; title: string }>,
    private options?: MessageOptions
  ) {
    // Validation - fail fast at construction time
    if (buttons.length === 0) {
      throw new Error('At least 1 button required');
    }
    if (buttons.length > 3) {
      throw new Error('Max 3 buttons allowed. Use ListMessage for 4+ options.');
    }

    // Validate WhatsApp API v23.0 character limits
    buttons.forEach((button) => {
      if (button.title.length > 20) {
        throw new Error(`Button title "${button.title}" exceeds 20 character limit`);
      }
      if (button.id.length > 256) {
        throw new Error(`Button ID "${button.id}" exceeds 256 character limit`);
      }
    });

    if (body.length > 1024) {
      throw new Error('Body text exceeds 1024 character limit');
    }

    if (options?.header && options.header.length > 60) {
      throw new Error('Header text exceeds 60 character limit');
    }

    if (options?.footer && options.footer.length > 60) {
      throw new Error('Footer text exceeds 60 character limit');
    }
  }

  /**
   * Converts button message to WhatsApp Cloud API v23.0 payload format
   * @param to - Recipient phone number in international format (e.g., "573001234567")
   * @returns WhatsApp API payload ready for sendWhatsAppRequest
   */
  toPayload(to: string): WhatsAppMessagePayload {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: this.body },
        ...(this.options?.header && {
          header: { type: 'text', text: this.options.header },
        }),
        ...(this.options?.footer && {
          footer: { text: this.options.footer },
        }),
        action: {
          buttons: this.buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    };
  }
}
