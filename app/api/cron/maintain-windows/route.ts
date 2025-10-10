export const runtime = 'edge';

import { getEnv } from '../../../../lib/env';
import { logger } from '../../../../lib/logger';
import { sendWhatsAppText } from '../../../../lib/whatsapp';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { createProactiveAgent } from '../../../../lib/openai';
import { getConversationHistory, type ConversationMessage } from '../../../../lib/conversation-utils';
import { historyToOpenAIMessages } from '../../../../lib/ai-processing-v2';
import {
  findWindowsNearExpiration,
  shouldSendProactiveMessage,
  incrementProactiveCounter,
  isWithinBusinessHours,
  COLOMBIA_TZ,
  BUSINESS_HOURS,
} from '../../../../lib/messaging-windows';

/**
 * Cron job: Maintain WhatsApp messaging windows
 *
 * Schedule: Every 3 hours during business hours (Vercel uses UTC)
 * - 12pm UTC = 7am Bogotá (morning start)
 * - 3pm UTC = 10am Bogotá (mid-morning)
 * - 6pm UTC = 1pm Bogotá (post-lunch)
 * - 9pm UTC = 4pm Bogotá (afternoon)
 *
 * Purpose: Send proactive messages before 24h window expires to keep conversation free
 */

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getUserPhone(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', userId)
    .single();

  if (error || !data) {
    logger.error('[maintain-windows] Failed to get user phone', error);
    return null;
  }

  return data.phone_number;
}

async function getActiveConversation(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.id;
}

async function generateContextualMessage(
  userId: string,
  conversationId: string,
  phoneNumber: string,
  hoursRemaining: number
): Promise<string> {
  // Load recent conversation history for context
  const history = await getConversationHistory(conversationId, 5);
  const openaiHistory = historyToOpenAIMessages(history);

  // Use ProactiveAgent to generate natural, contextual message
  const agent = createProactiveAgent();

  const prompt = `Genera un mensaje muy breve y natural para mantener la conversación activa (ventana WhatsApp expira en ${Math.round(hoursRemaining)}h).

Contexto del historial:
${history.slice(-3).map((m: ConversationMessage) => `${m.direction === 'inbound' ? 'Usuario' : 'Bot'}: ${m.content}`).join('\n')}

Reglas:
- Máximo 2 líneas
- Personalizado según el contexto reciente
- Invita a responder de forma natural
- Usa emojis con moderación
- NO menciones "ventana" o "24 horas"

Ejemplos:
- "¿Cómo va todo con [tema anterior]? Estoy aquí si necesitas algo 😊"
- "¿Alguna novedad con [recordatorio/cita]? Cuéntame si puedo ayudarte"
- "¿Te sirvió la información sobre [tema]? Cualquier duda, escríbeme"`;

  try {
    const response = await agent.respond(prompt, userId, openaiHistory);
    return response;
  } catch (err: any) {
    logger.error('[maintain-windows] Failed to generate contextual message', err);

    // Fallback to generic message
    return 'Hola! ¿Cómo va todo? Estoy aquí si necesitas ayuda con algo 😊';
  }
}

export async function GET(req: Request): Promise<Response> {
  const startTime = Date.now();

  logger.info('[maintain-windows] Cron job started');

  // Verify cron authentication
  const userAgent = req.headers.get('user-agent');
  if (!userAgent?.includes('vercel-cron')) {
    logger.warn('[maintain-windows] Unauthorized request (not from Vercel Cron)', {
      metadata: { userAgent },
    });

    // Also check CRON_SECRET as fallback
    const { CRON_SECRET } = getEnv();
    if (CRON_SECRET) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    } else {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
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
    // Find windows expiring in next 4 hours
    const windows = await findWindowsNearExpiration(4);

    logger.info('[maintain-windows] Found windows near expiration', {
      metadata: { count: windows.length },
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const window of windows) {
      try {
        const phone = await getUserPhone(window.user_id);
        if (!phone) {
          skipped++;
          errors.push(`No phone for user ${window.user_id}`);
          continue;
        }

        const conversationId = await getActiveConversation(window.user_id);
        if (!conversationId) {
          skipped++;
          logger.debug('[maintain-windows] No active conversation', {
            metadata: { userId: window.user_id },
          });
          continue;
        }

        // Check if we should send proactive message
        const decision = await shouldSendProactiveMessage(
          window.user_id,
          window.phone_number,
          conversationId
        );

        if (!decision.allowed) {
          skipped++;
          logger.debug('[maintain-windows] Skipped proactive message', {
            metadata: {
              userId: window.user_id,
              reason: decision.reason,
              nextAvailable: decision.nextAvailableTime?.toISOString(),
            },
          });
          continue;
        }

        // Generate contextual message
        const message = await generateContextualMessage(
          window.user_id,
          conversationId,
          window.phone_number,
          window.hours_remaining
        );

        // Send message
        await sendWhatsAppText(phone, message);

        // Increment proactive counter
        await incrementProactiveCounter(window.phone_number);

        sent++;

        logger.info('[maintain-windows] Maintenance message sent', {
          metadata: {
            userId: window.user_id,
            phoneNumber: phone.slice(0, 8) + '***',
            hoursRemaining: window.hours_remaining,
            messagesRemaining: window.proactive_messages_sent_today,
          },
        });
      } catch (err: any) {
        logger.error('[maintain-windows] Error processing window', err, {
          metadata: { userId: window.user_id },
        });
        errors.push(`User ${window.user_id}: ${err.message}`);
        skipped++;
      }
    }

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
