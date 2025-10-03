import OpenAI from 'openai'

let cachedClient: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    cachedClient = new OpenAI({
      apiKey,
      timeout: 30000, // 30s timeout
      maxRetries: 2,
    })
  }
  return cachedClient
}

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Call GPT-4o with a list of messages and get a response.
 * Edge-compatible: uses fetch under the hood via OpenAI SDK.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  const client = getOpenAIClient()
  const response = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4o',
    messages: messages as any,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
  })
  const choice = response.choices[0]
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response')
  }
  return choice.message.content
}
