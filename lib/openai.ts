import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

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

/**
 * Chat message type (compatible with OpenAI SDK v5)
 * Uses OpenAI's native type for better compatibility
 */
export type ChatMessage = ChatCompletionMessageParam

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
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
  })

  // Validate array access with noUncheckedIndexedAccess
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
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 500,
    stream: true,
  })

  let fullText = ''
  for await (const chunk of stream) {
    // Use optional chaining for array access
    const choice = chunk.choices?.[0]
    if (choice?.delta?.content) {
      const delta = choice.delta.content
      // OpenAI SDK v5 returns string for delta.content
      if (typeof delta === 'string') {
        fullText += delta
      }
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

/**
 * Convert input to File for OpenAI SDK
 * Edge Runtime always has File available
 */
async function toUploadable(
  input: UploadableInput,
  fileName: string,
  mimeType: string
): Promise<File> {
  // Convert all inputs to File (always available in Edge Runtime)
  if (input instanceof Blob) {
    return new File([input], fileName, { type: mimeType })
  }
  if (input instanceof ArrayBuffer) {
    return new File([input as BlobPart], fileName, { type: mimeType })
  }
  if (input instanceof Uint8Array) {
    return new File([input as BlobPart], fileName, { type: mimeType })
  }
  throw new Error('Unsupported audio payload for transcription')
}

export async function transcribeAudio(
  data: UploadableInput,
  options?: TranscriptionOptions
): Promise<string> {
  const client = getOpenAIClient()
  const mimeType = options?.mimeType ?? 'audio/ogg'

  // Safe array access for mime type extension
  const parts = mimeType.split('/')
  const extension = parts[1] ?? 'ogg'
  const fileName = options?.fileName ?? `audio.${extension}`

  const uploadable = await toUploadable(data, fileName, mimeType)
  const response = await client.audio.transcriptions.create({
    file: uploadable,
    model: options?.model ?? 'gpt-4o-mini-transcribe',
    language: options?.language ?? 'es',
    response_format: 'text',
  })

  // OpenAI SDK v5 returns string directly when response_format is 'text'
  if (typeof response === 'string') {
    const text = response.trim()
    if (!text) {
      throw new Error('Whisper transcription returned empty result')
    }
    return text
  }

  throw new Error('Unexpected transcription response format')
}
