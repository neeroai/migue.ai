import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { scheduleFollowUp, fetchDueFollowUps, markFollowUpStatus } from '../../src/modules/followups/application/service'
import { getSupabaseServerClient } from '../../src/shared/infra/db/supabase'

jest.mock('../../src/shared/infra/db/supabase', () => ({
  getSupabaseServerClient: jest.fn(),
}))

describe('follow-up jobs', () => {
  // Create chain builder that supports multiple .eq() calls
  const createChainBuilder = () => ({
    eq: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue({ data: [], error: null }),
  })

  let deleteBuilder: ReturnType<typeof createChainBuilder>
  let selectBuilder: ReturnType<typeof createChainBuilder>
  let updateBuilder: { eq: jest.Mock }
  let mockInsert: jest.Mock
  let mockClient: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Reset builders for each test
    deleteBuilder = createChainBuilder()
    selectBuilder = createChainBuilder()
    updateBuilder = {
      eq: jest.fn().mockReturnValue({ error: null }),
    }
    mockInsert = jest.fn().mockReturnValue({ error: null })

    mockClient = {
      from: jest.fn((table: string) => {
        if (table !== 'follow_up_jobs') {
          throw new Error(`unexpected table ${table}`)
        }
        return {
          insert: mockInsert,
          delete: jest.fn(() => deleteBuilder),
          select: jest.fn(() => selectBuilder),
          update: jest.fn(() => updateBuilder),
        }
      }),
    }

    ;(getSupabaseServerClient as unknown as jest.Mock).mockReturnValue(mockClient)
  })

  it('schedules follow-up with default delay', async () => {
    await scheduleFollowUp({
      userId: 'user-1',
      conversationId: 'conv-1',
      category: 'schedule_confirm',
    })

    expect(deleteBuilder.eq).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 'user-1',
      conversation_id: 'conv-1',
      category: 'schedule_confirm',
    }))
  })

  it('fetches due follow-ups', async () => {
    selectBuilder.limit.mockReturnValueOnce({
      data: [{ id: 'job-1', category: 'schedule_confirm' }],
      error: null,
    })
    const jobs = await fetchDueFollowUps()
    expect(jobs).toHaveLength(1)
  })

  it('marks follow-up status', async () => {
    await markFollowUpStatus('job-1', 'sent')
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'job-1')
  })
})
