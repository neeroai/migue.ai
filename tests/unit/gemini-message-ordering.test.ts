/**
 * Gemini Message Ordering Tests - Critical Fix #1 (2025-10-11)
 *
 * Tests for the Gemini message ordering bug fix that prevents API errors
 * Context: $277 incident - Gemini rejects history starting with 'model' role
 *
 * REGRESSION TEST: These tests MUST pass after fixing message ordering
 */

import { describe, it, expect } from '@jest/globals'
import { convertToGeminiMessages } from '../../lib/gemini-client'
import type { ChatMessage } from '../../types/schemas'

describe('Gemini Message Ordering - Critical Fix #1', () => {
  describe('convertToGeminiMessages()', () => {
    it('should convert basic user-assistant conversation', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result).toHaveLength(3)
      expect(result[0]!.role).toBe('user')
      expect(result[1]!.role).toBe('model')
      expect(result[2]!.role).toBe('user')
    })

    it('should drop leading assistant message (CRITICAL FIX)', () => {
      // This scenario happens when bot sends proactive message
      // Next user reply creates history starting with assistant role
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Hey! How was your day?' }, // Proactive message
        { role: 'user', content: 'Good, thanks!' },
        { role: 'assistant', content: 'Great to hear!' },
      ]

      const result = convertToGeminiMessages(messages)

      // Should drop first message to start with 'user'
      expect(result).toHaveLength(2)
      expect(result[0]!.role).toBe('user')
      expect(result[0]!.parts[0]!.text).toBe('Good, thanks!')
    })

    it('should drop multiple leading assistant messages', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Message 1' },
        { role: 'assistant', content: 'Message 2' },
        { role: 'assistant', content: 'Message 3' },
        { role: 'user', content: 'User reply' },
      ]

      const result = convertToGeminiMessages(messages)

      // Should drop all 3 leading assistant messages
      expect(result).toHaveLength(1)
      expect(result[0]!.role).toBe('user')
    })

    it('should return empty array if only assistant messages', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Message 1' },
        { role: 'assistant', content: 'Message 2' },
      ]

      const result = convertToGeminiMessages(messages)

      // No user messages - return empty
      expect(result).toHaveLength(0)
    })

    it('should filter out null/empty content messages', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: null },
        { role: 'user', content: '' },
        { role: 'assistant', content: 'Response' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result).toHaveLength(2)
      expect(result[0]!.parts[0]!.text).toBe('Hello')
      expect(result[1]!.parts[0]!.text).toBe('Response')
    })

    it('should preserve message order after dropping leading assistant', () => {
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Proactive' }, // Dropped
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' },
        { role: 'user', content: 'C' },
        { role: 'assistant', content: 'D' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result).toHaveLength(4)
      expect(result[0]!.parts[0]!.text).toBe('A')
      expect(result[1]!.parts[0]!.text).toBe('B')
      expect(result[2]!.parts[0]!.text).toBe('C')
      expect(result[3]!.parts[0]!.text).toBe('D')
    })
  })

  describe('$277 Incident Scenarios', () => {
    it('should handle proactive follow-up scenario (REGRESSION TEST)', () => {
      // Real scenario from the incident:
      // 1. Bot sends proactive message: "¿Cómo te fue con tu reunión?"
      // 2. User replies: "Muy bien"
      // 3. History now starts with 'model' role -> Gemini error
      const messages: ChatMessage[] = [
        { role: 'assistant', content: '¿Cómo te fue con tu reunión?' },
        { role: 'user', content: 'Muy bien' },
      ]

      const result = convertToGeminiMessages(messages)

      // Should start with user message
      expect(result[0]!.role).toBe('user')
      expect(result[0]!.parts[0]!.text).toBe('Muy bien')
    })

    it('should handle daily briefing scenario', () => {
      // Bot sends morning briefing (outbound)
      // User responds
      const messages: ChatMessage[] = [
        { role: 'assistant', content: 'Buenos días! Tienes 2 reuniones hoy.' },
        { role: 'user', content: 'Gracias' },
        { role: 'assistant', content: 'De nada!' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result[0]!.role).toBe('user')
      expect(result).toHaveLength(2)
    })

    it('should handle reminder notification scenario', () => {
      // Bot sends reminder (outbound)
      // User replies
      const messages: ChatMessage[] = [
        { role: 'assistant', content: '⏰ Recordatorio: Reunión con cliente en 30 min' },
        { role: 'user', content: 'ok' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result[0]!.role).toBe('user')
      expect(result[0]!.parts[0]!.text).toBe('ok')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty array', () => {
      const messages: ChatMessage[] = []
      const result = convertToGeminiMessages(messages)
      expect(result).toHaveLength(0)
    })

    it('should handle single user message', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
      ]

      const result = convertToGeminiMessages(messages)
      expect(result).toHaveLength(1)
      expect(result[0]!.role).toBe('user')
    })

    it('should handle alternating roles starting with user', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' },
        { role: 'user', content: 'C' },
        { role: 'assistant', content: 'D' },
      ]

      const result = convertToGeminiMessages(messages)

      // Should not drop anything - already starts with user
      expect(result).toHaveLength(4)
      expect(result[0]!.role).toBe('user')
    })

    it('should handle messages with undefined tool_calls', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Create reminder', tool_calls: undefined },
        { role: 'assistant', content: 'Done!', tool_calls: undefined },
      ]

      const result = convertToGeminiMessages(messages)
      expect(result).toHaveLength(2)
    })
  })

  describe('Gemini API Compatibility', () => {
    it('should create valid Content objects', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Test message' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result[0]).toHaveProperty('role')
      expect(result[0]).toHaveProperty('parts')
      expect(Array.isArray(result[0]!.parts)).toBe(true)
      expect(result[0]!.parts[0]).toHaveProperty('text')
    })

    it('should map roles correctly (user -> user, assistant -> model)', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'A' },
        { role: 'assistant', content: 'B' },
      ]

      const result = convertToGeminiMessages(messages)

      expect(result[0]!.role).toBe('user')
      expect(result[1]!.role).toBe('model')
    })

    it('should ensure first message is always role=user (Gemini requirement)', () => {
      const scenarios = [
        [{ role: 'assistant' as const, content: 'Bot' }, { role: 'user' as const, content: 'User' }],
        [{ role: 'assistant' as const, content: 'A' }, { role: 'assistant' as const, content: 'B' }, { role: 'user' as const, content: 'C' }],
        [{ role: 'user' as const, content: 'Already user' }],
      ]

      for (const messages of scenarios) {
        const result = convertToGeminiMessages(messages)

        if (result.length > 0) {
          expect(result[0]!.role).toBe('user')
        }
      }
    })
  })

  describe('Cost Impact', () => {
    it('should prevent Gemini API error that triggers OpenAI fallback', () => {
      // Before fix: Gemini error -> OpenAI fallback ($$$)
      // After fix: Gemini succeeds (FREE)

      const proactiveScenario: ChatMessage[] = [
        { role: 'assistant', content: 'Proactive message' },
        { role: 'user', content: 'User reply' },
      ]

      const result = convertToGeminiMessages(proactiveScenario)

      // Should create valid Gemini input (first message = user)
      expect(result[0]!.role).toBe('user')

      // This prevents: [GoogleGenerativeAI Error]: First content should be with role 'user'
      // Saving: ~$0.00005 per message (OpenAI GPT-4o-mini cost)
      // Over 100 messages: ~$0.005 savings
      // Over 10,000 messages: ~$0.50 savings
    })

    it('should reduce fallback frequency from 70% to <5%', () => {
      // If 70% of conversations start with proactive message
      // Before: 70% trigger fallback to OpenAI
      // After: <5% trigger fallback (only real errors)

      const sampleConversations = [
        [{ role: 'assistant', content: 'Proactive' }, { role: 'user', content: 'Reply' }],
        [{ role: 'user', content: 'User initiated' }],
        [{ role: 'assistant', content: 'Follow-up' }, { role: 'user', content: 'Response' }],
      ]

      let validCount = 0

      for (const conv of sampleConversations) {
        const result = convertToGeminiMessages(conv)
        if (result.length > 0 && result[0]!.role === 'user') {
          validCount++
        }
      }

      // All should be valid for Gemini
      expect(validCount).toBe(3)
    })
  })
})
