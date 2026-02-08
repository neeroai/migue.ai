import crypto from 'crypto'

let currentExpenseDescription = 'E2E rich input expense'
let currentAmount = 11000
let capturedExplicitConsent: boolean | undefined
let expenseSideEffectExecuted = false

const mockSendWhatsAppText = jest.fn(async () => 'wamid.e2e.outbound.rich')
const mockInsertOutboundMessage = jest.fn(async () => undefined)
const mockUpdateInboundMessageByWaId = jest.fn(async () => undefined)
const mockPersistNormalizedMessage = jest.fn()
const mockReactWithWarning = jest.fn(async () => undefined)
const mockMarkAsRead = jest.fn(async () => undefined)
const mockCreateTypingManager = jest.fn(() => ({
  startPersistent: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
}))
const mockDownloadWhatsAppMedia = jest.fn().mockResolvedValue({
  bytes: new Uint8Array([1, 2, 3, 4]),
  mimeType: 'image/jpeg',
})
const mockGetBudgetStatus = jest.fn()
const mockIsUserOverBudget = jest.fn()
const mockTrackUsage = jest.fn()
const mockGetCostTracker = jest.fn()
const mockExecuteAgentTurn = jest.fn()

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

jest.mock('../../src/modules/ai/domain/cost-tracker', () => ({
  getBudgetStatus: (...args: unknown[]) => mockGetBudgetStatus(...args),
  isUserOverBudget: (...args: unknown[]) => mockIsUserOverBudget(...args),
  trackUsage: (...args: unknown[]) => mockTrackUsage(...args),
  getCostTracker: (...args: unknown[]) => mockGetCostTracker(...args),
}))

jest.mock('../../src/shared/infra/db/persist', () => ({
  insertOutboundMessage: (...args: unknown[]) => mockInsertOutboundMessage(...args),
  updateInboundMessageByWaId: (...args: unknown[]) => mockUpdateInboundMessageByWaId(...args),
}))

jest.mock('../../src/modules/webhook/domain/message-normalization', () => {
  const actual = jest.requireActual('../../src/modules/webhook/domain/message-normalization')
  return {
    ...actual,
    persistNormalizedMessage: (...args: unknown[]) => mockPersistNormalizedMessage(...args),
  }
})

jest.mock('../../src/shared/infra/whatsapp', () => ({
  sendWhatsAppText: (...args: unknown[]) => mockSendWhatsAppText(...args),
  reactWithWarning: (...args: unknown[]) => mockReactWithWarning(...args),
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
  createTypingManager: (...args: unknown[]) => mockCreateTypingManager(...args),
  downloadWhatsAppMedia: (...args: unknown[]) => mockDownloadWhatsAppMedia(...args),
}))

jest.mock('../../src/modules/ai/application/vision-pipeline', () => ({
  analyzeVisualInput: jest.fn().mockResolvedValue({
    inputClass: 'GENERAL_IMAGE',
    responseText: 'Recibo detectado.',
    extractedText:
      'Detalle del movimiento\nEnvío Realizado\nPara Maria Torres\n¿Cuánto? $11.000,00\nReferencia M09023854',
    toolIntentDetected: true,
  }),
}))

jest.mock('../../src/modules/ai/application/agent-turn-orchestrator', () => ({
  executeAgentTurn: (...args: unknown[]) => mockExecuteAgentTurn(...args),
}))

const { POST } = require('../../app/api/whatsapp/webhook/route')

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

describe('Agent E2E - Rich Input Expense', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedExplicitConsent = undefined
    expenseSideEffectExecuted = false
    mockPersistNormalizedMessage.mockResolvedValue({
      userId: 'user-e2e',
      conversationId: 'conv-e2e',
      wasInserted: true,
    })
    mockGetBudgetStatus.mockReturnValue({
      dailySpent: 0,
      monthlySpent: 0,
      dailyLimit: 3,
      monthlyLimit: 90,
      dailyRemaining: 3,
      monthlyRemaining: 90,
    })
    mockIsUserOverBudget.mockReturnValue(false)
    mockGetCostTracker.mockReturnValue({
      isHydratedState: () => true,
      ensureHydrated: async () => undefined,
    })
    mockSendWhatsAppText.mockResolvedValue('wamid.e2e.outbound.rich')
    mockReactWithWarning.mockResolvedValue(undefined)
    mockMarkAsRead.mockResolvedValue(undefined)
    mockCreateTypingManager.mockReturnValue({
      startPersistent: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
    })
    mockDownloadWhatsAppMedia.mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3, 4]),
      mimeType: 'image/jpeg',
    })
    const mockedVision = require('../../src/modules/ai/application/vision-pipeline')
    mockedVision.analyzeVisualInput.mockResolvedValue({
      inputClass: 'GENERAL_IMAGE',
      responseText: 'Recibo detectado.',
      extractedText:
        'Detalle del movimiento\nEnvío Realizado\nPara Maria Torres\n¿Cuánto? $11.000,00\nReferencia M09023854',
      toolIntentDetected: true,
    })
    mockExecuteAgentTurn.mockImplementation(async (params: any) => {
      capturedExplicitConsent = params?.explicitToolConsent
      expenseSideEffectExecuted = !!capturedExplicitConsent
      return {
        responseText: `Listo. Registré tu gasto de COP ${currentAmount}.`,
        raw: {
          usage: { inputTokens: 150, outputTokens: 22, totalTokens: 172 },
          cost: { input: 0.00011, output: 0.00002, total: 0.00013 },
          finishReason: 'tool-calls',
          toolCalls: 1,
        },
      }
    })
  })

  it('processes image + explicit consent, stores expense, and avoids placeholder messages', async () => {
    const random = Date.now().toString().slice(-6)
    const phone = `+573113${random}`
    const inboundWaId = `wamid.e2e.rich.${random}`
    currentExpenseDescription = `E2E rich input ${random}`
    currentAmount = 11000

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
                    profile: { name: 'E2E Rich User' },
                    wa_id: phone,
                  },
                ],
                messages: [
                  {
                    from: phone,
                    id: inboundWaId,
                    timestamp: `${Math.floor(Date.now() / 1000)}`,
                    type: 'image',
                    image: {
                      id: 'media.image.e2e',
                      caption: 'Guarda este gasto',
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

    expect(capturedExplicitConsent).toBe(true)
    expect(expenseSideEffectExecuted).toBe(true)

    const sentTexts = mockSendWhatsAppText.mock.calls.map((call) => String(call[1] ?? ''))
    expect(sentTexts.some((text) => text.includes('Recibí tu archivo'))).toBe(false)
    expect(sentTexts.some((text) => text.includes('está tardando más de lo normal'))).toBe(false)
    expect(sentTexts.some((text) => text.toLowerCase().includes('registré tu gasto'))).toBe(true)

    expect(mockUpdateInboundMessageByWaId).toHaveBeenCalledWith(
      inboundWaId,
      expect.objectContaining({
        content: expect.stringContaining('Detalle del movimiento'),
      })
    )

    expect(mockInsertOutboundMessage).toHaveBeenCalledWith(
      'conv-e2e',
      expect.stringContaining('Registré tu gasto'),
      expect.any(String)
    )
  })
})
