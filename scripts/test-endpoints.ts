/**
 * Test endpoint responses
 * Usage: npx tsx scripts/test-endpoints.ts
 */

interface EndpointTest {
  name: string
  url: string
  method: 'GET' | 'POST'
  expectedStatus: number
  validator: (response: any) => { pass: boolean; message: string }
}

const tests: EndpointTest[] = [
  {
    name: 'Health Endpoint',
    url: 'http://localhost:3000/api/health',
    method: 'GET',
    expectedStatus: 503, // Unhealthy locally due to missing API keys
    validator: (data) => {
      if (!data.checks) {
        return { pass: false, message: 'Missing checks object' }
      }
      if (!data.checks.ai) {
        return { pass: false, message: 'Missing ai check (still using old openai field?)' }
      }
      return { pass: true, message: 'Health endpoint structure correct' }
    }
  },
  {
    name: 'WhatsApp Webhook Verification',
    url: 'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test_token&hub.challenge=test123',
    method: 'GET',
    expectedStatus: 403, // Should fail with wrong token
    validator: (data) => {
      if (typeof data === 'string' && data.includes('Forbidden')) {
        return { pass: true, message: 'Webhook verification working (rejects invalid token)' }
      }
      return { pass: false, message: 'Unexpected response' }
    }
  }
]

async function testEndpoint(test: EndpointTest): Promise<void> {
  console.log(`\n=== Testing: ${test.name} ===`)
  console.log(`URL: ${test.url}`)
  console.log(`Method: ${test.method}`)

  try {
    const response = await fetch(test.url, { method: test.method })
    console.log(`Status: ${response.status} (expected: ${test.expectedStatus})`)

    const contentType = response.headers.get('content-type')
    let data: any

    if (contentType?.includes('application/json')) {
      data = await response.json()
      console.log('Response:', JSON.stringify(data, null, 2).substring(0, 200))
    } else {
      data = await response.text()
      console.log('Response:', data.substring(0, 200))
    }

    const validation = test.validator(data)
    console.log(`Validation: ${validation.pass ? 'PASS' : 'FAIL'}`)
    console.log(`Message: ${validation.message}`)

    if (response.status !== test.expectedStatus) {
      console.log(`WARNING: Status mismatch (got ${response.status}, expected ${test.expectedStatus})`)
    }
  } catch (error: any) {
    console.log(`ERROR: ${error.message}`)
  }
}

async function main() {
  console.log('Testing Endpoints...\n')
  console.log('Note: Dev server must be running (npm run dev)')

  for (const test of tests) {
    await testEndpoint(test)
  }

  console.log('\n=== Summary ===')
  console.log('Tests completed. Check output above for details.')
}

main()
