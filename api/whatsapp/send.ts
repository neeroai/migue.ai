export const config = { runtime: 'edge' };

export const GRAPH_BASE_URL = 'https://graph.facebook.com/v19.0'

type WhatsAppPayload = {
  messaging_product: 'whatsapp'
  to: string
  type: string
  [key: string]: unknown
}

export async function sendWhatsAppRequest(payload: WhatsAppPayload) {
  const token = process.env.WHATSAPP_TOKEN
  const phoneId = process.env.WHATSAPP_PHONE_ID
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials')
  }
  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`
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
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`)
  }
  return res.json()
}

export async function sendWhatsAppText(to: string, body: string) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  })
  return result?.messages?.[0]?.id ?? null
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>
) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((button) => ({
          type: 'reply',
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  })
  return result?.messages?.[0]?.id ?? null
}

export async function sendInteractiveList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  sectionTitle = 'Opciones'
) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonLabel,
        sections: [
          {
            title: sectionTitle,
            rows: rows.map((row) => ({
              id: row.id,
              title: row.title,
              description: row.description,
            })),
          },
        ],
      },
    },
  })
  return result?.messages?.[0]?.id ?? null
}

export async function sendTypingIndicator(to: string, status: 'typing' | 'paused') {
  await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'typing',
    typing: { status },
  })
}

const TYPING_REFRESH_MS = 7000

export function createTypingManager(to: string) {
  let active = false
  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  const scheduleRefresh = () => {
    clearTimer()
    refreshTimer = setTimeout(async () => {
      try {
        await sendTypingIndicator(to, 'typing')
      } catch (err: any) {
        console.error('Typing refresh error:', err?.message)
      } finally {
        if (active) {
          scheduleRefresh()
        }
      }
    }, TYPING_REFRESH_MS)
  }

  return {
    async start() {
      if (active) return
      try {
        await sendTypingIndicator(to, 'typing')
        active = true
        scheduleRefresh()
      } catch (err: any) {
        console.error('Typing indicator error:', err?.message)
      }
    },
    async stop() {
      if (!active) return
      active = false
      clearTimer()
      try {
        await sendTypingIndicator(to, 'paused')
      } catch (err: any) {
        console.error('Typing pause error:', err?.message)
      }
    },
  }
}
