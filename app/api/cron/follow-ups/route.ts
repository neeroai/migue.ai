export const runtime = 'edge';

import { getEnv } from '../../../../lib/env';
import { logger } from '../../../../lib/logger';
import { fetchDueFollowUps, markFollowUpStatus } from '../../../../lib/followups';
import { sendWhatsAppText } from '../../../../lib/whatsapp';
import { getSupabaseServerClient } from '../../../../lib/supabase';
import { createProactiveAgent } from '../../../../lib/claude-agents';
import { getConversationHistory } from '../../../../lib/context';
import { historyToClaudeMessages } from '../../../../lib/ai-processing-v2';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getUserPhone(userId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data?.phone_number as string | null;
}

async function buildIntelligentFollowUp(
  category: string,
  payload: Record<string, unknown> | null,
  conversationId: string,
  userId: string
): Promise<string> {
  // Load conversation history for context
  const history = await getConversationHistory(conversationId, 5);
  const claudeHistory = historyToClaudeMessages(history);

  // Check if user has been active recently (< 30 minutes)
  if (history.length > 0) {
    const lastMessage = history[history.length - 1];
    if (lastMessage) {
      const timeSinceLastMessage = Date.now() - new Date(lastMessage.timestamp).getTime();
      if (timeSinceLastMessage < 30 * 60 * 1000) {
        // User is active, skip follow-up to avoid interruption
        throw new Error('USER_ACTIVE_RECENTLY');
      }
    }
  }

  switch (category) {
    case 'schedule_confirm': {
      const title = payload?.appointmentTitle as string | undefined;
      const date = payload?.appointmentDate as string | undefined;
      const time = payload?.appointmentTime as string | undefined;
      const description = payload?.appointmentDescription as string | undefined;
      const isReminder = payload?.isReminder as boolean | undefined;

      if (title && date && time) {
        // Use ProactiveAgent for natural message generation
        const agent = createProactiveAgent();
        const prompt = `El usuario tiene ${isReminder ? 'un recordatorio' : 'una cita'} agendado: "${title}" para el ${date} a las ${time}${description ? ` (${description})` : ''}. Escribe un mensaje amigable y breve (máximo 2 líneas) confirmando que todo sigue en pie. Sé cercano y usa emojis moderadamente.`;

        const response = await agent.respond(prompt, userId, claudeHistory);
        return response;
      }
      // Fallback
      return 'Solo confirmando que tu cita sigue en pie. ¿Todo listo?';
    }
    case 'document_status':
      return '¿El análisis del documento te fue útil? Estoy aquí si necesitas algo más.';
    case 'reminder_check':
      return 'Te recuerdo tu pendiente. ¿Quieres que lo marque como completado?';
    default:
      return '¿Sigue pendiente tu solicitud? Avísame si necesitas ayuda adicional.';
  }
}

export async function GET(req: Request): Promise<Response> {
  // Verify cron authentication
  const { CRON_SECRET } = getEnv();
  if (CRON_SECRET) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
  }

  try {
    const jobs = await fetchDueFollowUps(20);
    let sent = 0;
    let skipped = 0;
    for (const job of jobs) {
      try {
        const phone = await getUserPhone(job.user_id as string);
        if (!phone) {
          await markFollowUpStatus(job.id as string, 'failed');
          continue;
        }

        // Build intelligent follow-up message with context
        const message = await buildIntelligentFollowUp(
          job.category as string,
          job.payload,
          job.conversation_id as string,
          job.user_id as string
        );

        await sendWhatsAppText(phone, message);
        await markFollowUpStatus(job.id as string, 'sent');
        sent++;
      } catch (err: any) {
        // If user is active recently, cancel follow-up instead of failing
        if (err.message === 'USER_ACTIVE_RECENTLY') {
          await markFollowUpStatus(job.id as string, 'cancelled');
          skipped++;
          logger.debug('Follow-up skipped - user active recently', {
            metadata: { jobId: job.id }
          });
        } else {
          logger.error('Follow-up error', err, { metadata: { jobId: job.id } });
          await markFollowUpStatus(job.id as string, 'failed');
        }
      }
    }
    return jsonResponse({ processed: jobs.length, sent, skipped });
  } catch (error: any) {
    return jsonResponse({ error: error?.message ?? 'Follow-up cron error' }, 500);
  }
}
