/**
 * WhatsApp Cloud API v23.0 TypeScript Types
 * Complete type definitions for WhatsApp Business API features
 */

// =============================
// CTA (Call-to-Action) Buttons
// =============================

/**
 * Options for CTA Button messages
 */
export interface CTAButtonOptions {
  header?: string;
  footer?: string;
  replyToMessageId?: string;
}

/**
 * CTA Button API Payload
 */
export interface CTAButtonPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'cta_url';
    body: { text: string };
    action: {
      name: 'cta_url';
      parameters: {
        display_text: string;
        url: string;
      };
    };
    header?: { type: 'text'; text: string };
    footer?: { text: string };
  };
  context?: { message_id: string };
}

// =============================
// Location Messages
// =============================

/**
 * Options for location request messages
 */
export interface LocationRequestOptions {
  footer?: string;
  replyToMessageId?: string;
}

/**
 * Location Request Payload
 */
export interface LocationRequestPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'location_request_message';
    body: { text: string };
    action: {
      name: 'send_location';
    };
    footer?: { text: string };
  };
  context?: { message_id: string };
}

/**
 * Location data received from webhook
 */
export interface LocationData {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

/**
 * Send Location Payload
 */
export interface SendLocationPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'location';
  location: LocationData;
}

// =============================
// Call Permission
// =============================

/**
 * Options for call permission request
 */
export interface CallPermissionOptions {
  footer?: string;
  replyToMessageId?: string;
}

/**
 * Call Permission Request Payload
 */
export interface CallPermissionRequestPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'call_permission_request';
    body: { text: string };
    action: {
      name: 'request_call_permission';
    };
    footer?: { text: string };
  };
  context?: { message_id: string };
}

/**
 * Call Event Types
 */
export type CallEventType = 'call_initiated' | 'call_accepted' | 'call_rejected' | 'call_ended';

/**
 * Call Event from Webhook
 */
export interface CallEvent {
  type: CallEventType;
  call_id: string;
  from: string;
  to: string;
  timestamp: string;
  duration?: number;
  reason?: 'user_declined' | 'user_busy' | 'timeout';
}

// =============================
// WhatsApp Flows
// =============================

/**
 * Flow Types
 */
export type FlowType = 'navigate' | 'data_exchange';

/**
 * Flow Action Types
 */
export type FlowActionType = 'navigate' | 'data_exchange';

/**
 * Flow Message Payload
 */
export interface FlowMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'flow';
    header?: {
      type: 'text';
      text: string;
    };
    body: {
      text: string;
    };
    footer?: {
      text: string;
    };
    action: {
      name: 'flow';
      parameters: {
        flow_message_version: '3';
        flow_token: string;
        flow_id: string;
        flow_cta: string;
        flow_action: FlowActionType;
        flow_action_payload?: {
          screen: string;
          data?: Record<string, unknown>;
        };
      };
    };
  };
}

/**
 * Flow Session Status
 */
export type FlowSessionStatus = 'pending' | 'in_progress' | 'completed' | 'expired';

/**
 * Flow Data Exchange Request
 */
export interface FlowDataExchangeRequest {
  version: string;
  action: 'ping' | 'INIT' | 'data_exchange';
  screen: string;
  data: Record<string, unknown>;
  flow_token: string;
}

/**
 * Flow Data Exchange Response
 */
export interface FlowDataExchangeResponse {
  version: string;
  screen: string;
  data: Record<string, unknown>;
}

// =============================
// Block API
// =============================

/**
 * Block Phone Number Payload
 */
export interface BlockPhoneNumberPayload {
  messaging_product: 'whatsapp';
  phone_number: string;
}

/**
 * Blocked Number Info
 */
export interface BlockedNumberInfo {
  phone_number: string;
  blocked_at: string;
}

// =============================
// Common Types
// =============================

/**
 * WhatsApp API Response
 */
export interface WhatsAppAPIResponse {
  messaging_product: 'whatsapp';
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
  messages?: Array<{
    id: string;
    message_status?: string;
  }>;
}

/**
 * WhatsApp API Error Response
 */
export interface WhatsAppAPIError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: {
      messaging_product: string;
      details: string;
    };
    error_subcode?: number;
    fbtrace_id: string;
  };
}
