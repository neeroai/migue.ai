/**
 * WhatsApp Message Builders
 * Type-safe construction of interactive messages
 *
 * Usage:
 *   import { ButtonMessage, ListMessage } from '@/lib/message-builders';
 *
 *   const btn = new ButtonMessage('Choose', [{id: '1', title: 'Yes'}]);
 *   await sendWhatsAppRequest(btn.toPayload(phone));
 */

export { ButtonMessage } from './buttons';
export { ListMessage } from './lists';
export type { WhatsAppMessagePayload, MessageOptions } from './types';
