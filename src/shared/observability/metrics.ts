import { logger } from './logger'

export const SLA_METRICS = {
  ROUTE_DECISION_MS: 'sla.route_decision_ms',
  END_TO_END_MS: 'sla.end_to_end_ms',
  RICH_INPUT_TIMEOUT_COUNT: 'sla.rich_input_timeout_count',
  TYPING_START_MS: 'sla.typing_start_ms',
} as const

export type SlaMetricName = typeof SLA_METRICS[keyof typeof SLA_METRICS]

type EmitMetricOptions = {
  requestId?: string
  userId?: string
  conversationId?: string
  value: number
  inputClass?: string
  messageType?: string
  pathway?: string
  extra?: Record<string, unknown>
}

/**
 * Structured metric emitter over logger.performance.
 * Keeps metric names stable for dashboards/alerts in log-based observability tools.
 */
export function emitSlaMetric(name: SlaMetricName, options: EmitMetricOptions): void {
  const context = {
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.userId ? { userId: options.userId } : {}),
    ...(options.conversationId ? { conversationId: options.conversationId } : {}),
    metadata: {
      metric_name: name,
      metric_value: options.value,
      ...(options.inputClass ? { input_class: options.inputClass } : {}),
      ...(options.messageType ? { message_type: options.messageType } : {}),
      ...(options.pathway ? { pathway: options.pathway } : {}),
      ...(options.extra ?? {}),
    },
  }

  logger.performance(name, options.value, {
    ...context,
  })
}
