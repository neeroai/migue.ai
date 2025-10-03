import { describe, it, expect } from '@jest/globals'
import { getActionDefinition, getScheduleButtons, getReminderOptions } from '../../lib/actions'

describe('interactive action definitions', () => {
  it('resolves known action', () => {
    const def = getActionDefinition('action:schedule_confirm')
    expect(def).not.toBeNull()
    expect(def?.directResponse).toBeDefined()
  })

  it('provides schedule buttons', () => {
    const buttons = getScheduleButtons()
    expect(buttons).toHaveLength(3)
    expect(buttons[0]?.id).toContain('action:')
  })

  it('provides reminder options', () => {
    const rows = getReminderOptions()
    expect(rows.some((row) => row.id === 'action:reminder_cancel')).toBe(true)
  })
})
