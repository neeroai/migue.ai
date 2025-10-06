/**
 * ListMessage Builder
 * Type-safe construction of WhatsApp interactive list messages
 *
 * Pattern from: Secreto31126/whatsapp-api-js
 * WhatsApp API v23.0 limits:
 * - Max 10 rows per section
 * - Button text: ≤20 chars
 * - Row title: ≤24 chars
 * - Row description: ≤72 chars
 * - Body text: ≤1024 chars
 */

import type { WhatsAppMessagePayload, MessageOptions } from './types';

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListOptions extends MessageOptions {
  sectionTitle?: string;
}

export class ListMessage {
  constructor(
    private body: string,
    private buttonText: string,
    private rows: ListRow[],
    private options?: ListOptions
  ) {
    // Validation - fail fast at construction time
    if (rows.length === 0) {
      throw new Error('At least 1 row required');
    }
    if (rows.length > 10) {
      throw new Error('Max 10 rows per section');
    }
    if (buttonText.length > 20) {
      throw new Error(`Button text "${buttonText}" exceeds 20 character limit`);
    }
    if (body.length > 1024) {
      throw new Error('Body text exceeds 1024 character limit');
    }

    // Validate WhatsApp API v23.0 character limits for each row
    rows.forEach((row) => {
      if (row.title.length > 24) {
        throw new Error(`Row title "${row.title}" exceeds 24 character limit`);
      }
      if (row.description && row.description.length > 72) {
        throw new Error(`Row description exceeds 72 character limit`);
      }
      if (row.id.length > 200) {
        throw new Error(`Row ID "${row.id}" exceeds 200 character limit`);
      }
    });

    if (options?.header && options.header.length > 60) {
      throw new Error('Header text exceeds 60 character limit');
    }

    if (options?.footer && options.footer.length > 60) {
      throw new Error('Footer text exceeds 60 character limit');
    }

    if (options?.sectionTitle && options.sectionTitle.length > 24) {
      throw new Error('Section title exceeds 24 character limit');
    }
  }

  toPayload(to: string): WhatsAppMessagePayload {
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: this.body },
        ...(this.options?.header && {
          header: { type: 'text', text: this.options.header },
        }),
        ...(this.options?.footer && {
          footer: { text: this.options.footer },
        }),
        action: {
          button: this.buttonText,
          sections: [
            {
              ...(this.options?.sectionTitle && {
                title: this.options.sectionTitle,
              }),
              rows: this.rows.map((r) => ({
                id: r.id,
                title: r.title,
                ...(r.description && { description: r.description }),
              })),
            },
          ],
        },
      },
    };
  }
}
