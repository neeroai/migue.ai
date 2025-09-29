export const config = { runtime: 'edge' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type SendBody = {
  to: string
  type?: 'text'
  text?: { body: string }
}

async function callWhatsAppAPI(body: SendBody, attempt: number): Promise<Response> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) {
    return jsonResponse({ error: 'Missing WhatsApp config' }, 500)
  }
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to: body.to,
    type: 'text',
    text: { body: body.text?.body ?? '' },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (res.ok) return res
  // Retry on 429/5xx with simple backoff
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    const delay = 200 * Math.pow(2, attempt)
    await new Promise(r => setTimeout(r, delay))
    return callWhatsAppAPI(body, attempt + 1)
  }
  return res
}

export default async function handler(req: Request): Promise<Response> {
  const requestId = getRequestId();
  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method Not Allowed', request_id: requestId }, 405)
    }
    const body = (await req.json().catch(() => null)) as SendBody | null
    if (!body || !body.to || !body.text?.body) {
      return jsonResponse({ error: 'Invalid body', request_id: requestId }, 400)
    }
    const res = await callWhatsAppAPI(body, 0)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return jsonResponse({ error: 'WhatsApp send failed', status: res.status, detail, request_id: requestId }, 502)
    }
    const data = await res.json().catch(() => ({}))
    return jsonResponse({ success: true, data, request_id: requestId })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? 'Unhandled error', request_id: requestId }, 500)
  }
}
