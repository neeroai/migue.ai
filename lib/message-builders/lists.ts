/**
 * @file ListMessage Builder
 * @description Type-safe WhatsApp interactive list messages with API v23.0 validation (max 10 rows, button ≤20 chars, row title ≤24 chars, body ≤1024 chars)
 * @module lib/message-builders/lists
 * @exports ListMessage
 * @runtime edge
 * @see https://github.com/Secreto31126/whatsapp-api-js
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:46
 */

import type { WhatsAppMessagePayload, MessageOptions } from './types';

/**
 * Single row in a list message
 */
interface ListRow {
  /** Unique identifier (max 200 chars) */
  id: string;
  /** Row title shown in list (max 24 chars) */
  title: string;
  /** Optional description under title (max 72 chars) */
  description?: string;
}

/**
 * Extended options for list messages
 */
interface ListOptions extends MessageOptions {
  /** Optional section title (max 24 chars) */
  sectionTitle?: string;
}

/**
 * Type-safe builder for WhatsApp interactive list messages with automatic validation
 * @throws {Error} If rows array is empty or exceeds 10 rows
 * @throws {Error} If button text exceeds 20 chars
 * @throws {Error} If any row title exceeds 24 chars, description exceeds 72 chars, or id exceeds 200 chars
 * @throws {Error} If body exceeds 1024 chars, header/footer/sectionTitle exceed limits
 * @example
 * const msg = new ListMessage(
 *   'Choose a category:',
 *   'View options',
 *   [
 *     { id: 'cat1', title: 'Category 1', description: 'First option' },
 *     { id: 'cat2', title: 'Category 2', description: 'Second option' }
 *   ],
 *   { sectionTitle: 'Categories' }
 * );
 * await sendWhatsAppRequest(msg.toPayload(phoneNumber));
 */
export class ListMessage {
  /**
   * Creates a validated list message instance
   * @param body - Main message text (max 1024 chars)
   * @param buttonText - Text shown on list button (max 20 chars)
   * @param rows - 1-10 list rows with id, title, optional description
   * @param options - Optional header/footer/sectionTitle
   * @throws {Error} Validation errors thrown immediately at construction time
   */
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

  /**
   * Converts list message to WhatsApp Cloud API v23.0 payload format
   * @param to - Recipient phone number in international format (e.g., "573001234567")
   * @returns WhatsApp API payload ready for sendWhatsAppRequest
   */
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
