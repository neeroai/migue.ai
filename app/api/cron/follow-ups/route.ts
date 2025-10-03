export const runtime = 'edge';

import { getEnv } from '../../../../lib/env';
import { logger } from '../../../../lib/logger';
import { fetchDueFollowUps, markFollowUpStatus } from '../../../../lib/followups';
import { sendWhatsAppText } from '../../../../lib/whatsapp';
import { getSupabaseServerClient } from '../../../../lib/supabase';

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

function buildFollowUpMessage(category: string): string {
  switch (category) {
    case 'schedule_confirm':
      return 'Solo confirmando que tu cita sigue en pie. ¿Todo listo?';
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
    for (const job of jobs) {
      try {
        const phone = await getUserPhone(job.user_id as string);
        if (!phone) {
          await markFollowUpStatus(job.id as string, 'failed');
          continue;
        }
        const message = buildFollowUpMessage(job.category as string);
        await sendWhatsAppText(phone, message);
        await markFollowUpStatus(job.id as string, 'sent');
        sent++;
      } catch (err: any) {
        logger.error('Follow-up error', err, { metadata: { jobId: job.id } });
        await markFollowUpStatus(job.id as string, 'failed');
      }
    }
    return jsonResponse({ processed: jobs.length, sent });
  } catch (error: any) {
    return jsonResponse({ error: error?.message ?? 'Follow-up cron error' }, 500);
  }
}
