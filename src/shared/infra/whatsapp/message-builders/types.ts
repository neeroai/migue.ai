/**
 * @file Message Builder Type Definitions
 * @description TypeScript interfaces for WhatsApp message payloads and builder options
 * @module lib/message-builders/types
 * @exports WhatsAppMessagePayload, MessageOptions
 * @runtime edge
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:46
 */

/**
 * WhatsApp Cloud API message payload structure
 * Used by ButtonMessage and ListMessage toPayload() methods
 */
export interface WhatsAppMessagePayload {
  /** Always 'whatsapp' for WhatsApp Cloud API */
  messaging_product: 'whatsapp';
  /** Recipient phone number in international format */
  to: string;
  /** Message type: 'interactive', 'text', 'template', etc. */
  type: string;
  /** Additional properties vary by message type */
  [key: string]: unknown;
}

/**
 * Optional header and footer text for interactive messages
 */
export interface MessageOptions {
  /** Optional header text (max 60 chars) */
  header?: string;
  /** Optional footer text (max 60 chars) */
  footer?: string;
}
