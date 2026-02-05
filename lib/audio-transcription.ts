/**
 * @file audio-transcription.ts
 * @description OpenAI Whisper audio transcription service
 * @module lib
 * @exports transcribeAudio, TranscriptionOptions
 * @date 2026-02-05 12:15
 * @updated 2026-02-05 12:15
 */

import OpenAI from 'openai'

let cachedClient: OpenAI | null = null

/**
 * Get OpenAI client singleton
 * Only used for Whisper audio transcription (no Vercel AI SDK alternative)
 */
function getOpenAIClient(): OpenAI {
  if (!cachedClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    cachedClient = new OpenAI({
      apiKey,
      timeout: 30000,
      maxRetries: 2,
    })
  }
  return cachedClient
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

/**
 * Transcribe audio using OpenAI Whisper
 * Cost: $0.36/hour
 *
 * Note: Direct OpenAI SDK usage justified - Whisper not available in Vercel AI SDK
 */
export async function transcribeAudio(
  data: UploadableInput,
  options?: TranscriptionOptions
): Promise<string> {
  const client = getOpenAIClient()
  const mimeType = options?.mimeType ?? 'audio/ogg'

  const parts = mimeType.split('/')
  const extension = parts[1] ?? 'ogg'
  const fileName = options?.fileName ?? `audio.${extension}`

  const uploadable = await toUploadable(data, fileName, mimeType)
  const response = await client.audio.transcriptions.create({
    file: uploadable,
    model: options?.model ?? 'whisper-1',
    language: options?.language ?? 'es',
    response_format: 'text',
  })

  if (typeof response === 'string') {
    const text = response.trim()
    if (!text) {
      throw new Error('Whisper transcription returned empty result')
    }
    return text
  }

  throw new Error('Unexpected transcription response format')
}
