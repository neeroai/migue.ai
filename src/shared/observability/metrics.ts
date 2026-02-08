import { logger } from './logger'

export const SLA_METRICS = {
  ROUTE_DECISION_MS: 'sla.route_decision_ms',
  END_TO_END_MS: 'sla.end_to_end_ms',
  RICH_INPUT_TIMEOUT_COUNT: 'sla.rich_input_timeout_count',
  TYPING_START_MS: 'sla.typing_start_ms',
  SLO_VIOLATION_COUNT: 'sla.slo_violation_count',
  MEMORY_READ_MS: 'memory.read_ms',
  MEMORY_WRITE_COUNT: 'memory.write_count',
  MEMORY_HIT_RATIO: 'memory.hit_ratio',
  PROFILE_HIT_RATIO: 'memory.profile_hit_ratio',
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

const ROUTE_DECISION_BUDGET_MS = 20
const TYPING_START_BUDGET_MS = 300
const END_TO_END_BUDGET_BY_PATHWAY: Record<string, number> = {
  text_fast_path: 2000,
  tool_intent: 4000,
  rich_input: 9000,
}

export function resolveSloBudgetMs(name: SlaMetricName, pathway?: string): number | null {
  if (name === SLA_METRICS.ROUTE_DECISION_MS) return ROUTE_DECISION_BUDGET_MS
  if (name === SLA_METRICS.TYPING_START_MS) return TYPING_START_BUDGET_MS
  if (name === SLA_METRICS.END_TO_END_MS && pathway) {
    return END_TO_END_BUDGET_BY_PATHWAY[pathway] ?? null
  }
  return null
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

  const budgetMs = resolveSloBudgetMs(name, options.pathway)
  if (budgetMs !== null && options.value > budgetMs) {
    logger.warn('[SLA] Budget violation detected', {
      ...(options.requestId ? { requestId: options.requestId } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      metadata: {
        violated_metric: name,
        metric_value: options.value,
        budget_ms: budgetMs,
        ...(options.pathway ? { pathway: options.pathway } : {}),
        ...(options.inputClass ? { input_class: options.inputClass } : {}),
        ...(options.messageType ? { message_type: options.messageType } : {}),
      },
    })

    logger.performance(SLA_METRICS.SLO_VIOLATION_COUNT, 1, {
      ...(options.requestId ? { requestId: options.requestId } : {}),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.conversationId ? { conversationId: options.conversationId } : {}),
      metadata: {
        metric_name: SLA_METRICS.SLO_VIOLATION_COUNT,
        metric_value: 1,
        violated_metric: name,
        budget_ms: budgetMs,
        actual_value: options.value,
        ...(options.pathway ? { pathway: options.pathway } : {}),
      },
    })
  }
}
