import crypto from 'crypto'

let currentReminderTitle = 'E2E reminder'

jest.mock('@vercel/functions', () => {
  const pending: Promise<unknown>[] = []
  return {
    waitUntil: (promiseLike: unknown) => {
      const promise =
        promiseLike && typeof (promiseLike as Promise<unknown>).then === 'function'
          ? (promiseLike as Promise<unknown>)
          : Promise.resolve()
      pending.push(Promise.resolve(promise).catch(() => undefined))
    },
    __flushWaitUntil: async () => {
      await Promise.all(pending.splice(0))
    },
  }
})

jest.mock('../../src/modules/messaging-window/application/service', () => ({
  updateMessagingWindow: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/shared/infra/whatsapp', () => ({
  sendWhatsAppText: jest.fn().mockResolvedValue('wamid.e2e.outbound'),
  reactWithWarning: jest.fn().mockResolvedValue(undefined),
  markAsRead: jest.fn().mockResolvedValue(undefined),
  createTypingManager: jest.fn(() => ({
    startPersistent: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
  downloadWhatsAppMedia: jest.fn(),
}))

jest.mock('../../src/modules/ai/application/proactive-agent', () => ({
  createProactiveAgent: () => ({
    respond: async (userMessage: string, userId: string) => {
      if (/recu[eé]rdame|recordarme|no olvides|av[ií]same/i.test(userMessage)) {
        const { createReminder } = require('../../src/modules/reminders/application/service')
        const datetimeIso = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('Z', '-05:00')
        await createReminder(userId, currentReminderTitle, 'created by integration test', datetimeIso)
        return {
          text: `Listo. Recordatorio creado: ${currentReminderTitle}`,
          usage: { inputTokens: 120, outputTokens: 24, totalTokens: 144 },
          cost: { input: 0.0001, output: 0.00002, total: 0.00012 },
          finishReason: 'tool-calls',
          toolCalls: 1,
        }
      }

      return {
        text: 'Listo.',
        usage: { inputTokens: 60, outputTokens: 10, totalTokens: 70 },
        cost: { input: 0.00005, output: 0.00001, total: 0.00006 },
        finishReason: 'stop',
        toolCalls: 0,
      }
    },
  }),
}))

const { POST } = require('../../app/api/whatsapp/webhook/route')
const { getSupabaseServerClient } = require('../../src/shared/infra/db/supabase')

function createSignedWebhookRequest(payload: unknown): Request {
  const raw = JSON.stringify(payload)
  const secret = process.env.WHATSAPP_APP_SECRET || 'test-secret'
  const escaped = raw.replace(/[^\x00-\x7F]/g, (char) => {
    return '\\u' + ('0000' + char.charCodeAt(0).toString(16)).slice(-4)
  })
  const signature = crypto.createHmac('sha256', secret).update(escaped).digest('hex')

  return new Request('https://test.com/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': `sha256=${signature}`,
    },
    body: raw,
  })
}

describe('Agent E2E - Text Tool Intent', () => {
  const supabase = getSupabaseServerClient()

  it('processes webhook end-to-end and creates reminder from tool intent', async () => {
    const random = Date.now().toString().slice(-6)
    const phone = `+573110${random}`
    currentReminderTitle = `E2E reminder ${random}`
    const inboundWaId = `wamid.e2e.${random}`

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'PHONE_ID',
                },
                contacts: [
                  {
                    profile: { name: 'E2E User' },
                    wa_id: phone,
                  },
                ],
                messages: [
                  {
                    from: phone,
                    id: inboundWaId,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: {
                      body: 'avisame',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const req = createSignedWebhookRequest(payload)
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    const { __flushWaitUntil } = jest.requireMock('@vercel/functions') as {
      __flushWaitUntil: () => Promise<void>
    }
    await __flushWaitUntil()

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle()
    expect(userErr).toBeNull()
    expect(userRow?.id).toBeDefined()
    const userId = userRow!.id

    const { data: convRow, error: convErr } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()
    expect(convErr).toBeNull()
    expect(convRow?.id).toBeDefined()
    const conversationId = convRow!.id

    const { data: inboundRows, error: inboundErr } = await supabase
      .from('messages_v2')
      .select('id, content, direction, type')
      .eq('conversation_id', conversationId)
      .eq('wa_message_id', inboundWaId)
      .eq('direction', 'inbound')
    expect(inboundErr).toBeNull()
    expect((inboundRows ?? []).length).toBe(1)
    expect(inboundRows?.[0]?.type).toBe('text')

    const { data: outboundRows, error: outboundErr } = await supabase
      .from('messages_v2')
      .select('id, content, direction')
      .eq('conversation_id', conversationId)
      .eq('direction', 'outbound')
      .order('timestamp', { ascending: false })
      .limit(1)
    expect(outboundErr).toBeNull()
    expect((outboundRows ?? []).length).toBe(1)
    expect(outboundRows?.[0]?.content?.toLowerCase()).toContain('recordatorio')

    const { data: reminders, error: reminderErr } = await supabase
      .from('reminders')
      .select('id, title, status')
      .eq('user_id', userId)
      .eq('title', currentReminderTitle)
      .order('created_at', { ascending: false })
      .limit(1)
    expect(reminderErr).toBeNull()
    expect((reminders ?? []).length).toBe(1)
    expect(reminders?.[0]?.status).toBe('pending')

    // Cleanup to keep integration db tidy
    await supabase
      .from('reminders')
      .delete()
      .eq('user_id', userId)
      .eq('title', currentReminderTitle)
  })

  it('processes simple conversational text without creating side effects', async () => {
    const random = (Date.now() + 1).toString().slice(-6)
    const phone = `+573111${random}`
    const inboundWaId = `wamid.e2e.simple.${random}`

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'PHONE_ID',
                },
                contacts: [
                  {
                    profile: { name: 'E2E Simple User' },
                    wa_id: phone,
                  },
                ],
                messages: [
                  {
                    from: phone,
                    id: inboundWaId,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: {
                      body: 'hola',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const req = createSignedWebhookRequest(payload)
    const res = await POST(req)
    expect(res.status).toBe(200)

    const { __flushWaitUntil } = jest.requireMock('@vercel/functions') as {
      __flushWaitUntil: () => Promise<void>
    }
    await __flushWaitUntil()

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle()
    expect(userRow?.id).toBeDefined()
    const userId = userRow!.id

    const { data: reminders } = await supabase
      .from('reminders')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    expect((reminders ?? []).length).toBe(0)
  })

  it('deduplicates duplicate webhook delivery by wa_message_id', async () => {
    const random = (Date.now() + 2).toString().slice(-6)
    const phone = `+573112${random}`
    currentReminderTitle = `E2E dedupe ${random}`
    const inboundWaId = `wamid.e2e.dup.${random}`

    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'ACCOUNT_ID',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '15551234567',
                  phone_number_id: 'PHONE_ID',
                },
                contacts: [
                  {
                    profile: { name: 'E2E Dedupe User' },
                    wa_id: phone,
                  },
                ],
                messages: [
                  {
                    from: phone,
                    id: inboundWaId,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'text',
                    text: {
                      body: 'avisame',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    }

    const req1 = createSignedWebhookRequest(payload)
    const req2 = createSignedWebhookRequest(payload)
    const res1 = await POST(req1)
    const res2 = await POST(req2)
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    const { __flushWaitUntil } = jest.requireMock('@vercel/functions') as {
      __flushWaitUntil: () => Promise<void>
    }
    await __flushWaitUntil()

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('phone_number', phone)
      .maybeSingle()
    expect(userRow?.id).toBeDefined()
    const userId = userRow!.id

    const { data: reminders } = await supabase
      .from('reminders')
      .select('id, title')
      .eq('user_id', userId)
      .eq('title', currentReminderTitle)

    expect((reminders ?? []).length).toBe(1)

    await supabase
      .from('reminders')
      .delete()
      .eq('user_id', userId)
      .eq('title', currentReminderTitle)
  })
})
