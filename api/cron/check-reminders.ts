export const config = { runtime: 'edge' };

import { getSupabaseServerClient } from '../../lib/supabase';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function getDueReminders() {
  const supabase = getSupabaseServerClient()
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('reminders')
    .select('id, user_id, title, description, scheduled_time, status')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso)
  if (error) throw error
  return data || []
}

async function getUserPhone(userId: string) {
  const supabase = getSupabaseServerClient()
  const { data, error } = await supabase
    .from('users')
    .select('phone_number')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data?.phone_number as string
}

async function sendWhatsAppText(to: string, body: string) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) throw new Error('Missing WhatsApp config')
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`WhatsApp send failed ${res.status}: ${detail}`)
  }
}

async function markReminderSent(id: string) {
  const supabase = getSupabaseServerClient()
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'sent' })
    .eq('id', id)
  if (error) throw error
}

export default async function handler(_req: Request): Promise<Response> {
  try {
    const due = await getDueReminders()
    let processed = 0
    for (const r of due) {
      try {
        const phone = await getUserPhone(r.user_id)
        if (!phone) continue
        const body = r.description ? `${r.title}: ${r.description}` : r.title
        await sendWhatsAppText(phone, body)
        await markReminderSent(r.id)
        processed++
      } catch {
        // skip failed reminders for now
      }
    }
    return jsonResponse({ processed })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Cron error' }, 500)
  }
}
