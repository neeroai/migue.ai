/**
 * Emergency Kill Switch Tests - Critical Fix #4 (2025-10-11)
 *
 * Tests for the emergency kill switch that allows instant AI shutdown
 * Context: $277 incident - need ability to stop all AI processing immediately
 *
 * REGRESSION TEST: These tests MUST pass after implementing kill switch
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { AIProviderManager } from '../../lib/ai-providers'

describe('Emergency Kill Switch - Critical Fix #4', () => {
  let originalEnv: string | undefined
  let providerManager: AIProviderManager

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.AI_EMERGENCY_STOP
    // Reset env
    delete process.env.AI_EMERGENCY_STOP
    // Create fresh instance
    providerManager = new AIProviderManager()
  })

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.AI_EMERGENCY_STOP = originalEnv
    } else {
      delete process.env.AI_EMERGENCY_STOP
    }
  })

  describe('selectProvider()', () => {
    it('should return provider when kill switch is OFF', async () => {
      // Kill switch OFF (default)
      process.env.AI_EMERGENCY_STOP = 'false'

      const provider = await providerManager.selectProvider('chat')

      // Should return a valid provider
      expect(provider).not.toBeNull()
      expect(['gemini', 'openai', 'claude']).toContain(provider)
    })

    it('should return null when kill switch is ON (CRITICAL FIX)', async () => {
      // Kill switch ON
      process.env.AI_EMERGENCY_STOP = 'true'

      const provider = await providerManager.selectProvider('chat')

      // Should return null - all AI disabled
      expect(provider).toBeNull()
    })

    it('should block all task types when kill switch is ON', async () => {
      process.env.AI_EMERGENCY_STOP = 'true'

      const chatProvider = await providerManager.selectProvider('chat')
      const transcriptionProvider = await providerManager.selectProvider('transcription')
      const ocrProvider = await providerManager.selectProvider('ocr')
      const streamingProvider = await providerManager.selectProvider('streaming')

      // All should be null
      expect(chatProvider).toBeNull()
      expect(transcriptionProvider).toBeNull()
      expect(ocrProvider).toBeNull()
      expect(streamingProvider).toBeNull()
    })

    it('should work immediately after env change', async () => {
      // Initially OFF
      process.env.AI_EMERGENCY_STOP = 'false'
      const provider1 = await providerManager.selectProvider('chat')
      expect(provider1).not.toBeNull()

      // Turn ON
      process.env.AI_EMERGENCY_STOP = 'true'
      const provider2 = await providerManager.selectProvider('chat')
      expect(provider2).toBeNull()

      // Turn OFF again
      delete process.env.AI_EMERGENCY_STOP
      const provider3 = await providerManager.selectProvider('chat')
      expect(provider3).not.toBeNull()
    })

    it('should only trigger on exact string "true"', async () => {
      const testValues = [
        { value: 'true', expected: null },
        { value: 'false', expected: 'not-null' },
        { value: 'TRUE', expected: 'not-null' },
        { value: 'True', expected: 'not-null' },
        { value: '1', expected: 'not-null' },
        { value: 'yes', expected: 'not-null' },
        { value: '', expected: 'not-null' },
      ]

      for (const { value, expected } of testValues) {
        process.env.AI_EMERGENCY_STOP = value
        const provider = await providerManager.selectProvider('chat')

        if (expected === null) {
          expect(provider).toBeNull()
        } else {
          expect(provider).not.toBeNull()
        }
      }
    })
  })

  describe('$277 Incident Prevention', () => {
    it('should stop all AI requests immediately (REGRESSION TEST)', async () => {
      // Simulate emergency: costs are spiking
      process.env.AI_EMERGENCY_STOP = 'true'

      // Try to make 100 AI requests
      const results = []
      for (let i = 0; i < 100; i++) {
        const provider = await providerManager.selectProvider('chat')
        results.push(provider)
      }

      // ALL should be null - no providers returned
      const allNull = results.every((p) => p === null)
      expect(allNull).toBe(true)
      expect(results).toHaveLength(100)
    })

    it('should prevent cost escalation within seconds', async () => {
      // Before: Takes minutes to identify and stop issue
      // After: Set env variable and costs stop immediately

      const startTime = Date.now()

      // Enable kill switch
      process.env.AI_EMERGENCY_STOP = 'true'

      // Attempt multiple requests
      for (let i = 0; i < 50; i++) {
        const provider = await providerManager.selectProvider('chat')
        expect(provider).toBeNull()
      }

      const elapsed = Date.now() - startTime

      // Should complete in <100ms (extremely fast)
      expect(elapsed).toBeLessThan(100)
    })

    it('should work across multiple instances', async () => {
      // Multiple webhook invocations running simultaneously
      process.env.AI_EMERGENCY_STOP = 'true'

      const instance1 = new AIProviderManager()
      const instance2 = new AIProviderManager()
      const instance3 = new AIProviderManager()

      const provider1 = await instance1.selectProvider('chat')
      const provider2 = await instance2.selectProvider('chat')
      const provider3 = await instance3.selectProvider('chat')

      // All instances respect kill switch
      expect(provider1).toBeNull()
      expect(provider2).toBeNull()
      expect(provider3).toBeNull()
    })
  })

  describe('User Experience', () => {
    it('should allow graceful recovery after kill switch', async () => {
      // Enable kill switch
      process.env.AI_EMERGENCY_STOP = 'true'
      const blocked = await providerManager.selectProvider('chat')
      expect(blocked).toBeNull()

      // Resolve issue, disable kill switch
      delete process.env.AI_EMERGENCY_STOP

      // Should work again
      const recovered = await providerManager.selectProvider('chat')
      expect(recovered).not.toBeNull()
    })

    it('should be toggle-able for testing', async () => {
      // Enable
      process.env.AI_EMERGENCY_STOP = 'true'
      expect(await providerManager.selectProvider('chat')).toBeNull()

      // Disable
      process.env.AI_EMERGENCY_STOP = 'false'
      expect(await providerManager.selectProvider('chat')).not.toBeNull()

      // Enable again
      process.env.AI_EMERGENCY_STOP = 'true'
      expect(await providerManager.selectProvider('chat')).toBeNull()
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined env variable (default OFF)', async () => {
      delete process.env.AI_EMERGENCY_STOP

      const provider = await providerManager.selectProvider('chat')

      // Default behavior - should return provider
      expect(provider).not.toBeNull()
    })

    it('should be case-sensitive', async () => {
      // Only lowercase 'true' should trigger
      const cases = ['TRUE', 'True', 'tRuE', 'TrUe']

      for (const testCase of cases) {
        process.env.AI_EMERGENCY_STOP = testCase
        const provider = await providerManager.selectProvider('chat')
        expect(provider).not.toBeNull() // Should NOT be null
      }
    })

    it('should handle whitespace', async () => {
      const cases = [' true', 'true ', ' true ', '\ttrue', 'true\n']

      for (const testCase of cases) {
        process.env.AI_EMERGENCY_STOP = testCase
        const provider = await providerManager.selectProvider('chat')
        expect(provider).not.toBeNull() // Whitespace should not match
      }
    })
  })

  describe('Integration with AI processing', () => {
    it('should prevent provider selection for all AI operations', async () => {
      process.env.AI_EMERGENCY_STOP = 'true'

      // All AI operations should be blocked
      const operations = [
        'chat',
        'transcription',
        'ocr',
        'long_task',
        'streaming',
      ] as const

      for (const op of operations) {
        const provider = await providerManager.selectProvider(op)
        expect(provider).toBeNull()
      }
    })

    it('should return immediately without checking API keys', async () => {
      // Remove all API keys
      delete process.env.GOOGLE_AI_API_KEY
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY

      // Enable kill switch
      process.env.AI_EMERGENCY_STOP = 'true'

      // Should still return null (kill switch checked FIRST)
      const provider = await providerManager.selectProvider('chat')
      expect(provider).toBeNull()
    })
  })

  describe('Operational Usage', () => {
    it('should document how to enable in production', async () => {
      // How to enable in Vercel Dashboard:
      // 1. Go to Project Settings > Environment Variables
      // 2. Add: AI_EMERGENCY_STOP = true
      // 3. Redeploy (optional, env vars load dynamically in Edge Functions)

      // How to enable with Vercel CLI:
      // vercel env add AI_EMERGENCY_STOP production
      // Value: true

      // Verification:
      process.env.AI_EMERGENCY_STOP = 'true'
      const provider = await providerManager.selectProvider('chat')
      expect(provider).toBeNull()

      // ✅ Kill switch active - all AI processing stopped
    })

    it('should provide rollback instructions', async () => {
      // How to disable kill switch:
      // 1. Vercel Dashboard: Set AI_EMERGENCY_STOP = false (or delete)
      // 2. Or via CLI: vercel env rm AI_EMERGENCY_STOP production

      process.env.AI_EMERGENCY_STOP = 'false'
      const provider = await providerManager.selectProvider('chat')
      expect(provider).not.toBeNull()

      // ✅ AI processing restored
    })
  })

  describe('Cost Impact', () => {
    it('should calculate maximum damage prevention', async () => {
      // Incident: $277 in 2-4 hours
      // Average rate: ~$70/hour during incident
      // Kill switch activation time: <1 minute

      // Damage without kill switch (15 minutes to notice): $17.50
      // Damage with kill switch (1 minute to notice): $1.17
      // Savings per incident: $16.33

      process.env.AI_EMERGENCY_STOP = 'true'

      // Simulate 1000 requests during incident
      let blockedRequests = 0
      for (let i = 0; i < 1000; i++) {
        const provider = await providerManager.selectProvider('chat')
        if (provider === null) blockedRequests++
      }

      expect(blockedRequests).toBe(1000)

      // All 1000 requests blocked = $0 additional cost
      // vs ~$5-10 if they had executed
    })
  })
})
