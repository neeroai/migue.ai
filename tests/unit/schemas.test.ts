import { describe, it, expect } from '@jest/globals';
import {
  validateWebhookPayload,
  safeValidateWebhookPayload,
  extractFirstMessage,
  extractFirstStatus,
  extractFirstFlowEvent,
  PhoneNumberSchema,
  MessageTypeSchema,
  type WebhookPayload,
} from '../../types/schemas';

describe('WhatsApp Webhook Schemas', () => {
  describe('PhoneNumberSchema', () => {
    it('should validate valid E.164 phone numbers', () => {
      expect(() => PhoneNumberSchema.parse('+1234567890')).not.toThrow();
      expect(() => PhoneNumberSchema.parse('+123456789012345')).not.toThrow();
    });

    it('should reject invalid phone numbers', () => {
      expect(() => PhoneNumberSchema.parse('+123')).toThrow(); // Too short
      expect(() => PhoneNumberSchema.parse('+12345678901234567')).toThrow(); // Too long
      expect(() => PhoneNumberSchema.parse('+0123456789')).toThrow(); // Starts with +0 (invalid country code)
      expect(() => PhoneNumberSchema.parse('+abcd567890')).toThrow(); // Has letters
    });
  });

  describe('MessageTypeSchema', () => {
    it('should validate all supported message types', () => {
      const validTypes = ['text', 'image', 'video', 'document', 'audio', 'voice', 'sticker', 'location'];
      validTypes.forEach((type) => {
        expect(() => MessageTypeSchema.parse(type)).not.toThrow();
      });
    });

    it('should reject invalid message types', () => {
      expect(() => MessageTypeSchema.parse('invalid')).toThrow();
      expect(() => MessageTypeSchema.parse('')).toThrow();
    });
  });

  describe('validateWebhookPayload', () => {
    it('should validate valid text message webhook', () => {
      const validPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  contacts: [
                    {
                      profile: { name: 'John Doe' },
                      wa_id: '+1234567890',
                    },
                  ],
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello World' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

    const result = validateWebhookPayload(validPayload);
    expect(result).toBeDefined();
    expect(result.object).toBe('whatsapp_business_account');
  });

  it('should validate interactive button message webhook', () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'entry-123',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '1234567890',
                  phone_number_id: 'phone-123',
                },
                messages: [
                  {
                    id: 'msg-456',
                    from: '+1234567890',
                    timestamp: '1234567890',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: {
                        id: 'action:schedule_confirm',
                        title: 'Confirmar',
                      },
                    },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    }

    expect(() => validateWebhookPayload(payload)).not.toThrow()
  })

  it('should validate valid status update webhook', () => {
    const validPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  statuses: [
                    {
                      id: 'status-123',
                      status: 'delivered',
                      timestamp: '1234567890',
                      recipient_id: '+1234567890',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = validateWebhookPayload(validPayload);
      expect(result).toBeDefined();
    });

    it('should throw on invalid payload structure', () => {
      const invalidPayload = {
        object: 'invalid',
        entry: [],
      };

      expect(() => validateWebhookPayload(invalidPayload)).toThrow();
    });

    it('should throw on missing required fields', () => {
      const invalidPayload = {
        object: 'whatsapp_business_account',
        // missing entry
      };

      expect(() => validateWebhookPayload(invalidPayload)).toThrow();
    });
  });

  describe('safeValidateWebhookPayload', () => {
    it('should return success for valid payload', () => {
      const validPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Test' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
      }
    });

    it('should return error for invalid payload', () => {
      const invalidPayload = { invalid: 'data' };

      const result = safeValidateWebhookPayload(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('extractFirstMessage', () => {
    it('should extract first message from webhook', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const message = extractFirstMessage(payload);
      expect(message).toBeDefined();
      expect(message?.id).toBe('msg-123');
      expect(message?.text?.body).toBe('Hello');
    });

    it('should return null when no messages', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const message = extractFirstMessage(payload);
      expect(message).toBeNull();
    });
  });

  describe('extractFirstStatus', () => {
    it('should extract first status from webhook', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  statuses: [
                    {
                      id: 'status-123',
                      status: 'read',
                      timestamp: '1234567890',
                      recipient_id: '+1234567890',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const status = extractFirstStatus(payload);
      expect(status).toBeDefined();
      expect(status?.id).toBe('status-123');
      expect(status?.status).toBe('read');
    });

    it('should return null when no statuses', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const status = extractFirstStatus(payload);
      expect(status).toBeNull();
    });
  });

  describe('Flow Webhooks (v23.0)', () => {
    it('should validate field: flows with complete structure', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  event: 'FLOW_STATUS_CHANGE',
                  flow_id: 'flow_123',
                  flow_name: 'Test Flow',
                  status: 'PUBLISHED',
                },
                field: 'flows',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });

    it('should validate field: flows with minimal structure', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {},
                field: 'flows',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });

    it('should validate field: flows with error rate event', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  event: 'CLIENT_ERROR_RATE',
                  flow_id: 'flow_456',
                  error_rate: 0.05,
                },
                field: 'flows',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });

    it('should extract flow event from webhook', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  event: 'FLOW_STATUS_CHANGE',
                  flow_id: 'flow_789',
                  status: 'PUBLISHED',
                },
                field: 'flows',
              },
            ],
          },
        ],
      };

      const flowEvent = extractFirstFlowEvent(payload);
      expect(flowEvent).toBeDefined();
      expect(flowEvent?.event).toBe('FLOW_STATUS_CHANGE');
      expect(flowEvent?.flow_id).toBe('flow_789');
    });

    it('should return null when extracting flow event from non-flow webhook', () => {
      const payload: WebhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-123',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'phone-123',
                  },
                  messages: [
                    {
                      id: 'msg-123',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const flowEvent = extractFirstFlowEvent(payload);
      expect(flowEvent).toBeNull();
    });
  });

  describe('Unknown Webhook Field Types', () => {
    it('should accept unknown field types (future-proofing)', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  some_data: 'test',
                  nested: { key: 'value' },
                },
                field: 'message_template_status_update',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });

    it('should accept completely unknown field names', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: { data: 'anything' },
                field: 'some_future_webhook_type',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    it('should still accept field: messages', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'PHONE_ID',
                  },
                  messages: [
                    {
                      from: '+1234567890',
                      id: 'msg_123',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'hello' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });

    it('should still accept field: call_events', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'BUSINESS_ID',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '1234567890',
                    phone_number_id: 'PHONE_ID',
                  },
                  call_event: {
                    type: 'call_initiated',
                    call_id: 'call_123',
                    from: '+1234567890',
                    to: '+0987654321',
                    timestamp: '1234567890',
                  },
                },
                field: 'call_events',
              },
            ],
          },
        ],
      };

      const result = safeValidateWebhookPayload(payload);
      expect(result.success).toBe(true);
    });
  });
});
