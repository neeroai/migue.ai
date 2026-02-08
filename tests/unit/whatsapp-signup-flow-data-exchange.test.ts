import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/shared/infra/db/supabase', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

import { handleFlowDataExchange } from '../../src/shared/infra/whatsapp/flows'

type Session = {
  flow_token: string
  flow_id: string
  user_id: string
  session_data?: Record<string, unknown>
}

function createSupabaseMock(session: Session) {
  const flowSessionsSelectChain = {
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: session, error: null }),
  }

  const flowSessionsUpdateChain = {
    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
  }

  const usersUpdateChain = {
    eq: jest.fn().mockResolvedValue({ data: null, error: null }),
  }

  const flowSessionsTable = {
    select: jest.fn(() => flowSessionsSelectChain),
    update: jest.fn(() => flowSessionsUpdateChain),
  }

  const usersTable = {
    update: jest.fn(() => usersUpdateChain),
  }

  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'flow_sessions') return flowSessionsTable
      if (table === 'users') return usersTable
      throw new Error(`Unexpected table ${table}`)
    }),
    __mocks: {
      usersTable,
      usersUpdateChain,
    },
  }

  return supabase
}

describe('WhatsApp signup flow data exchange', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('keeps BASIC_INFO screen when email is invalid', async () => {
    const session: Session = {
      flow_token: 'token-1',
      flow_id: 'user_signup_flow',
      user_id: 'user-1',
      session_data: {},
    }
    const supabase = createSupabaseMock(session)
    getSupabaseServerClientMock.mockReturnValue(supabase)

    const response = await handleFlowDataExchange({
      version: '3.0',
      action: 'data_exchange',
      screen: 'BASIC_INFO',
      flow_token: 'token-1',
      data: {
        name: 'Polo',
        email: 'email-invalido',
      },
    })

    expect(response?.screen).toBe('BASIC_INFO')
    expect((response?.data as any)?.errors?.email).toBeDefined()
    expect(supabase.__mocks.usersTable.update).not.toHaveBeenCalled()
  })

  it('persists name/email and completes signup flow on valid data', async () => {
    const session: Session = {
      flow_token: 'token-2',
      flow_id: 'user_signup_flow',
      user_id: 'user-2',
      session_data: {},
    }
    const supabase = createSupabaseMock(session)
    getSupabaseServerClientMock.mockReturnValue(supabase)

    const response = await handleFlowDataExchange({
      version: '3.0',
      action: 'data_exchange',
      screen: 'BASIC_INFO',
      flow_token: 'token-2',
      data: {
        name: '  Polo  ',
        email: '  Polo@Example.com ',
      },
    })

    expect(response?.screen).toBe('SUCCESS')
    expect(supabase.__mocks.usersTable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Polo',
        email: 'polo@example.com',
        onboarding_version: 'v1',
      })
    )
  })
})
