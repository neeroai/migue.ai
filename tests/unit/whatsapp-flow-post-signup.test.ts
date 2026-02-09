import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const getSupabaseServerClientMock = jest.fn()
const sendWhatsAppTextMock = jest.fn()

jest.mock('../../src/shared/infra/db/supabase', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

jest.mock('../../src/shared/infra/whatsapp/messaging', () => ({
  sendWhatsAppText: (...args: unknown[]) => sendWhatsAppTextMock(...args),
}))

import {
  completeFlowSessionOnce,
  sendPostSignupWelcome,
} from '../../src/shared/infra/whatsapp/flows'

describe('whatsapp flow post-signup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns completed=true when flow session transitions to completed', async () => {
    const flowSessionsTable = {
      update: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { flow_id: 'user_signup_flow', user_id: 'u1' },
          error: null,
        }),
      })),
    }

    getSupabaseServerClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'flow_sessions') return flowSessionsTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await completeFlowSessionOnce('token-1')
    expect(result).toEqual({
      completed: true,
      flowId: 'user_signup_flow',
      userId: 'u1',
    })
  })

  it('returns completed=false when flow was already completed', async () => {
    const flowSessionsTable = {
      update: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      })),
    }

    getSupabaseServerClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'flow_sessions') return flowSessionsTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const result = await completeFlowSessionOnce('token-2')
    expect(result).toEqual({ completed: false })
  })

  it('sends personalized welcome message after signup', async () => {
    sendWhatsAppTextMock.mockResolvedValue('wamid.outbound')
    const usersTable = {
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { phone_number: '+573001112233', name: 'Polo Torres' },
          error: null,
        }),
      })),
    }

    getSupabaseServerClientMock.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'users') return usersTable
        throw new Error(`Unexpected table ${table}`)
      }),
    })

    const ok = await sendPostSignupWelcome('u1')
    expect(ok).toBe(true)
    expect(sendWhatsAppTextMock).toHaveBeenCalledWith(
      '+573001112233',
      expect.stringContaining('Polo')
    )
  })
})

