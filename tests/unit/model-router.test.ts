import { describe, expect, it } from '@jest/globals'
import { getFallbackSelection, selectModel, type ModelSelection } from '../../src/modules/ai/domain/model-router'

describe('model router with capability catalog', () => {
  it('prioritizes tool_execution profile for tool messages', () => {
    const selection = selectModel({
      estimatedTokens: 1200,
      complexity: 'high',
      budgetRemaining: 1,
      hasTools: true,
      inputType: 'text',
    })

    expect(selection.taskProfile).toBe('tool_execution')
    expect(selection.modelName).toBe('openai/gpt-4o-mini')
  })

  it('prioritizes long_context profile for large token estimates', () => {
    const selection = selectModel({
      estimatedTokens: 9000,
      complexity: 'high',
      budgetRemaining: 1,
      hasTools: false,
      inputType: 'text',
    })

    expect(selection.taskProfile).toBe('long_context')
    expect(selection.modelName).toBe('google/gemini-2.5-flash-lite')
  })

  it('uses budget_critical reason under low remaining budget', () => {
    const selection = selectModel({
      estimatedTokens: 1000,
      complexity: 'low',
      budgetRemaining: 0.001,
      hasTools: false,
      inputType: 'text',
    })

    expect(selection.reason).toBe('budget_critical')
  })

  it('chooses fallback with different provider when available', () => {
    const primary = selectModel({
      estimatedTokens: 1000,
      complexity: 'low',
      budgetRemaining: 1,
      hasTools: false,
      inputType: 'text',
    }) as ModelSelection

    const fallback = getFallbackSelection(primary, {
      estimatedTokens: 1000,
      complexity: 'low',
      budgetRemaining: 1,
      hasTools: false,
      inputType: 'text',
    })

    expect(fallback.provider).not.toBe(primary.provider)
  })
})
