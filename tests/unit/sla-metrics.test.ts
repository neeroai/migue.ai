import { describe, it, expect } from '@jest/globals'
import { resolveSloBudgetMs, SLA_METRICS } from '../../src/shared/observability/metrics'

describe('SLA metric budgets', () => {
  it('resolves route decision budget', () => {
    expect(resolveSloBudgetMs(SLA_METRICS.ROUTE_DECISION_MS)).toBe(20)
  })

  it('resolves typing start budget', () => {
    expect(resolveSloBudgetMs(SLA_METRICS.TYPING_START_MS)).toBe(300)
  })

  it('resolves end-to-end budget by pathway', () => {
    expect(resolveSloBudgetMs(SLA_METRICS.END_TO_END_MS, 'text_fast_path')).toBe(2000)
    expect(resolveSloBudgetMs(SLA_METRICS.END_TO_END_MS, 'tool_intent')).toBe(4000)
    expect(resolveSloBudgetMs(SLA_METRICS.END_TO_END_MS, 'rich_input')).toBe(9000)
  })

  it('returns null for unsupported pathway or metric', () => {
    expect(resolveSloBudgetMs(SLA_METRICS.END_TO_END_MS, 'unsupported')).toBeNull()
    expect(resolveSloBudgetMs(SLA_METRICS.RICH_INPUT_TIMEOUT_COUNT)).toBeNull()
  })
})
