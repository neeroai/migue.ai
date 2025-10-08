/**
 * Tests for Claude Agents - Tool Calling Behavior
 * Validates that ProactiveAgent uses tools correctly
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { ProactiveAgent } from '@/lib/claude-agents'
import * as claudeTools from '@/lib/claude-tools'
import * as reminders from '@/lib/reminders'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  }),
}))

jest.mock('@/lib/reminders', () => ({
  createReminder: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/scheduling', () => ({
  scheduleMeetingFromIntent: jest.fn().mockResolvedValue({
    status: 'success',
    reply: 'Reunión agendada exitosamente',
  }),
}))

describe('ProactiveAgent Tool Calling', () => {
  let agent: ProactiveAgent
  const testUserId = 'test-user-123'

  beforeEach(() => {
    agent = new ProactiveAgent()
    jest.clearAllMocks()
  })

  describe('Tool Availability', () => {
    it('should have all required tools defined', () => {
      const tools = claudeTools.getAllTools()

      expect(tools).toHaveLength(3)
      expect(tools.map(t => t.name)).toContain('create_reminder')
      expect(tools.map(t => t.name)).toContain('schedule_meeting')
      expect(tools.map(t => t.name)).toContain('track_expense')
    })

    it('should have detailed descriptions for create_reminder', () => {
      const reminderTool = claudeTools.createReminderToolSchema

      expect(reminderTool.description).toContain('IMMEDIATELY')
      expect(reminderTool.description).toContain('recuérdame')
      expect(reminderTool.description).toContain('SAVES the reminder')
      expect(reminderTool.description).toContain('Examples:')
    })

    it('should have trigger phrases in tool descriptions', () => {
      const tools = claudeTools.getAllTools()

      tools.forEach(tool => {
        expect(tool.description).toMatch(/Use this tool IMMEDIATELY/i)
        expect(tool.description.length).toBeGreaterThan(100) // Detailed description
      })
    })
  })

  describe('Tool Input Validation', () => {
    it('should validate create_reminder input correctly', async () => {
      const validInput = {
        userId: 'user-123',
        title: 'Llamar a mi tía',
        datetimeIso: '2025-10-08T15:00:00-05:00',
      }

      await expect(
        claudeTools.executeCreateReminder(validInput)
      ).resolves.toContain('✅ Recordatorio creado')
    })

    it('should reject invalid create_reminder input', async () => {
      const invalidInput = {
        userId: 'user-123',
        // Missing required fields
      }

      await expect(
        claudeTools.executeCreateReminder(invalidInput)
      ).rejects.toThrow()
    })

    it('should validate track_expense input correctly', async () => {
      const validInput = {
        userId: 'user-123',
        amount: 500,
        currency: 'MXN',
        category: 'Alimentación',
        description: 'Compras del super',
      }

      await expect(
        claudeTools.executeTrackExpense(validInput)
      ).resolves.toContain('💰 Gasto registrado')
    })
  })

  describe('System Prompt Configuration', () => {
    it('should have explicit tool instructions in system prompt', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('HERRAMIENTAS DISPONIBLES')
      expect(systemPrompt).toContain('ÚSALAS SIEMPRE')
      expect(systemPrompt).toContain('create_reminder')
      expect(systemPrompt).toContain('schedule_meeting')
      expect(systemPrompt).toContain('track_expense')
    })

    it('should include tool usage workflow', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('FLUJO DE TRABAJO')
      expect(systemPrompt).toContain('Detecta si necesita tool')
      expect(systemPrompt).toContain('LLAMA el tool')
      expect(systemPrompt).toContain('Confirma al usuario')
    })

    it('should have examples of correct tool usage', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('EJEMPLOS DE USO CORRECTO')
      expect(systemPrompt).toContain('recuérdame llamar a mi tía')
      expect(systemPrompt).toContain('✅ Listo!')
      expect(systemPrompt).toContain('❌')
    })

    it('should explicitly warn against saying "cannot do"', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('NUNCA DIGAS')
      expect(systemPrompt).toContain('no puedo')
    })

    it('should declare real capabilities upfront', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('CAPACIDADES REALES')
      expect(systemPrompt).toContain('SÍ PUEDES')
      expect(systemPrompt).toContain('CREAR RECORDATORIOS')
      expect(systemPrompt).toContain('AGENDAR REUNIONES')
    })

    it('should have explicit forbidden phrases section', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      expect(systemPrompt).toContain('NUNCA HAGAS ESTO')
      expect(systemPrompt).toContain('EJEMPLOS PROHIBIDOS')
      expect(systemPrompt).toContain('❌')
      expect(systemPrompt).toContain('no puedo configurar recordatorios')
      expect(systemPrompt).toContain('No tengo acceso')
      expect(systemPrompt).toContain('ESTAS FRASES ESTÁN PROHIBIDAS')
    })

    it('should use visual separators for clarity', () => {
      const agent = new ProactiveAgent()
      const systemPrompt = (agent as any).config.systemPrompt

      // Check for section separators
      expect(systemPrompt).toContain('═══')
      expect(systemPrompt).toContain('🎯')
      expect(systemPrompt).toContain('🔧')
    })
  })

  describe('Tool Execution', () => {
    it('should execute create_reminder tool', async () => {
      const input = {
        userId: 'user-123',
        title: 'Test reminder',
        description: null,
        datetimeIso: '2025-10-08T15:00:00-05:00',
      }

      const result = await claudeTools.executeCreateReminder(input)

      expect(result).toContain('✅ Recordatorio creado')
      expect(result).toContain('Test reminder')
      expect(reminders.createReminder).toHaveBeenCalledWith(
        'user-123',
        'Test reminder',
        null,
        '2025-10-08T15:00:00-05:00'
      )
    })

    it('should handle tool execution errors gracefully', async () => {
      jest.mocked(reminders.createReminder).mockRejectedValueOnce(
        new Error('Database error')
      )

      const input = {
        userId: 'user-123',
        title: 'Test reminder',
        datetimeIso: '2025-10-08T15:00:00-05:00',
      }

      await expect(
        claudeTools.executeCreateReminder(input)
      ).rejects.toThrow('Error creando recordatorio')
    })
  })

  describe('Tool Descriptions - Best Practices Compliance', () => {
    it('should follow Anthropic best practices for tool descriptions', () => {
      const tools = claudeTools.getAllTools()

      tools.forEach(tool => {
        // Clear and unambiguous
        expect(tool.description.length).toBeGreaterThan(50)

        // Natural language
        expect(tool.description).not.toContain('API')
        expect(tool.description).not.toContain('endpoint')

        // Includes trigger phrases
        expect(tool.description).toContain('when user says')

        // Confirms what it does
        expect(tool.description).toMatch(/SAVES|CREATES/i)

        // Has examples
        expect(tool.description).toContain('Examples:')
      })
    })

    it('should use directive language in descriptions', () => {
      const tools = claudeTools.getAllTools()

      tools.forEach(tool => {
        expect(tool.description).toContain('IMMEDIATELY')
        expect(tool.description).toContain('✅')
      })
    })
  })
})

describe('Tool Calling Integration', () => {
  it('should have proper tool schema structure', () => {
    const tools = claudeTools.getAllTools()

    tools.forEach(tool => {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('input_schema')
      expect(tool.input_schema).toHaveProperty('type', 'object')
      expect(tool.input_schema).toHaveProperty('properties')
      expect(tool.input_schema).toHaveProperty('required')
    })
  })

  it('should require userId in all tools', () => {
    const tools = claudeTools.getAllTools()

    tools.forEach(tool => {
      expect(tool.input_schema.required).toContain('userId')
      expect(tool.input_schema.properties).toHaveProperty('userId')
    })
  })
})
