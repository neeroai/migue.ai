/**
 * Type definitions for WhatsApp message builders
 */

export interface WhatsAppMessagePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: unknown;
}

export interface MessageOptions {
  header?: string;
  footer?: string;
}
