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

export async function streamChatCompletion(
  messages: ChatMessage[],
  options?: {
    model?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<string> {
  const client = getOpenAIClient()
  const stream = await client.chat.completions.create({
    model: options?.model ?? 'gpt-4o',
    messages: messages as any,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
    stream: true,
  })

  let fullText = ''
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (typeof delta === 'string') {
      fullText += delta
    } else if (Array.isArray(delta)) {
      fullText += delta.join('')
    }
  }

  if (!fullText.trim()) {
    throw new Error('OpenAI streaming returned empty response')
  }

  return fullText
}

export type TranscriptionOptions = {
  model?: string
  language?: string
  mimeType?: string
  fileName?: string
}

type UploadableInput = ArrayBuffer | Uint8Array | Blob

async function toUploadable(
  input: UploadableInput,
  fileName: string,
  mimeType: string
) {
  if (typeof File !== 'undefined') {
    if (input instanceof Blob) {
      return new File([input], fileName, { type: mimeType })
    }
    if (input instanceof ArrayBuffer) {
      return new File([input], fileName, { type: mimeType })
    }
    if (input instanceof Uint8Array) {
      return new File([input], fileName, { type: mimeType })
    }
  }
  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer()
    return { name: fileName, type: mimeType, data: new Uint8Array(buffer) }
  }
  if (input instanceof ArrayBuffer) {
    return { name: fileName, type: mimeType, data: new Uint8Array(input) }
  }
  if (input instanceof Uint8Array) {
    return { name: fileName, type: mimeType, data: input }
  }
  throw new Error('Unsupported audio payload for transcription')
}

export async function transcribeAudio(
  data: UploadableInput,
  options?: TranscriptionOptions
): Promise<string> {
  const client = getOpenAIClient()
  const mimeType = options?.mimeType ?? 'audio/ogg'
  const fileName = options?.fileName ?? `audio.${mimeType.split('/')[1] ?? 'ogg'}`
  const uploadable = await toUploadable(data, fileName, mimeType)
  const response = await client.audio.transcriptions.create({
    file: uploadable as any,
    model: options?.model ?? 'gpt-4o-mini-transcribe',
    language: options?.language ?? 'es',
    response_format: 'text',
  })
  const text = (response as any).text || ''
  if (!text.trim()) {
    throw new Error('Whisper transcription returned empty result')
  }
  return text.trim()
}
