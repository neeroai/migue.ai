import { logger } from '../../../shared/observability/logger'
import { emitSlaMetric, SLA_METRICS } from '../../../shared/observability/metrics'
import { reactWithWarning, sendWhatsAppText } from '../../../shared/infra/whatsapp'
import { processAudioMessage, processDocumentMessage } from '../../ai/application/processing'
import { processTextFastPath } from '../../ai/application/text-fast-path'
import { processToolIntent } from '../../ai/application/tool-intent-orchestrator'
import type { NormalizedMessage } from '../domain/message-normalization'
import { classifyInput } from './input-router'

type OrchestratorParams = {
  requestId: string
  conversationId: string
  userId: string
  normalized: NormalizedMessage
}

const RICH_INPUT_TIMEOUT_MS = {
  audio: 45_000,
  image: 30_000,
  document: 30_000,
} as const

const SLOW_PROCESSING_NOTICE_MS = 8_000

function pathwayForInputClass(inputClass: string): string {
  if (inputClass === 'TEXT_SIMPLE') return 'text_fast_path'
  if (inputClass === 'TEXT_TOOL_INTENT') return 'tool_intent'
  if (inputClass === 'RICH_INPUT' || inputClass === 'RICH_INPUT_TOOL_INTENT') return 'rich_input'
  return 'unsupported'
}

function timeoutForType(type: string): number {
  if (type === 'audio') return RICH_INPUT_TIMEOUT_MS.audio
  if (type === 'image') return RICH_INPUT_TIMEOUT_MS.image
  if (type === 'document') return RICH_INPUT_TIMEOUT_MS.document
  return 25_000
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`PROCESSING_TIMEOUT_${timeoutMs}`)), timeoutMs)
    if (typeof (timeoutId as NodeJS.Timeout).unref === 'function') {
      (timeoutId as NodeJS.Timeout).unref()
    }
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export async function processInputByClass({
  requestId,
  conversationId,
  userId,
  normalized,
}: OrchestratorParams): Promise<void> {
  const startedAt = Date.now()
  const routed = classifyInput(normalized)
  const routeDecisionMs = Date.now() - startedAt

  logger.info('[orchestrator] Input classified', {
    requestId,
    conversationId,
    userId,
    metadata: {
      type: normalized.type,
      inputClass: routed.inputClass,
      reason: routed.reason,
      routeDecisionMs,
    },
  })
  emitSlaMetric(SLA_METRICS.ROUTE_DECISION_MS, {
    requestId,
    conversationId,
    userId,
    value: routeDecisionMs,
    inputClass: routed.inputClass,
    messageType: normalized.type,
    pathway: pathwayForInputClass(routed.inputClass),
  })

  if (routed.inputClass === 'TEXT_SIMPLE' && normalized.content && normalized.from) {
    await processTextFastPath({
      conversationId,
      userId,
      userPhone: normalized.from,
      userMessage: normalized.content,
      messageId: normalized.waMessageId,
    })
    emitSlaMetric(SLA_METRICS.END_TO_END_MS, {
      requestId,
      conversationId,
      userId,
      value: Date.now() - startedAt,
      inputClass: routed.inputClass,
      messageType: normalized.type,
      pathway: 'text_fast_path',
    })
    return
  }

  if (routed.inputClass === 'TEXT_TOOL_INTENT' && normalized.content && normalized.from) {
    await processToolIntent({
      conversationId,
      userId,
      userPhone: normalized.from,
      userMessage: normalized.content,
      messageId: normalized.waMessageId,
    })
    emitSlaMetric(SLA_METRICS.END_TO_END_MS, {
      requestId,
      conversationId,
      userId,
      value: Date.now() - startedAt,
      inputClass: routed.inputClass,
      messageType: normalized.type,
      pathway: 'tool_intent',
    })
    return
  }

  if (routed.inputClass === 'RICH_INPUT' || routed.inputClass === 'RICH_INPUT_TOOL_INTENT') {
    if (!normalized.from || !normalized.waMessageId || !normalized.mediaUrl) return

    // Immediate feedback for potentially long-running media jobs.
    await sendWhatsAppText(
      normalized.from,
      'Recibí tu archivo. Lo estoy procesando y te respondo en breve.'
    )

    let done = false
    const slowTimer = setTimeout(() => {
      if (done) return
      void sendWhatsAppText(
        normalized.from,
        'Estoy procesando tu archivo, está tardando más de lo normal. Te respondo apenas termine.'
      ).catch(() => undefined)
    }, SLOW_PROCESSING_NOTICE_MS)
    if (typeof (slowTimer as NodeJS.Timeout).unref === 'function') {
      (slowTimer as NodeJS.Timeout).unref()
    }

    try {
      const timeoutMs = timeoutForType(normalized.type)

      if (normalized.type === 'audio') {
        await withTimeout(processAudioMessage(conversationId, userId, normalized), timeoutMs)
      } else if (normalized.type === 'image' || normalized.type === 'document') {
        await withTimeout(processDocumentMessage(conversationId, userId, normalized), timeoutMs)
      } else {
        await sendWhatsAppText(
          normalized.from,
          'Ese tipo de archivo aún no está soportado. Por ahora puedo procesar audio, imagen y documento.'
        )
      }
    } catch (error: any) {
      logger.error('[orchestrator] Rich input processing failed', error, {
        requestId,
        conversationId,
        userId,
        metadata: {
          type: normalized.type,
          timeoutMs: timeoutForType(normalized.type),
          errorMessage: error?.message,
        },
      })

      await reactWithWarning(normalized.from, normalized.waMessageId).catch(() => undefined)
      const timeoutError = typeof error?.message === 'string' && error.message.includes('PROCESSING_TIMEOUT_')
      if (timeoutError) {
        emitSlaMetric(SLA_METRICS.RICH_INPUT_TIMEOUT_COUNT, {
          requestId,
          conversationId,
          userId,
          value: 1,
          inputClass: routed.inputClass,
          messageType: normalized.type,
          extra: { timeout_ms: timeoutForType(normalized.type) },
        })
      }
      await sendWhatsAppText(
        normalized.from,
        timeoutError
          ? 'No pude completar el procesamiento a tiempo. Intenta con un archivo más corto o envíame texto.'
          : 'No pude procesar ese archivo en este momento. Intenta de nuevo o envíame el contenido en texto.'
      ).catch(() => undefined)
    } finally {
      done = true
      clearTimeout(slowTimer)
      emitSlaMetric(SLA_METRICS.END_TO_END_MS, {
        requestId,
        conversationId,
        userId,
        value: Date.now() - startedAt,
        inputClass: routed.inputClass,
        messageType: normalized.type,
        pathway: 'rich_input',
      })
    }
    return
  }

  if (routed.inputClass === 'STICKER_STANDBY' && normalized.from) {
    await sendWhatsAppText(
      normalized.from,
      'Por ahora no proceso stickers. Si quieres, envíame texto, audio, imagen o documento.'
    )
    emitSlaMetric(SLA_METRICS.END_TO_END_MS, {
      requestId,
      conversationId,
      userId,
      value: Date.now() - startedAt,
      inputClass: routed.inputClass,
      messageType: normalized.type,
      pathway: 'unsupported',
    })
    return
  }

  if (normalized.from) {
    await sendWhatsAppText(
      normalized.from,
      'Ese tipo de mensaje no está soportado por ahora. Intenta con texto, audio, imagen o documento.'
    )
    emitSlaMetric(SLA_METRICS.END_TO_END_MS, {
      requestId,
      conversationId,
      userId,
      value: Date.now() - startedAt,
      inputClass: routed.inputClass,
      messageType: normalized.type,
      pathway: 'unsupported',
    })
  }
}
