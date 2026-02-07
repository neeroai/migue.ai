/**
 * @file whatsapp-errors.ts
 * @description WhatsApp API error hints system with actionable error messages and Meta console links for troubleshooting
 * @module lib/whatsapp-errors
 * @exports WhatsAppErrorDetails, getWhatsAppErrorHint, WhatsAppAPIError
 * @runtime edge
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

export interface WhatsAppErrorDetails {
  status: number;
  errorCode?: number | undefined;
  errorSubcode?: number | undefined;
  message?: string | undefined;
}

/**
 * Get user-friendly error hint with actionable guidance
 *
 * Converts WhatsApp API error codes into developer-friendly messages with:
 * - Root cause explanation
 * - Step-by-step troubleshooting instructions
 * - Direct links to Meta console for fixing the issue
 *
 * Handles Meta Graph API error codes (190, 100, 131026, 131031) and HTTP status codes.
 * Falls back to generic hint with console links for unknown errors.
 *
 * @param details - Error details from WhatsApp API response
 * @param details.status - HTTP status code (400, 401, 403, 404, 429, 500, 503)
 * @param details.errorCode - Meta Graph API error code (optional, e.g., 190 for token issues)
 * @param details.errorSubcode - Meta Graph API error subcode (optional, e.g., 33 for invalid phone ID)
 * @param details.message - Error message from API (optional)
 * @returns Multi-line formatted error message with troubleshooting steps and console links
 *
 * @example
 * // Handle WhatsApp API error
 * const response = await fetch(whatsappUrl);
 * if (!response.ok) {
 *   const errorBody = await response.json();
 *   const hint = getWhatsAppErrorHint({
 *     status: response.status,
 *     errorCode: errorBody.error?.code,
 *     errorSubcode: errorBody.error?.error_subcode
 *   });
 *   logger.error('WhatsApp API error', new Error(hint));
 * }
 */
export function getWhatsAppErrorHint(details: WhatsAppErrorDetails): string {
  const { status, errorCode, errorSubcode } = details;

  // Specific Meta Graph API error codes
  if (errorCode === 190) {
    return (
      '🔑 Access token expired or invalid.\n' +
      '→ Generate new permanent token: https://developers.facebook.com/apps\n' +
      '→ Ensure token has whatsapp_business_messaging permission\n' +
      '→ Token expiry: System user tokens never expire, app tokens expire in 60 days'
    );
  }

  if (errorCode === 100) {
    if (errorSubcode === 33) {
      return (
        '📱 Invalid Phone Number ID.\n' +
        '→ Verify Phone Number ID in Meta Business Manager: https://business.facebook.com\n' +
        '→ Ensure Phone Number ID belongs to your WhatsApp Business Account\n' +
        '→ Format: 15-digit number (e.g., 106540352305631)'
      );
    }
    return (
      '❌ Invalid parameter in request.\n' +
      '→ Check message payload structure\n' +
      '→ Verify button/list limits (3 buttons max, 10 list rows max)\n' +
      '→ See docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages'
    );
  }

  if (errorCode === 131026) {
    return (
      '📵 Recipient cannot be messaged.\n' +
      '→ User may have blocked your business number\n' +
      '→ User may not have opted in to receive messages\n' +
      '→ Check 24-hour conversation window rules'
    );
  }

  if (errorCode === 131031) {
    return (
      '⏰ Message outside 24-hour conversation window.\n' +
      '→ Use approved message template for out-of-window messaging\n' +
      '→ Or wait for user to initiate conversation\n' +
      '→ Templates: https://business.facebook.com/latest/whatsapp_manager/message_templates'
    );
  }

  // HTTP status codes
  const statusHints: Record<number, string> = {
    400: (
      '📋 Bad Request - Invalid payload format.\n' +
      '→ Validate message structure against WhatsApp API v23.0\n' +
      '→ Check button/list character limits\n' +
      '→ Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages'
    ),

    401: (
      '🔑 Unauthorized - Access token invalid or expired.\n' +
      '→ Generate new token: https://developers.facebook.com/apps\n' +
      '→ Verify WHATSAPP_TOKEN in environment variables'
    ),

    403: (
      '🚫 Forbidden - Insufficient permissions or rate limited.\n' +
      '→ Check app permissions in Meta Developer Console\n' +
      '→ Verify rate limits:\n' +
      '   • 250 messages/sec (Cloud API)\n' +
      '   • 1000 messages/day (Sandbox mode)\n' +
      '   • 10,000 messages/day (Tier 1 production)\n' +
      '→ Console: https://developers.facebook.com/apps'
    ),

    404: (
      '🔍 Not Found - Phone Number ID or recipient not found.\n' +
      '→ Verify WHATSAPP_PHONE_ID in environment variables\n' +
      '→ Check Phone Number ID in Business Manager\n' +
      '→ Ensure recipient number is valid E.164 format'
    ),

    429: (
      '⏱️  Rate Limit Exceeded (250 msg/sec).\n' +
      '→ Implement exponential backoff: 1s, 2s, 4s, 8s\n' +
      '→ Consider message queue with Upstash/Redis\n' +
      '→ Check current rate limit tier in Meta console'
    ),

    500: (
      '☁️  WhatsApp API Internal Server Error.\n' +
      '→ Retry with exponential backoff (already implemented)\n' +
      '→ If persists, check Meta API Status: https://status.fb.com\n' +
      '→ Report to Meta: https://developers.facebook.com/support'
    ),

    503: (
      '☁️  WhatsApp API Service Unavailable (temporary outage).\n' +
      '→ Retry in 60 seconds (automatic retry enabled)\n' +
      '→ Check Meta API Status: https://status.fb.com\n' +
      '→ Consider dead letter queue for failed messages'
    ),
  };

  const hint = statusHints[status];
  if (hint) return hint;

  // Generic error
  return (
    `❌ WhatsApp API Error ${status}${errorCode ? ` (error code ${errorCode})` : ''}\n` +
    `→ Check Meta Developer Console: https://developers.facebook.com/apps\n` +
    `→ View webhook logs: https://business.facebook.com/latest/inbox/settings/whatsapp\n` +
    `→ Check phone number status and tier limits`
  );
}

/**
 * Custom error class for WhatsApp API errors
 *
 * Combines structured error details (status, errorCode, errorSubcode) with
 * user-friendly hints for troubleshooting. Use this instead of generic Error
 * when calling WhatsApp API to provide better error messages.
 *
 * Error message format: "[hint]\n\nError details: [JSON]"
 *
 * @param details - Error details from WhatsApp API response (status, errorCode, errorSubcode, message)
 * @param hint - User-friendly troubleshooting hint (from getWhatsAppErrorHint)
 *
 * @example
 * // Throw WhatsAppAPIError on API failure
 * const response = await fetch(whatsappUrl);
 * if (!response.ok) {
 *   const errorBody = await response.json();
 *   const details = {
 *     status: response.status,
 *     errorCode: errorBody.error?.code,
 *     message: errorBody.error?.message
 *   };
 *   const hint = getWhatsAppErrorHint(details);
 *   throw new WhatsAppAPIError(details, hint);
 * }
 *
 * @example
 * // Catch and log WhatsAppAPIError
 * try {
 *   await sendWhatsAppMessage(phone, text);
 * } catch (error) {
 *   if (error instanceof WhatsAppAPIError) {
 *     logger.error('WhatsApp API error', error, {
 *       metadata: { status: error.details.status, code: error.details.errorCode }
 *     });
 *   }
 *   throw error;
 * }
 */
export class WhatsAppAPIError extends Error {
  constructor(
    public details: WhatsAppErrorDetails,
    public hint: string
  ) {
    super(`${hint}\n\nError details: ${JSON.stringify(details, null, 2)}`);
    this.name = 'WhatsAppAPIError';
  }
}
