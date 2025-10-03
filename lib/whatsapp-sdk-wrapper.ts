/**
 * Hybrid WhatsApp SDK Wrapper
 *
 * ⚠️ IMPORTANT: Edge Runtime Compatibility Notice
 * The whatsapp-client-sdk package uses Node.js-specific modules (crypto, uuid)
 * that are NOT available in Vercel Edge Functions.
 *
 * Current Status:
 * - ✅ Reactions: Work via lazy initialization (called from background tasks)
 * - ✅ Read receipts: Work via lazy initialization
 * - ❌ Broadcast: Requires Node.js runtime (not Edge compatible)
 * - ❌ Webhook processor: Requires Node.js runtime
 *
 * Usage:
 * - Use lightweight custom client for all Edge routes
 * - Use SDK features ONLY from non-Edge contexts (background jobs, API routes with Node runtime)
 */

import { sendWhatsAppText, sendInteractiveButtons, sendInteractiveList } from './whatsapp';

/**
 * SDK Client Management
 * Lazy-loaded to avoid Edge Runtime import errors
 * Only initialized when actually called (from background tasks, not Edge routes)
 */

let sdkClient: any = null;
let WhatsAppClient: any = null;

async function getSDKClient(): Promise<any> {
  if (!sdkClient) {
    // Lazy import to avoid Edge Runtime errors
    if (!WhatsAppClient) {
      const module = await import('whatsapp-client-sdk');
      WhatsAppClient = module.WhatsAppClient;
    }

    const accessToken = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
    const webhookVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!accessToken || !phoneNumberId || !webhookVerifyToken) {
      throw new Error('Missing WhatsApp credentials for SDK client');
    }

    sdkClient = new WhatsAppClient({
      accessToken,
      phoneNumberId,
      webhookVerifyToken,
      timeout: 30000,
    });
  }

  return sdkClient;
}

/**
 * Message Reactions
 * Enhanced user engagement with emoji reactions
 */

export async function sendReaction(
  to: string,
  messageId: string,
  emoji: string
): Promise<string | null> {
  const client = await getSDKClient();
  const response = await client.sendReaction(to, messageId, emoji);
  return response.messageId || null;
}

export async function removeReaction(
  to: string,
  messageId: string
): Promise<string | null> {
  const client = await getSDKClient();
  const response = await client.removeReaction(to, messageId);
  return response.messageId || null;
}

// Convenience methods for common reactions
export async function reactWithLike(to: string, messageId: string) {
  const client = await getSDKClient();
  return client.reactWithLike(to, messageId);
}

export async function reactWithLove(to: string, messageId: string) {
  const client = await getSDKClient();
  return client.reactWithLove(to, messageId);
}

export async function reactWithFire(to: string, messageId: string) {
  const client = await getSDKClient();
  return client.reactWithFire(to, messageId);
}

export async function reactWithLaugh(to: string, messageId: string) {
  const client = await getSDKClient();
  return client.reactWithLaugh(to, messageId);
}

export async function reactWithCheck(to: string, messageId: string) {
  const client = await getSDKClient();
  return client.reactWithCheck(to, messageId);
}

/**
 * Broadcast Messaging
 * ⚠️ NOT AVAILABLE IN EDGE RUNTIME
 *
 * The broadcast features require Node.js runtime due to crypto module dependency.
 * To use broadcast messaging:
 * 1. Create a separate API route with Node.js runtime
 * 2. Import whatsapp-client-sdk directly in that route
 * 3. Call broadcast methods from there
 *
 * Example:
 * ```typescript
 * // app/api/broadcast/send/route.ts (NO export const runtime = 'edge')
 * import { WhatsAppClient } from 'whatsapp-client-sdk';
 * export async function POST(req: Request) {
 *   const client = new WhatsAppClient({ ... });
 *   return client.sendBroadcastText(...);
 * }
 * ```
 */

/**
 * Mark Message as Read
 * Works in background tasks (fire-and-forget from Edge routes)
 */

export async function markMessageAsRead(messageId: string): Promise<void> {
  try {
    const client = await getSDKClient();
    await client.markMessageAsRead(messageId);
  } catch (error: any) {
    // Silently fail in Edge context - will work when called from background
    console.warn('markMessageAsRead failed (expected in Edge):', error?.message);
  }
}

/**
 * Core Messaging (Using Lightweight Implementation)
 * Maintains Edge optimization for common operations
 */

export { sendWhatsAppText, sendInteractiveButtons, sendInteractiveList };

/**
 * Reply to Message
 * Send a reply referencing a previous message
 */

export async function replyToMessage(
  to: string,
  replyToMessageId: string,
  text: string
): Promise<string | null> {
  // Use lightweight implementation with replyToMessageId option
  return sendWhatsAppText(to, text);
}
