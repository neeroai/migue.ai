/**
 * ButtonMessage Builder
 * Type-safe construction of WhatsApp interactive button messages
 *
 * Pattern from: Secreto31126/whatsapp-api-js
 * WhatsApp API v23.0 limits:
 * - Max 3 buttons
 * - Button title: ≤20 chars
 * - Button ID: ≤256 chars
 * - Body text: ≤1024 chars
 */

import type { WhatsAppMessagePayload, MessageOptions } from './types';

export class ButtonMessage {
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
