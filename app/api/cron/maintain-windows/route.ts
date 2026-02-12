/**
 * @file Messaging Windows Maintenance Cron Job
 * @description Sends AI-generated contextual messages before 24h WhatsApp window expires, runs hourly during business hours
 * @module app/api/cron/maintain-windows
 * @exports runtime, maxDuration, GET, proactiveAgent, jsonResponse, getActiveConversationMap, generateContextualMessage, mapWithConcurrency
 * @runtime edge
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

export const runtime = 'edge';
export const maxDuration = 10; // Edge Functions max timeout (AI generation + multiple messages)

import { getEnv } from '../../../../src/shared/config/env';
import { logger } from '../../../../src/shared/observability/logger';
import { sendWhatsAppText } from '../../../../src/shared/infra/whatsapp';
import { getSupabaseServerClient } from '../../../../src/shared/infra/db/supabase';
import { createProactiveAgent } from '../../../../src/modules/ai/application/proactive-agent';
import {
  getConversationHistory,
  historyToModelMessages,
  type ConversationMessage,
} from '../../../../src/modules/conversation/application/utils';
import {
  findWindowsNearExpiration,
  shouldSendProactiveMessage,
  incrementProactiveCounter,
  isWithinBusinessHours,
  COLOMBIA_TZ,
  BUSINESS_HOURS,
} from '../../../../src/modules/messaging-window/application/service';

const proactiveAgent = createProactiveAgent();
const PROACTIVE_SCAN_HOURS = 20;

/**
 * Cron job: Maintain WhatsApp messaging windows
 *
 * Schedule: Hourly during business hours (Vercel uses UTC)
 * - 12:00-00:00 UTC = 7:00am-7:00pm Bogotá
 *
 * Purpose: Send proactive messages before 24h window expires to keep conversation free
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>;

async function getActiveConversationMap(
  userIds: string[],
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_id')
    .in('user_id', userIds)
    .eq('status', 'active')

  if (error || !data) {
    logger.error('[maintain-windows] Failed to fetch active conversations', error)
    return new Map()
  }

  const map = new Map<string, string>()
  for (const row of data) {
    if (!map.has(row.user_id)) {
      map.set(row.user_id, row.id)
    }
  }

  return map
}

async function generateContextualMessage(
  userId: string,
  conversationId: string,
  phoneNumber: string,
  hoursRemaining: number,
  supabase: SupabaseClient
): Promise<string> {
  // Load recent conversation history for context
  const history = await getConversationHistory(conversationId, 5, supabase);
  const modelHistory = historyToModelMessages(history);

  const prompt = `Genera un mensaje muy breve y natural para mantener la conversación activa (ventana WhatsApp expira en ${Math.round(hoursRemaining)}h).

Contexto del historial:
${history.slice(-3).map((m: ConversationMessage) => `${m.direction === 'inbound' ? 'Usuario' : 'Bot'}: ${m.content}`).join('\n')}

Reglas:
- Máximo 2 líneas
- Personalizado según el contexto reciente
- Invita a responder con una pregunta concreta y útil
- Sonar cercano y resolutivo (no genérico)
- Usa emojis con moderación
- NO menciones "ventana" o "24 horas"

Ejemplos:
- "¿Cómo va todo con [tema anterior]? Estoy aquí si necesitas algo 😊"
- "¿Alguna novedad con [recordatorio/cita]? Cuéntame si puedo ayudarte"
- "¿Te sirvió la información sobre [tema]? Cualquier duda, escríbeme"`;

  try {
    const aiResponse = await proactiveAgent.respond(prompt, userId, modelHistory);
    return aiResponse.text;
  } catch (err: any) {
    logger.error('[maintain-windows] Failed to generate contextual message', err);

    // Fallback to generic message
    return 'Hola! ¿Cómo va todo? Estoy aquí si necesitas ayuda con algo 😊';
  }
}

type WindowProcessResult = {
  sent: boolean
  skipped: boolean
  error?: string
}

type MessagingWindowSnapshot = {
  phone_number: string
  proactive_messages_sent_today: number
  last_proactive_sent_at: string | null
  window_expires_at: string
  free_entry_point_expires_at: string | null
}

async function getMessagingWindowSnapshotMap(
  phoneNumbers: string[],
  supabase: SupabaseClient
): Promise<Map<string, MessagingWindowSnapshot>> {
  if (phoneNumbers.length === 0) return new Map()

  const { data, error } = await supabase
    .from('messaging_windows')
    .select('phone_number, proactive_messages_sent_today, last_proactive_sent_at, window_expires_at, free_entry_point_expires_at')
    .in('phone_number', phoneNumbers)

  if (error || !data) {
    logger.error('[maintain-windows] Failed to fetch messaging windows', error)
    return new Map()
  }

  const map = new Map<string, MessagingWindowSnapshot>()
  for (const row of data) {
    map.set(row.phone_number, row as MessagingWindowSnapshot)
  }
  return map
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.min(limit, items.length)

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const current = nextIndex++
      if (current >= items.length) return
      results[current] = await handler(items[current]!, current)
    }
  })

  await Promise.all(workers)
  return results
}

export async function GET(req: Request): Promise<Response> {
  const startTime = Date.now();
  const currentHour = new Date().toLocaleString('en-US', {
    timeZone: COLOMBIA_TZ,
    hour: '2-digit',
    hour12: false
  });

  logger.info('[maintain-windows] Cron job started', {
    metadata: {
      timezone: COLOMBIA_TZ,
      currentHour,
      businessHours: `${BUSINESS_HOURS.start}-${BUSINESS_HOURS.end}`,
      timestamp: new Date().toISOString()
    }
  });

  // Verify cron authentication (Vercel uses 'vercel-cron/1.0' user-agent)
  const userAgent = req.headers.get('user-agent');
  const isVercelCron = userAgent?.startsWith('vercel-cron/');

  if (!isVercelCron) {
    logger.warn('[maintain-windows] Invalid user-agent', {
      metadata: {
        userAgent,
        expected: 'vercel-cron/*',
        headers: Object.fromEntries(req.headers.entries())
      },
    });

    // Fallback to CRON_SECRET if configured
    const { CRON_SECRET } = getEnv();
    if (CRON_SECRET) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        logger.warn('[maintain-windows] CRON_SECRET validation failed', {
          metadata: { hasAuth: !!authHeader }
        });
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      logger.info('[maintain-windows] Authenticated via CRON_SECRET');
    } else {
      logger.warn('[maintain-windows] No CRON_SECRET configured and invalid user-agent');
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  } else {
    logger.debug('[maintain-windows] Authenticated via Vercel Cron user-agent', {
      metadata: { userAgent }
    });
  }

  // Check if within business hours (7am-8pm Bogotá)
  const withinHours = await isWithinBusinessHours(COLOMBIA_TZ);
  if (!withinHours) {
    logger.info('[maintain-windows] Skipped: Outside business hours', {
      metadata: {
        businessHours: `${BUSINESS_HOURS.start}-${BUSINESS_HOURS.end}`,
        timezone: COLOMBIA_TZ,
      },
    });

    return jsonResponse({
      skipped: true,
      reason: 'Outside business hours (7am-8pm Bogotá)',
      duration_ms: Date.now() - startTime,
    });
  }

  try {
    // Find active windows within proactive scan horizon
    const windows = await findWindowsNearExpiration(PROACTIVE_SCAN_HOURS);

    logger.info('[maintain-windows] Found windows in proactive horizon', {
      metadata: { count: windows.length },
    });

    const concurrencyLimit = 4

    const supabase = getSupabaseServerClient();

    const userIds = Array.from(new Set(windows.map((w) => w.user_id)))
    const activeConversationMap = await getActiveConversationMap(userIds, supabase)
    const phoneNumbers = Array.from(new Set(windows.map((w) => w.phone_number).filter(Boolean))) as string[]
    const messagingWindowMap = await getMessagingWindowSnapshotMap(phoneNumbers, supabase)

    const results = await mapWithConcurrency(
      windows,
      concurrencyLimit,
      async (window): Promise<WindowProcessResult> => {
        try {
          const phone = window.phone_number
          if (!phone) {
            return { sent: false, skipped: true, error: `No phone for user ${window.user_id}` }
          }

          const conversationId = activeConversationMap.get(window.user_id) ?? null
          if (!conversationId) {
            logger.debug('[maintain-windows] No active conversation', {
              metadata: { userId: window.user_id },
            })
            return { sent: false, skipped: true }
          }

          const decision = await shouldSendProactiveMessage(
            window.user_id,
            window.phone_number,
            conversationId,
            supabase,
            messagingWindowMap.get(window.phone_number) ?? null
          )

          if (!decision.allowed) {
            logger.debug('[maintain-windows] Skipped proactive message', {
              metadata: {
                userId: window.user_id,
                reason: decision.reason,
                nextAvailable: decision.nextAvailableTime?.toISOString(),
              },
            })
            return { sent: false, skipped: true }
          }

          const message = await generateContextualMessage(
            window.user_id,
            conversationId,
            window.phone_number,
            window.hours_remaining,
            supabase
          )

          await sendWhatsAppText(phone, message)
          await incrementProactiveCounter(window.phone_number, supabase)

          logger.info('[maintain-windows] Maintenance message sent', {
            metadata: {
              userId: window.user_id,
              phoneNumber: phone.slice(0, 8) + '***',
              hoursRemaining: window.hours_remaining,
              messagesRemaining: window.proactive_messages_sent_today,
            },
          })

          return { sent: true, skipped: false }
        } catch (err: any) {
          logger.error('[maintain-windows] Error processing window', err, {
            metadata: { userId: window.user_id },
          })
          return {
            sent: false,
            skipped: true,
            error: `User ${window.user_id}: ${err?.message ?? 'unknown error'}`,
          }
        }
      }
    )

    const sent = results.filter((r) => r.sent).length
    const skipped = results.filter((r) => r.skipped).length
    const errors = results
      .map((r) => r.error)
      .filter((e): e is string => !!e)

    const duration = Date.now() - startTime;

    logger.info('[maintain-windows] Cron job completed', {
      metadata: {
        processed: windows.length,
        sent,
        skipped,
        errors: errors.length,
        duration_ms: duration,
      },
    });

    return jsonResponse({
      success: true,
      processed: windows.length,
      sent,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // First 5 errors
      duration_ms: duration,
    });
  } catch (error: any) {
    logger.error('[maintain-windows] Cron job failed', error);

    return jsonResponse(
      {
        success: false,
        error: error?.message ?? 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      500
    );
  }
}
