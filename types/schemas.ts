import { z } from 'zod';

/**
 * WhatsApp Webhook Validation Schemas (2025)
 * Based on WhatsApp Business API v23.0
 */

// E.164 phone number format (+ followed by 10-15 digits)
export const PhoneNumberSchema = z.string().regex(/^\+\d{10,15}$/, 'Invalid E.164 phone number');

// Message types
export const MessageTypeSchema = z.enum([
  'text',
  'image',
  'video',
  'document',
  'audio',
  'voice',
  'sticker',
  'location',
  'contacts',
  'interactive',
  'button',
  'reaction',
  'unsupported',
]);

// Text message
export const TextContentSchema = z.object({
  body: z.string().min(1),
});

// Media message (image, video, document, audio, sticker)
export const MediaContentSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  sha256: z.string().optional(),
  caption: z.string().optional(),
});

// Location message
export const LocationContentSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

// Reaction message
export const ReactionContentSchema = z.object({
  message_id: z.string(),
  emoji: z.string(),
});

// Interactive message schemas (discriminated union for type safety)
const ButtonReplyContentSchema = z.object({
  type: z.literal('button_reply'),
  button_reply: z.object({
    id: z.string(),
    title: z.string(),
  }),
})

const ListReplyContentSchema = z.object({
  type: z.literal('list_reply'),
  list_reply: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
  }),
})

// CTA Button Reply (v23.0)
const CTAButtonReplyContentSchema = z.object({
  type: z.literal('cta_url'),
  cta_url: z.object({
    id: z.string(),
    title: z.string(),
  }),
})

// Discriminated union for better type inference
export const InteractiveContentSchema = z.discriminatedUnion('type', [
  ButtonReplyContentSchema,
  ListReplyContentSchema,
  CTAButtonReplyContentSchema,
])

// Export types for use in message-normalization.ts
export type InteractiveContent = z.infer<typeof InteractiveContentSchema>
export type ButtonReplyContent = z.infer<typeof ButtonReplyContentSchema>
export type ListReplyContent = z.infer<typeof ListReplyContentSchema>
export type CTAButtonReplyContent = z.infer<typeof CTAButtonReplyContentSchema>

// WhatsApp message schema
export const WhatsAppMessageSchema = z.object({
  id: z.string(),
  from: PhoneNumberSchema,
  timestamp: z.string(),
  type: MessageTypeSchema,

  // Content by type (only one should be present)
  text: TextContentSchema.optional(),
  image: MediaContentSchema.optional(),
  video: MediaContentSchema.optional(),
  document: MediaContentSchema.optional(),
  audio: MediaContentSchema.optional(),
  voice: MediaContentSchema.optional(),
  sticker: MediaContentSchema.optional(),
  location: LocationContentSchema.optional(),
  reaction: ReactionContentSchema.optional(),
  interactive: InteractiveContentSchema.optional(),

  // Context (reply to message)
  context: z
    .object({
      from: PhoneNumberSchema.optional(),
      id: z.string(),
    })
    .optional(),
});

// Status update schema
export const StatusUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['sent', 'delivered', 'read', 'failed', 'deleted']),
  timestamp: z.string(),
  recipient_id: PhoneNumberSchema,
  conversation: z
    .object({
      id: z.string(),
      origin: z.object({
        type: z.string(),
      }),
    })
    .optional(),
  pricing: z
    .object({
      billable: z.boolean(),
      pricing_model: z.string(),
      category: z.string(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        title: z.string(),
        message: z.string().optional(),
        error_data: z
          .object({
            details: z.string(),
          })
          .optional(),
      })
    )
    .optional(),
});

// Value schema (contains messages or statuses)
export const ValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z
    .array(
      z.object({
        profile: z.object({
          name: z.string(),
        }),
        wa_id: PhoneNumberSchema,
      })
    )
    .optional(),
  messages: z.array(WhatsAppMessageSchema).optional(),
  statuses: z.array(StatusUpdateSchema).optional(),
});

// Call Event Value Schema (v23.0)
export const CallEventValueSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  call_event: z.object({
    type: z.enum(['call_initiated', 'call_accepted', 'call_rejected', 'call_ended']),
    call_id: z.string(),
    from: PhoneNumberSchema,
    to: PhoneNumberSchema,
    timestamp: z.string(),
    duration: z.number().optional(),
    reason: z.enum(['user_declined', 'user_busy', 'timeout']).optional(),
  }),
});

// Flow Webhook Value Schema (v23.0 - administrative/monitoring events)
export const FlowWebhookValueSchema = z.object({
  messaging_product: z.literal('whatsapp').optional(),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }).optional(),
  event: z.enum([
    'FLOW_STATUS_CHANGE',
    'CLIENT_ERROR_RATE',
    'ENDPOINT_ERROR_RATE',
    'ENDPOINT_LATENCY',
    'ENDPOINT_AVAILABILITY',
    'FLOW_VERSION_EXPIRY_WARNING',
  ]).optional(),
  flow_id: z.string().optional(),
  flow_name: z.string().optional(),
  status: z.string().optional(),
  error_rate: z.number().optional(),
  latency_ms: z.number().optional(),
}).passthrough(); // Allow additional fields for forward compatibility

// Generic change schema for unknown webhook types (future-proofing)
export const UnknownChangeSchema = z.object({
  value: z.unknown(),
  field: z.string(),
});

// Change schema
export const ChangeSchema = z.object({
  value: ValueSchema,
  field: z.literal('messages'),
});

// Call Event Change schema (v23.0)
export const CallEventChangeSchema = z.object({
  value: CallEventValueSchema,
  field: z.literal('call_events'),
});

// Flow Webhook Change schema (v23.0)
export const FlowChangeSchema = z.object({
  value: FlowWebhookValueSchema,
  field: z.literal('flows'),
});

// Entry schema - supports messages, call_events, flows, and unknown webhook types
export const EntrySchema = z.object({
  id: z.string(),
  changes: z.array(
    z.union([
      ChangeSchema,           // field: 'messages'
      CallEventChangeSchema,  // field: 'call_events'
      FlowChangeSchema,       // field: 'flows'
      UnknownChangeSchema,    // field: anything else (future-proof)
    ])
  ),
});

// Main webhook payload schema
export const WebhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(EntrySchema),
});

// Webhook verification schema (GET request)
export const WebhookVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
});

// Type exports
export type WhatsAppMessage = z.infer<typeof WhatsAppMessageSchema>;
export type StatusUpdate = z.infer<typeof StatusUpdateSchema>;
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
export type WebhookVerification = z.infer<typeof WebhookVerificationSchema>;
export type MessageType = z.infer<typeof MessageTypeSchema>;
export type CallEventValue = z.infer<typeof CallEventValueSchema>;
export type CallEvent = z.infer<typeof CallEventValueSchema>['call_event'];
export type FlowWebhookValue = z.infer<typeof FlowWebhookValueSchema>;
export type FlowChange = z.infer<typeof FlowChangeSchema>;
export type UnknownChange = z.infer<typeof UnknownChangeSchema>;

/**
 * Validate WhatsApp webhook payload
 * @returns Parsed payload or throws ZodError with validation details
 */
export function validateWebhookPayload(body: unknown): WebhookPayload {
  return WebhookPayloadSchema.parse(body);
}

/**
 * Safe validation with error handling
 * @returns { success: true, data } or { success: false, error }
 */
export function safeValidateWebhookPayload(body: unknown) {
  return WebhookPayloadSchema.safeParse(body);
}

/**
 * Validate webhook verification request (GET)
 * @returns Parsed verification params or throws ZodError
 */
export function validateWebhookVerification(params: unknown): WebhookVerification {
  return WebhookVerificationSchema.parse(params);
}

/**
 * Extract first message from webhook payload (helper)
 * Safe array access with noUncheckedIndexedAccess
 */
export function extractFirstMessage(payload: WebhookPayload): WhatsAppMessage | null {
  // Check array has elements before accessing with [0]
  if (payload.entry.length === 0) return null
  const entry = payload.entry[0]!

  if (entry.changes.length === 0) return null
  const change = entry.changes[0]!

  // Check if this is a message change (not a call event)
  if (change.field !== 'messages') return null

  // Type guard to ensure we have the right value type
  if (typeof change.value !== 'object' || change.value === null) return null
  if (!('messages' in change.value)) return null

  const messages = (change.value as { messages?: WhatsAppMessage[] }).messages
  if (!messages || messages.length === 0) return null

  return messages[0]!
}

/**
 * Extract first status update from webhook payload (helper)
 * Safe array access with noUncheckedIndexedAccess
 */
export function extractFirstStatus(payload: WebhookPayload): StatusUpdate | null {
  // Check array has elements before accessing with [0]
  if (payload.entry.length === 0) return null
  const entry = payload.entry[0]!

  if (entry.changes.length === 0) return null
  const change = entry.changes[0]!

  // Check if this is a message change (not a call event)
  if (change.field !== 'messages') return null

  // Type guard to ensure we have the right value type
  if (typeof change.value !== 'object' || change.value === null) return null
  if (!('statuses' in change.value)) return null

  const statuses = (change.value as { statuses?: StatusUpdate[] }).statuses
  if (!statuses || statuses.length === 0) return null

  return statuses[0]!
}

/**
 * Extract first call event from webhook payload (helper)
 * Safe array access with noUncheckedIndexedAccess
 */
export function extractFirstCallEvent(payload: WebhookPayload): CallEvent | null {
  // Check array has elements before accessing with [0]
  if (payload.entry.length === 0) return null
  const entry = payload.entry[0]!

  if (entry.changes.length === 0) return null
  const change = entry.changes[0]!

  // Check if this is a call event change
  if (change.field !== 'call_events') return null

  // Type guard to ensure we have the right value type
  if (typeof change.value !== 'object' || change.value === null) return null
  if (!('call_event' in change.value)) return null

  return (change.value as { call_event: CallEvent }).call_event
}

/**
 * Extract first flow event from webhook payload (helper)
 * Safe array access with noUncheckedIndexedAccess
 */
export function extractFirstFlowEvent(payload: WebhookPayload): FlowWebhookValue | null {
  // Check array has elements before accessing with [0]
  if (payload.entry.length === 0) return null
  const entry = payload.entry[0]!

  if (entry.changes.length === 0) return null
  const change = entry.changes[0]!

  // Check if this is a flow event change
  if (change.field !== 'flows') return null

  // Type guard to ensure we have the right value type
  if (!('value' in change)) return null

  return change.value as FlowWebhookValue
}
