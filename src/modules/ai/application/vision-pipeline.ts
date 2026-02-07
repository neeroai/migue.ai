import { generateObject } from 'ai'
import { z } from 'zod'
import { hasToolIntent } from '../domain/intent'
import { getBudgetStatus, trackUsage } from '../domain/cost-tracker'
import { logger } from '../../../shared/observability/logger'
import { MODEL_CATALOG, models } from '../domain/providers'

export type VisualInputClass = 'DOCUMENT_TEXT' | 'RECEIPT_INVOICE' | 'ID_FORM' | 'GENERAL_IMAGE'

const VISION_PRIMARY_MODEL = models.openai.primary
const VISION_FALLBACK_MODEL = models.gemini.primary

const visualExtractionSchema = z.object({
  userResponse: z.string().min(1),
  extractedText: z.string().default(''),
  confidence: z.number().min(0).max(1).default(0.7),
  detectedIntent: z.enum(['tool', 'informational', 'unknown']).default('unknown'),
})

function normalizeMimeType(mimeType: string): string {
  return (mimeType || 'application/octet-stream').toLowerCase()
}

export function classifyVisualInput(caption: string | null | undefined, mimeType: string): VisualInputClass {
  const text = (caption ?? '').toLowerCase()
  const mime = normalizeMimeType(mimeType)

  if (mime.includes('pdf') || mime.includes('msword') || mime.includes('officedocument')) {
    return 'DOCUMENT_TEXT'
  }
  if (/(factura|recibo|invoice|cuenta|ticket|total|nit|ruc)/i.test(text)) {
    return 'RECEIPT_INVOICE'
  }
  if (/(cedula|cédula|pasaporte|id|identidad|documento de identidad|dni|licencia)/i.test(text)) {
    return 'ID_FORM'
  }
  return 'GENERAL_IMAGE'
}

function instructionByClass(inputClass: VisualInputClass): string {
  if (inputClass === 'DOCUMENT_TEXT') {
    return 'Extrae el texto relevante y explica de forma breve lo importante para el usuario.'
  }
  if (inputClass === 'RECEIPT_INVOICE') {
    return 'Extrae datos clave (comercio, fecha, total, conceptos) y resume en formato util.'
  }
  if (inputClass === 'ID_FORM') {
    return 'Identifica campos visibles y entrega un resumen seguro sin exponer datos sensibles innecesarios.'
  }
  return 'Describe la imagen de forma util y responde segun el objetivo del usuario.'
}

type AnalyzeVisualInputParams = {
  bytes: Uint8Array
  mimeType: string
  caption: string | null
  userId: string
  conversationId: string
  messageId: string
}

export type AnalyzeVisualInputResult = {
  inputClass: VisualInputClass
  responseText: string
  extractedText: string
  toolIntentDetected: boolean
}

export async function analyzeVisualInput(params: AnalyzeVisualInputParams): Promise<AnalyzeVisualInputResult> {
  const { bytes, mimeType, caption, userId, conversationId, messageId } = params
  const inputClass = classifyVisualInput(caption, mimeType)
  const instruction = instructionByClass(inputClass)

  const prompt = [
    'Eres un analista multimodal para WhatsApp en espanol colombiano.',
    'Responde de forma clara y breve (maximo 500 caracteres).',
    'Si no puedes leer o entender la imagen, dilo explicitamente.',
    instruction,
    caption ? `Contexto del usuario: "${caption}"` : 'No hay caption adicional del usuario.',
  ].join('\n')

  const budgetStatus = getBudgetStatus()
  const providerOptions = budgetStatus.dailyRemaining > 0.2
    ? ({ gateway: { models: [VISION_FALLBACK_MODEL] } } as any)
    : undefined

  const startedAt = Date.now()
  const result = await generateObject({
    model: VISION_PRIMARY_MODEL,
    schema: visualExtractionSchema,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: bytes, mediaType: normalizeMimeType(mimeType) },
        ],
      },
    ],
    temperature: 0.2,
    ...(providerOptions ? { providerOptions } : {}),
  })

  const gatewayMeta = (result as any)?.providerMetadata?.gateway
  const gatewayModel = gatewayMeta?.model || VISION_PRIMARY_MODEL
  const modelConfig = MODEL_CATALOG[gatewayModel] || MODEL_CATALOG[VISION_PRIMARY_MODEL]
  const usedProvider = modelConfig?.provider ?? 'openai'
  const providerConfig = usedProvider === 'openai' ? models.openai : models.gemini

  const inputTokens = result.usage.inputTokens ?? 0
  const outputTokens = result.usage.outputTokens ?? 0
  const totalTokens = result.usage.totalTokens ?? inputTokens + outputTokens
  const inputCost = (inputTokens / 1_000_000) * providerConfig.costPer1MTokens.input
  const outputCost = (outputTokens / 1_000_000) * providerConfig.costPer1MTokens.output
  const totalCost = inputCost + outputCost

  trackUsage(
    usedProvider,
    gatewayModel,
    { promptTokens: inputTokens, completionTokens: outputTokens, totalTokens },
    { inputCost, outputCost, totalCost, model: gatewayModel },
    { conversationId, userId, messageId }
  )

  logger.info('[VisionPipeline] Visual analysis completed', {
    conversationId,
    userId,
    metadata: {
      inputClass,
      model: gatewayModel,
      provider: usedProvider,
      durationMs: Date.now() - startedAt,
      usage: { inputTokens, outputTokens, totalTokens },
      cost: { inputCost, outputCost, totalCost },
    },
  })

  const responseText = result.object.userResponse.trim().slice(0, 700)
  const extractedText = result.object.extractedText.trim().slice(0, 5000)
  const toolIntentDetected = hasToolIntent(`${caption ?? ''}\n${extractedText}`) || result.object.detectedIntent === 'tool'

  return {
    inputClass,
    responseText: responseText || 'Listo.',
    extractedText,
    toolIntentDetected,
  }
}
