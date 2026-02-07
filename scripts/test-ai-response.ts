/**
 * Test AI response locally
 * Simulates WhatsApp webhook message and gets AI response
 * Usage: npx tsx scripts/test-ai-response.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local explicitly
config({ path: resolve(process.cwd(), '.env.local') })

import { createProactiveAgent } from '../src/modules/ai/application/proactive-agent'

async function testAIResponse() {
  console.log('Testing AI Response...\n')

  const agent = createProactiveAgent()

  const testMessages = [
    'hola',
    'como estas?',
    'recuerdame comprar pan manana a las 8am'
  ]

  for (const message of testMessages) {
    console.log(`\n=== User: ${message} ===`)

    try {
      const startTime = Date.now()

      const response = await agent.respond(
        message,
        'test-user-id',
        [], // Empty conversation history
        {
          conversationId: 'test-conv-id',
          messageId: 'test-msg-id'
        }
      )

      const duration = Date.now() - startTime

      console.log(`AI Response (${duration}ms):`)
      console.log(response)
      console.log('')

    } catch (error: any) {
      console.error('ERROR:', error.message)
      if (error.cause) {
        console.error('Cause:', error.cause)
      }
    }
  }
}

testAIResponse()
