export const config = { runtime: 'edge' };

import { upsertUserByPhone, getOrCreateConversation, insertInboundMessage, insertOutboundMessage } from '../../lib/persist';
import { getConversationHistory, historyToChatMessages } from '../../lib/context';
import { classifyIntent } from '../../lib/intent';
import { generateResponse } from '../../lib/response';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isVerifyRequest(req: Request): boolean {
  const url = new URL(req.url);
  return req.method === 'GET' && url.searchParams.has('hub.mode');
}

function verifyToken(req: Request): Response {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && token && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return new Response('Unauthorized', { status: 401 });
}

async function parseWhatsAppPayloadFromText(bodyText: string): Promise<any> {
  try { return JSON.parse(bodyText) } catch { return null }
}

function extractNormalizedMessage(body: any) {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];
    if (!message) return null;

    const type = message.type as string | undefined;
    const from = message.from as string | undefined;
    const timestamp = message.timestamp ? Number(message.timestamp) * 1000 : Date.now();
    let content: string | null = null;
    let mediaUrl: string | null = null;

    if (type === 'text') {
      content = message.text?.body ?? null;
    } else if (type === 'image') {
      mediaUrl = message.image?.id ?? null;
    } else if (type === 'audio') {
      mediaUrl = message.audio?.id ?? null;
    } else if (type === 'document') {
      mediaUrl = message.document?.id ?? null;
    }

    return {
      from,
      type,
      content,
      mediaUrl,
      waMessageId: message.id as string | undefined,
      conversationId: value?.metadata?.display_phone_number ?? undefined,
      timestamp,
      raw: message,
    };
  } catch {
    return null;
  }
}

function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0')
  return out
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return hex(sig)
}

async function validateSignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256') || req.headers.get('X-Hub-Signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!header || !appSecret) return true // allow when not configured
  // header format: sha256=abcdef...
  const parts = header.split('=')
  if (parts.length !== 2 || parts[0] !== 'sha256') return false
  const provided = parts[1]
  if (!provided) return false
  const expected = await hmacSha256Hex(appSecret, rawBody)
  // constant-time like compare
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  }
  return diff === 0
}

async function persistNormalizedMessage(normalized: ReturnType<typeof extractNormalizedMessage>) {
  if (!normalized?.from) return;
  const userId = await upsertUserByPhone(normalized.from)
  const conversationId = await getOrCreateConversation(userId, normalized.conversationId)
  await insertInboundMessage(conversationId, normalized as any)
  return { userId, conversationId }
}

async function sendWhatsAppMessage(to: string, text: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) return null

  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) return null
  const data = await res.json() as any
  return data?.messages?.[0]?.id ?? null
}

async function processMessageWithAI(
  conversationId: string,
  userPhone: string,
  userMessage: string
) {
  try {
    // Get conversation history
    const history = await getConversationHistory(conversationId, 10)
    const chatHistory = historyToChatMessages(history)

    // Classify intent
    const intentResult = await classifyIntent(userMessage, chatHistory)

    // Generate response
    const response = await generateResponse({
      intent: intentResult.intent,
      conversationHistory: chatHistory,
      userMessage,
    })

    // Send to WhatsApp
    const waMessageId = await sendWhatsAppMessage(userPhone, response)

    // Persist outbound message
    if (waMessageId) {
      await insertOutboundMessage(conversationId, response, waMessageId)
    } else {
      await insertOutboundMessage(conversationId, response)
    }
  } catch (error: any) {
    // Log error but don't fail webhook (fail silently)
    console.error('AI processing error:', error?.message)
  }
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = getRequestId();

  try {
    if (isVerifyRequest(req)) {
      return verifyToken(req);
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed', request_id: requestId }, 405);
    }

    const rawBody = await req.text()
    const signatureOk = await validateSignature(req, rawBody);
    if (!signatureOk) {
      return jsonResponse({ error: 'Invalid signature', request_id: requestId }, 401);
    }

    const body = await parseWhatsAppPayloadFromText(rawBody);
    if (!body) {
      return jsonResponse({ error: 'Invalid JSON body', request_id: requestId }, 400);
    }

    const normalized = extractNormalizedMessage(body);
    if (!normalized) {
      return jsonResponse({ status: 'ignored', reason: 'no message', request_id: requestId }, 200);
    }

    let conversationId: string
    try {
      const result = await persistNormalizedMessage(normalized)
      if (!result) {
        return jsonResponse({ status: 'ignored', reason: 'persist failed', request_id: requestId }, 200)
      }
      conversationId = result.conversationId
    } catch (persistErr: any) {
      return jsonResponse({ error: 'DB error', detail: persistErr?.message, request_id: requestId }, 500)
    }

    // Process text messages with AI (async, don't block webhook response)
    if (normalized.type === 'text' && normalized.content && normalized.from) {
      // Fire and forget - process in background
      processMessageWithAI(conversationId, normalized.from, normalized.content).catch((err) => {
        console.error('Background AI processing failed:', err)
      })
    }

    return jsonResponse({ success: true, request_id: requestId });
  } catch (error: any) {
    return jsonResponse({ error: error?.message ?? 'Unhandled error', request_id: requestId }, 500);
  }
}
