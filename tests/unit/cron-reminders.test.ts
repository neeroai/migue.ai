import { describe, it, expect, beforeEach, jest } from '@jest/globals'

jest.mock('../../lib/env', () => ({
  getEnv: () => ({
    CRON_SECRET: undefined,
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    TIMEZONE: 'America/Mexico_City',
  }),
}))

import { GET as handler } from '../../app/api/cron/check-reminders/route'
import { getSupabaseServerClient } from '../../lib/supabase'
import { recordCalendarEvent } from '../../lib/calendar-store'
import { sendWhatsAppText } from '../../lib/whatsapp'

jest.mock('../../lib/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

jest.mock('../../lib/calendar-store', () => ({
  recordCalendarEvent: jest.fn(),
}))

jest.mock('../../lib/whatsapp', () => ({
  sendWhatsAppText: jest.fn(),
}))

describe('check-reminders cron', () => {
  const reminderUpdateBuilder = {
    eq: jest.fn(),
  }
  const supabaseMock = {
    rpc: jest.fn(),
    from: jest.fn((table: string) => {
      if (table === 'reminders') {
        return {
          update: jest.fn(() => reminderUpdateBuilder),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock RPC call for get_due_reminders_locked
    supabaseMock.rpc.mockResolvedValue({
      data: [
        {
          id: 'rem-1',
          user_id: 'user-1',
          title: 'Recordatorio',
          description: 'Descripción',
          scheduled_time: '2025-10-01T10:00:00Z',
          status: 'pending',
          send_token: null,
          created_at: '2025-10-01T09:00:00Z',
          phone_number: '+521234567890',
        },
      ],
      error: null,
    })
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'reminders') {
        return {
          update: jest.fn(() => reminderUpdateBuilder),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
    reminderUpdateBuilder.eq.mockResolvedValue({ error: null })
    ;(getSupabaseServerClient as unknown as jest.Mock).mockReturnValue(supabaseMock as any)
    ;(recordCalendarEvent as unknown as jest.Mock).mockResolvedValue(undefined)
    ;(sendWhatsAppText as unknown as jest.Mock).mockResolvedValue('msg-123')
  })

  it('processes due reminders and marks them sent', async () => {
    const req = new Request('https://cron.test/reminders', {
      headers: { 'user-agent': 'vercel-cron/1.0' }
    })
    const res = await handler(req)
    const json = await res.json()
    expect(json.processed).toBe(1)
    expect(sendWhatsAppText).toHaveBeenCalledWith('+521234567890', expect.stringContaining('Recordatorio'))
    expect(reminderUpdateBuilder.eq).toHaveBeenCalledWith('id', 'rem-1')
  })
})
