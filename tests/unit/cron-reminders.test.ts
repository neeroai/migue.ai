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
  const reminderSelectBuilder = {
    eq: jest.fn(),
    lte: jest.fn(),
  }
  const reminderUpdateBuilder = {
    eq: jest.fn(),
  }
  const supabaseMock = {
    from: jest.fn((table: string) => {
      if (table === 'reminders') {
        return {
          select: jest.fn(() => reminderSelectBuilder),
          update: jest.fn(() => reminderUpdateBuilder),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'reminders') {
        return {
          select: jest.fn(() => reminderSelectBuilder),
          update: jest.fn(() => reminderUpdateBuilder),
        }
      }
      throw new Error(`Unexpected table ${table}`)
    })
    reminderSelectBuilder.eq.mockReturnValue(reminderSelectBuilder)
    reminderSelectBuilder.lte.mockResolvedValue({
      data: [
        {
          id: 'rem-1',
          user_id: 'user-1',
          title: 'Recordatorio',
          description: 'Descripción',
          scheduled_time: '2025-10-01T10:00:00Z',
          status: 'pending',
          send_token: null,
          users: { phone_number: '+521234567890' },
        },
      ],
      error: null,
    })
    reminderUpdateBuilder.eq.mockResolvedValue({ error: null })
    ;(getSupabaseServerClient as unknown as jest.Mock).mockReturnValue(supabaseMock as any)
    ;(recordCalendarEvent as unknown as jest.Mock).mockResolvedValue(undefined)
    ;(sendWhatsAppText as unknown as jest.Mock).mockResolvedValue('msg-123')
  })

  it('processes due reminders and marks them sent', async () => {
    const res = await handler(new Request('https://cron.test/reminders'))
    const json = await res.json()
    expect(json.processed).toBe(1)
    expect(sendWhatsAppText).toHaveBeenCalledWith('+521234567890', expect.stringContaining('Recordatorio'))
    expect(reminderUpdateBuilder.eq).toHaveBeenCalledWith('id', 'rem-1')
  })
})
