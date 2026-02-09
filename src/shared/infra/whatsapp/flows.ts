/**
 * @file whatsapp-flows.ts
 * @description WhatsApp Cloud API v23.0 Flows implementation with Edge Runtime support, secure token generation, signature validation, and data exchange handling
 * @module lib/whatsapp-flows
 * @exports generateFlowToken, validateFlowSignature, sendFlow, handleFlowDataExchange, completeFlowSession, FLOW_TEMPLATES
 * @runtime edge
 * @see https://developers.facebook.com/docs/whatsapp/flows
 * @date 2026-02-07 19:15
 * @updated 2026-02-07 19:15
 */

import { sendWhatsAppRequest } from './http';
import { sendWhatsAppText } from './messaging';
import { getSupabaseServerClient } from '../db/supabase';
import { logger } from '../../observability/logger';
import type {
  FlowMessagePayload,
  FlowDataExchangeRequest,
  FlowDataExchangeResponse,
  FlowSessionStatus,
} from '@/types/whatsapp';

/**
 * Generate cryptographically secure 64-character hex token for WhatsApp Flow session tracking
 * Uses Web Crypto API for Edge Runtime compatibility (no Node.js crypto module)
 * @returns 64-character hexadecimal string (256-bit entropy)
 * @example
 * const token = generateFlowToken();
 * // token: "a3f5b8c9d2e1f4a7b6c5d8e9f2a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9f2a5"
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
 * Escape Unicode characters for signature validation
 * WhatsApp escapes non-ASCII characters in signature calculation
 */
function escapeUnicode(str: string): string {
  return str.replace(/[^\x00-\x7F]/g, (char) => {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4);
  });
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
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(escapeUnicode(message)) // ✅ Escape Unicode before signing
  );
  return hex(sig);
}

/**
 * Validate WhatsApp Flow data exchange signature using HMAC-SHA256 constant-time comparison
 * Prevents timing attacks and ensures request authenticity from Meta servers
 *
 * Security behavior:
 * - Production: Fails closed if WHATSAPP_APP_SECRET missing (returns false)
 * - Development: Passes if secret missing (returns true) for local testing
 * - Uses XOR-based constant-time comparison to prevent timing attacks
 * - Escapes Unicode characters before signature calculation (WhatsApp requirement)
 *
 * @param req - HTTP request with x-hub-signature-256 header (case-insensitive)
 * @param rawBody - Unparsed request body string (must be raw, not JSON.parse'd)
 * @returns true if signature valid or dev mode with missing secret, false otherwise
 * @example
 * const isValid = await validateFlowSignature(request, await request.text());
 * if (!isValid) return new Response('Forbidden', { status: 403 });
 */
export async function validateFlowSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256');
  const WHATSAPP_APP_SECRET = process.env.WHATSAPP_APP_SECRET;

  // Security: Fail closed in production if credentials missing
  if (!header || !WHATSAPP_APP_SECRET) {
    const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

    if (isProd) {
      logger.error('[Flow Validation] Missing WHATSAPP_APP_SECRET in production', new Error('Missing credentials'), {
        metadata: { isProd, hasHeader: !!header, hasSecret: !!WHATSAPP_APP_SECRET }
      });
      return false;
    }

    logger.warn('[Flow Validation] Development mode: signature validation disabled', {
      metadata: { isProd, hasHeader: !!header, hasSecret: !!WHATSAPP_APP_SECRET }
    });
    return true;
  }

  // Header format: sha256=abcdef...
  const parts = header.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    logger.error('[Flow Validation] Invalid signature header format', new Error('Invalid header format'), {
      metadata: { header, partsLength: parts.length, algorithm: parts[0] }
    });
    return false;
  }

  const provided = parts[1];
  if (!provided) {
    logger.error('[Flow Validation] Missing signature value', new Error('Empty signature'), {
      metadata: { header }
    });
    return false;
  }

  // Calculate expected signature
  const expected = await hmacSha256Hex(WHATSAPP_APP_SECRET, rawBody);

  // Constant-time comparison to prevent timing attacks
  if (provided.length !== expected.length) {
    logger.error('[Flow Validation] Signature length mismatch', new Error('Length mismatch'), {
      metadata: { providedLength: provided.length, expectedLength: expected.length }
    });
    return false;
  }

  // XOR-based constant-time string comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }

  const isValid = diff === 0;

  if (!isValid) {
    logger.error('[Flow Validation] Signature validation failed', new Error('Invalid signature'), {
      metadata: { providedLength: provided.length, expectedLength: expected.length }
    });
  }

  return isValid;
}

/**
 * Send interactive WhatsApp Flow message and create tracked session in database
 * Automatically generates secure token, stores session with expiration, and handles user lookup
 *
 * Flow behavior:
 * - Creates flow_sessions record if user exists in database
 * - Default token expiration: 60 minutes (customizable via options.expiresInMinutes)
 * - Supports both navigate (multi-screen) and data_exchange (form) flow types
 * - Returns null on error (logs error internally, does not throw)
 *
 * @param to - Recipient phone number in E.164 format (e.g., +573001234567)
 * @param flowId - Flow ID from Meta Business Manager (must be published flow)
 * @param flowCta - Button label shown to user (e.g., "Book Appointment")
 * @param bodyText - Message text above the flow button
 * @param options - Optional configuration for header, footer, flow type, initial screen/data, and token expiration
 * @returns WhatsApp message ID if sent successfully, null if error occurs
 * @example
 * const msgId = await sendFlow(
 *   '+573001234567',
 *   'lead_generation_flow',
 *   'Get Started',
 *   'Please provide your contact information',
 *   { flowType: 'data_exchange', expiresInMinutes: 30 }
 * );
 */
export async function sendFlow(
  to: string,
  flowId: string,
  flowCta: string,
  bodyText: string,
  options?: {
    header?: string;
    footer?: string;
    userId?: string;
    flowType?: 'navigate' | 'data_exchange';
    initialScreen?: string;
    initialData?: Record<string, unknown>;
    expiresInMinutes?: number; // Custom token expiration (default: 60 minutes)
  }
): Promise<string | null> {
  try {
    const flowToken = generateFlowToken();
    const flowType = options?.flowType || 'navigate';

    // Store flow session in database
    const supabase = getSupabaseServerClient();
    let resolvedUserId = options?.userId ?? null;
    if (!resolvedUserId) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('phone_number', to)
        .maybeSingle();
      resolvedUserId = user?.id ?? null;
    }

    if (resolvedUserId) {
      // Default expiration: 1 hour (can be customized via options)
      const expiresAt = options?.expiresInMinutes
        ? new Date(Date.now() + options.expiresInMinutes * 60000).toISOString()
        : new Date(Date.now() + 3600000).toISOString(); // 1 hour default

      await supabase.from('flow_sessions').insert({
        user_id: resolvedUserId,
        flow_id: flowId,
        flow_token: flowToken,
        flow_type: flowType,
        status: 'pending' as const,
        session_data: (options?.initialData || {}) as any,
        expires_at: expiresAt,
      });
    } else {
      logger.warn('[WhatsApp Flow] Sending flow without persisted session (user not found)', {
        metadata: { to: to.slice(0, 8) + '***', flowId },
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
            ...(flowType === 'navigate' && options?.initialScreen && {
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
    logger.error('[WhatsApp Flow] Error sending flow', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, flowId, flowCta }
    });
    return null;
  }
}

/**
 * Process WhatsApp Flow data exchange request and route to appropriate handler
 * Validates token expiration, updates session status, and handles ping/INIT/data_exchange actions
 *
 * Action routing:
 * - ping: Health check response (returns pong)
 * - INIT: Initialize flow with first screen data
 * - data_exchange: Process screen submission and return next screen
 *
 * Security:
 * - Validates flow_token exists and is not expired
 * - Updates session status to in_progress on first valid request
 * - Merges incoming data into session_data for state persistence
 *
 * @param request - Flow data exchange request with flow_token, action, screen, and data fields
 * @returns Flow response with next screen and data, or null if token invalid/expired
 * @example
 * const response = await handleFlowDataExchange({
 *   flow_token: 'abc123...',
 *   action: 'data_exchange',
 *   screen: 'LEAD_FORM',
 *   data: { name: 'John', email: 'john@example.com' }
 * });
 * // response: { version: '3.0', screen: 'CONFIRMATION', data: {...} }
 */
export async function handleFlowDataExchange(
  request: FlowDataExchangeRequest
): Promise<FlowDataExchangeResponse | null> {
  try {
    const { flow_token, action, screen, data } = request;

    // Meta can probe endpoint availability with ping before any flow session exists.
    // This must not depend on flow_sessions lookup.
    if (action === 'ping') {
      return {
        version: '3.0',
        screen: 'SUCCESS',
        data: { status: 'pong' },
      };
    }

    // Validate flow token and expiration
    const supabase = getSupabaseServerClient();
    const { data: session } = await supabase
      .from('flow_sessions')
      .select('*')
      .eq('flow_token', flow_token)
      .gt('expires_at', new Date().toISOString()) // Token must not be expired
      .single();

    if (!session) {
      logger.error('[WhatsApp Flow] Invalid or expired flow token', new Error('Token validation failed'), {
        metadata: { flow_token, hasSession: !!session }
      });
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
      case 'INIT':
        return handleFlowInit(session, screen, data);

      case 'data_exchange':
        return handleDataExchange(session, screen, data);

      default:
        return null;
    }
  } catch (error) {
    logger.error('[WhatsApp Flow] Error handling flow data exchange', error instanceof Error ? error : new Error(String(error)), {
      metadata: { flow_token: request.flow_token, action: request.action }
    });
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
    case 'user_signup_flow':
      return {
        version: '3.0',
        screen: 'BASIC_INFO',
        data: {
          title: 'Completa tu registro',
          required_fields: ['name', 'email'],
        },
      };

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
  if (session.flow_id === 'user_signup_flow') {
    if (screen === 'BASIC_INFO') {
      const rawName = typeof data.name === 'string' ? data.name.trim() : '';
      const rawEmail = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

      const errors: Record<string, string> = {};
      if (!isValidDisplayName(rawName)) {
        errors.name = 'Ingresa un nombre válido (2-60 caracteres).';
      }
      if (!isValidEmail(rawEmail)) {
        errors.email = 'Ingresa un email válido.';
      }

      if (Object.keys(errors).length > 0) {
        return {
          version: '3.0',
          screen: 'BASIC_INFO',
          data: {
            ...data,
            errors,
          },
        };
      }

      const { error } = await supabase
        .from('users')
        .update({
          name: rawName,
          email: rawEmail,
          onboarding_version: 'v1',
          onboarding_completed_at: new Date().toISOString(),
        } as any)
        .eq('id', session.user_id);

      if (error) {
        logger.error('[WhatsApp Flow] Failed to persist signup data', error, {
          metadata: {
            userId: session.user_id,
            flowToken: session.flow_token,
          },
        });
        return {
          version: '3.0',
          screen: 'BASIC_INFO',
          data: {
            ...data,
            errors: {
              general: 'No pude guardar tus datos. Intenta de nuevo.',
            },
          },
        };
      }

      return {
        version: '3.0',
        screen: 'SUCCESS',
        data: {
          message: 'Registro completado. Ya puedes continuar.',
        },
      };
    }

    return {
      version: '3.0',
      screen: 'BASIC_INFO',
      data: {
        error: 'Pantalla no soportada para registro.',
      },
    };
  }

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
 * Mark flow session as completed and record completion timestamp
 * Call this after flow reaches final screen or user exits flow
 *
 * @param flowToken - Flow session token (generated by generateFlowToken)
 * @example
 * await completeFlowSession(session.flow_token);
 * // Session status updated to 'completed' with completed_at timestamp
 */
export async function completeFlowSession(flowToken: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from('flow_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('flow_token', flowToken);
  if (error) {
    throw error;
  }
}

/**
 * Mark session as completed only once and return session metadata when transition happens.
 * This is used to run one-time post-completion side-effects (e.g. welcome message).
 */
export async function completeFlowSessionOnce(flowToken: string): Promise<{
  completed: boolean;
  flowId?: string;
  userId?: string;
}> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('flow_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('flow_token', flowToken)
    .in('status', ['pending', 'in_progress'])
    .select('flow_id,user_id')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return { completed: false };
  }

  return {
    completed: true,
    flowId: (data as any).flow_id,
    userId: (data as any).user_id,
  };
}

/**
 * Sends a one-shot welcome message after signup completion.
 */
export async function sendPostSignupWelcome(userId: string): Promise<boolean> {
  const supabase = getSupabaseServerClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('phone_number,name')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error('[WhatsApp Flow] Failed to load user for welcome message', error, {
      metadata: { userId },
    });
    return false;
  }

  const phone = user?.phone_number;
  if (!phone) {
    logger.warn('[WhatsApp Flow] Missing phone_number for welcome message', {
      metadata: { userId },
    });
    return false;
  }

  const firstName =
    typeof user?.name === 'string' && user.name.trim().length > 0
      ? user.name.trim().split(/\s+/)[0]
      : null;
  const greetingName = firstName ? `, ${firstName}` : '';
  const body = `Listo${greetingName}. Tu registro quedó completo. Ya puedo ayudarte con recordatorios, gastos, agenda y más. ¿Qué quieres hacer primero?`;

  try {
    await sendWhatsAppText(phone, body);
    return true;
  } catch (sendError: any) {
    logger.error('[WhatsApp Flow] Failed sending welcome message', sendError, {
      metadata: { userId, phone: phone.slice(0, 8) + '***' },
    });
    return false;
  }
}

// Helper functions
function isValidDisplayName(value: string): boolean {
  if (!value || value.length < 2 || value.length > 60) return false;
  return !/[\u0000-\u001F\u007F]/.test(value);
}

function isValidEmail(value: string): boolean {
  if (!value || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

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
  USER_SIGNUP: {
    id: 'user_signup_flow',
    name: 'User Signup',
    description: 'Capture basic onboarding fields for new WhatsApp users',
    cta: 'Completar registro',
    bodyText: 'Completa tu registro con nombre y email para personalizar tu asistente.',
  },
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
