/**
 * WhatsApp Flows - v23.0 Implementation
 * Handles interactive flow messages and data exchange
 *
 * ✅ Edge Runtime Compatible - Uses Web Crypto API
 */

import { sendWhatsAppRequest } from './whatsapp';
import { getSupabaseServerClient } from './supabase';
import type {
  FlowMessagePayload,
  FlowDataExchangeRequest,
  FlowDataExchangeResponse,
  FlowSessionStatus,
} from '@/types/whatsapp';

/**
 * Generate a secure flow token using Web Crypto API (Edge Runtime compatible)
 */
export function generateFlowToken(): string {
  // Use Web Crypto API available in Edge Runtime
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ArrayBuffer to hex string
 */
function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Generate HMAC-SHA256 hex signature (same as webhook validation)
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return hex(sig);
}

/**
 * Validate WhatsApp Flow signature
 * Uses the same HMAC-SHA256 validation as webhooks
 *
 * @param req - Request with x-hub-signature-256 header
 * @param rawBody - Raw request body as string
 * @returns true if signature is valid
 */
export async function validateFlowSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256');
  const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

  // Security: Fail closed in production if credentials missing
  if (!header || !WHATSAPP_APP_SECRET) {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProd) {
      console.error('❌ Missing WHATSAPP_APP_SECRET in production - blocking flow request');
      return false;
    }

    console.warn('⚠️  Development mode: Flow signature validation disabled');
    return true;
  }

  // Header format: sha256=abcdef...
  const parts = header.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    console.error('❌ Invalid flow signature header format');
    return false;
  }

  const provided = parts[1];
  if (!provided) {
    console.error('❌ Missing flow signature value');
    return false;
  }

  // Calculate expected signature
  const expected = await hmacSha256Hex(WHATSAPP_APP_SECRET, rawBody);

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length) {
    console.error('❌ Flow signature length mismatch');
    return false;
  }

  // XOR-based constant-time string comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  const isValid = diff === 0;

  if (!isValid) {
    console.error('❌ Flow signature validation failed');
  }

  return isValid;
}

/**
 * Send a WhatsApp Flow message
 * @param to - Phone number in WhatsApp format
 * @param flowId - Flow ID from Meta Business Manager
 * @param flowCta - Call to action text for the button
 * @param bodyText - Main message text
 * @param options - Optional header, footer, and flow configuration
 */
export async function sendFlow(
  to: string,
  flowId: string,
  flowCta: string,
  bodyText: string,
  options?: {
    header?: string;
    footer?: string;
    flowType?: 'navigate' | 'data_exchange';
    initialScreen?: string;
    initialData?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const flowToken = generateFlowToken();
    const flowType = options?.flowType || 'navigate';

    // Store flow session in database
    const supabase = getSupabaseServerClient();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', to)
      .single();

    if (user) {
      await supabase.from('flow_sessions').insert({
        user_id: user.id,
        flow_id: flowId,
        flow_token: flowToken,
        flow_type: flowType,
        status: 'pending' as const,
        session_data: (options?.initialData || {}) as any,
      });
    }

    const payload: FlowMessagePayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: bodyText },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: flowToken,
            flow_id: flowId,
            flow_cta: flowCta,
            flow_action: flowType,
            ...(options?.initialScreen && {
              flow_action_payload: {
                screen: options.initialScreen,
                ...(options.initialData && { data: options.initialData }),
              },
            }),
          },
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header },
        }),
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
    };

    const result = await sendWhatsAppRequest(payload as any);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error('Error sending flow:', error);
    return null;
  }
}

/**
 * Handle data exchange request from WhatsApp Flow
 * @param request - Encrypted data exchange request
 * @returns Data exchange response or null on error
 */
export async function handleFlowDataExchange(
  request: FlowDataExchangeRequest
): Promise<FlowDataExchangeResponse | null> {
  try {
    const { flow_token, action, screen, data } = request;

    // Validate flow token
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from('flow_sessions')
      .select('*')
      .eq('flow_token', flow_token)
      .single();

    if (!session) {
      console.error('Invalid flow token');
      return null;
    }

    // Update session status
    await supabase
      .from('flow_sessions')
      .update({
        status: 'in_progress',
        session_data: { ...(session as any).session_data, ...data },
      })
      .eq('flow_token', flow_token);

    // Handle different actions
    switch (action) {
      case 'ping':
        return {
          version: '3.0',
          screen: 'SUCCESS',
          data: { status: 'pong' },
        };

      case 'INIT':
        return handleFlowInit(session, screen, data);

      case 'data_exchange':
        return handleDataExchange(session, screen, data);

      default:
        return null;
    }
  } catch (error) {
    console.error('Error handling flow data exchange:', error);
    return null;
  }
}

/**
 * Handle flow initialization
 */
async function handleFlowInit(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  // Return initial screen data based on flow type
  switch (session.flow_id) {
    case 'lead_generation_flow':
      return {
        version: '3.0',
        screen: 'LEAD_FORM',
        data: {
          title: 'Contact Information',
          fields: ['name', 'email', 'phone', 'company'],
        },
      };

    case 'appointment_booking_flow':
      return {
        version: '3.0',
        screen: 'DATE_PICKER',
        data: {
          title: 'Select Appointment Date',
          available_dates: getAvailableDates(),
        },
      };

    case 'feedback_flow':
      return {
        version: '3.0',
        screen: 'RATING',
        data: {
          title: 'Rate Your Experience',
          max_rating: 5,
        },
      };

    default:
      return {
        version: '3.0',
        screen: 'DEFAULT',
        data: {},
      };
  }
}

/**
 * Handle data exchange between screens
 */
async function handleDataExchange(
  session: any,
  screen: string,
  data: Record<string, unknown>
): Promise<FlowDataExchangeResponse> {
  const supabase = getSupabaseServerClient();

  // Save screen data
  await supabase
    .from('flow_sessions')
    .update({
      session_data: { ...session.session_data, [screen]: data },
    })
    .eq('flow_token', session.flow_token);

  // Determine next screen based on current screen and data
  switch (screen) {
    case 'LEAD_FORM':
      // Validate lead data and move to confirmation
      if (validateLeadData(data)) {
        return {
          version: '3.0',
          screen: 'CONFIRMATION',
          data: {
            message: 'Thank you! We will contact you soon.',
            summary: data,
          },
        };
      } else {
        return {
          version: '3.0',
          screen: 'LEAD_FORM',
          data: {
            error: 'Please fill all required fields',
            ...data,
          },
        };
      }

    case 'DATE_PICKER':
      // Move to time selection after date is picked
      return {
        version: '3.0',
        screen: 'TIME_PICKER',
        data: {
          title: 'Select Time',
          selected_date: data.selected_date,
          available_times: getAvailableTimesForDate(data.selected_date as string),
        },
      };

    case 'TIME_PICKER':
      // Confirm appointment
      return {
        version: '3.0',
        screen: 'APPOINTMENT_CONFIRMED',
        data: {
          message: `Appointment confirmed for ${data.selected_date} at ${data.selected_time}`,
          appointment_id: generateAppointmentId(),
        },
      };

    case 'RATING':
      // Save feedback and show thank you
      await saveFeedback(session.user_id, data);
      return {
        version: '3.0',
        screen: 'THANK_YOU',
        data: {
          message: 'Thank you for your feedback!',
        },
      };

    default:
      return {
        version: '3.0',
        screen: 'SUCCESS',
        data: { status: 'completed' },
      };
  }
}

/**
 * Complete a flow session
 */
export async function completeFlowSession(flowToken: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase
    .from('flow_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('flow_token', flowToken);
}

// Helper functions
function validateLeadData(data: Record<string, unknown>): boolean {
  return !!(data.name && data.email && data.phone);
}

function getAvailableDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split('T')[0];
    if (dateString) {
      dates.push(dateString);
    }
  }
  return dates;
}

function getAvailableTimesForDate(date: string): string[] {
  // Mock implementation - would connect to calendar API
  return ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
}

function generateAppointmentId(): string {
  return `APT-${Date.now().toString(36).toUpperCase()}`;
}

async function saveFeedback(userId: string, data: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase.from('user_interactions').insert({
    user_id: userId,
    interaction_type: 'flow_completion' as const,
    metadata: { feedback: data } as any,
  });
}

// Pre-defined flow templates
export const FLOW_TEMPLATES = {
  LEAD_GENERATION: {
    id: 'lead_generation_flow',
    name: 'Lead Generation',
    description: 'Collect contact information from potential customers',
    cta: 'Get Started',
    bodyText: 'Please provide your contact information',
  },
  APPOINTMENT_BOOKING: {
    id: 'appointment_booking_flow',
    name: 'Appointment Booking',
    description: 'Schedule appointments with customers',
    cta: 'Book Appointment',
    bodyText: 'Schedule your appointment',
  },
  FEEDBACK_COLLECTION: {
    id: 'feedback_flow',
    name: 'Feedback Collection',
    description: 'Collect customer feedback and ratings',
    cta: 'Give Feedback',
    bodyText: 'We value your feedback',
  },
};