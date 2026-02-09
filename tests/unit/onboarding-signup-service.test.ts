import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const sendFlowMock = jest.fn()
const getSupabaseServerClientMock = jest.fn()

jest.mock('../../src/shared/infra/whatsapp', () => ({
  sendFlow: (...args: unknown[]) => sendFlowMock(...args),
}))

jest.mock('../../src/shared/infra/db/supabase', () => ({
  getSupabaseServerClient: () => getSupabaseServerClientMock(),
}))

import { ensureSignupOnFirstContact } from '../../src/modules/onboarding/application/service'

type UsersResult = {
  data: any
  error: any
}

type FlowSessionResult = {
  data: any
  error: any
}

type ConversationsResult = {
  data: any
  error: any
}

type MessagesResult = {
  data: any
  error: any
}

function createSupabaseMock(
  usersResult: UsersResult,
  flowSessionResult: FlowSessionResult,
  completedFlowSessionResult: FlowSessionResult = { data: null, error: null },
  conversationsResult: ConversationsResult = { data: [], error: null },
  messagesResult: MessagesResult = { data: [], error: null }
) {
  let flowSessionsTableCallCount = 0

  const usersQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(usersResult),
  }

  const flowSessionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(flowSessionResult),
  }

  const completedFlowSessionsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(completedFlowSessionResult),
  }

  const conversationsQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(conversationsResult),
  }

  const messagesQuery = {
    select: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(messagesResult),
  }

  return {
    from: jest.fn((table: string) => {
      if (table === 'users') return usersQuery
      if (table === 'flow_sessions') {
        flowSessionsTableCallCount += 1
        return flowSessionsTableCallCount === 1 ? completedFlowSessionsQuery : flowSessionsQuery
      }
      if (table === 'conversations') return conversationsQuery
      if (table === 'messages_v2') return messagesQuery
      throw new Error(`Unexpected table ${table}`)
    }),
  }
}

describe('ensureSignupOnFirstContact', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.SIGNUP_FLOW_ENABLED
    delete process.env.SIGNUP_FLOW_ID
  })

  it('does not block when user already completed onboarding', async () => {
    getSupabaseServerClientMock.mockReturnValue(
      createSupabaseMock(
        {
          data: {
            name: 'Polo',
            email: 'polo@example.com',
            onboarding_completed_at: '2026-02-08T00:00:00.000Z',
          },
          error: null,
        },
        { data: null, error: null }
      )
    )

    const result = await ensureSignupOnFirstContact({
      userId: 'u1',
      phoneNumber: '+573001112233',
    })

    expect(result).toEqual({ blocked: false, reason: 'already_completed' })
    expect(sendFlowMock).not.toHaveBeenCalled()
  })

  it('does not block legacy users with name/email even without onboarding timestamp', async () => {
    getSupabaseServerClientMock.mockReturnValue(
      createSupabaseMock(
        {
          data: {
            name: 'Polo',
            email: 'polo@example.com',
            onboarding_completed_at: null,
          },
          error: null,
        },
        { data: null, error: null }
      )
    )

    const result = await ensureSignupOnFirstContact({
      userId: 'u1',
      phoneNumber: '+573001112233',
    })

    expect(result).toEqual({ blocked: false, reason: 'already_completed' })
    expect(sendFlowMock).not.toHaveBeenCalled()
  })

  it('blocks if there is already an active signup flow session', async () => {
    getSupabaseServerClientMock.mockReturnValue(
      createSupabaseMock(
        {
          data: {
            name: null,
            email: null,
            onboarding_completed_at: null,
          },
          error: null,
        },
        { data: { id: 'flow-1' }, error: null },
        { data: [], error: null },
        { data: [], error: null }
      )
    )

    const result = await ensureSignupOnFirstContact({
      userId: 'u1',
      phoneNumber: '+573001112233',
    })

    expect(result).toEqual({ blocked: true, reason: 'already_in_progress' })
    expect(sendFlowMock).not.toHaveBeenCalled()
  })

  it('sends signup flow and blocks the AI turn for incomplete users', async () => {
    sendFlowMock.mockResolvedValue('wamid.flow.message')
    getSupabaseServerClientMock.mockReturnValue(
      createSupabaseMock(
        {
          data: {
            name: null,
            email: null,
            onboarding_completed_at: null,
          },
          error: null,
        },
        { data: null, error: null },
        { data: [], error: null },
        { data: [], error: null }
      )
    )

    const result = await ensureSignupOnFirstContact({
      userId: 'u1',
      phoneNumber: '+573001112233',
      conversationId: 'c1',
      requestId: 'r1',
    })

    expect(result).toEqual({ blocked: true, reason: 'flow_sent' })
    expect(sendFlowMock).toHaveBeenCalledWith(
      '+573001112233',
      'user_signup_flow',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        userId: 'u1',
        flowType: 'navigate',
        initialScreen: 'WELCOME',
      })
    )
  })

  it('does not block users with prior assistant outbound history', async () => {
    getSupabaseServerClientMock.mockReturnValue(
      createSupabaseMock(
        {
          data: {
            name: null,
            email: null,
            onboarding_completed_at: null,
          },
          error: null,
        },
        { data: null, error: null },
        { data: null, error: null },
        { data: [{ id: 'c1' }], error: null },
        { data: [{ id: 'm1' }], error: null }
      )
    )

    const result = await ensureSignupOnFirstContact({
      userId: 'u1',
      phoneNumber: '+573001112233',
    })

    expect(result).toEqual({ blocked: false, reason: 'already_completed' })
    expect(sendFlowMock).not.toHaveBeenCalled()
  })
})
