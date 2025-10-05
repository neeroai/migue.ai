/**
 * Groq Audio Transcription Client
 * 93% cheaper than OpenAI Whisper ($0.05/hr vs $0.006/min = $0.36/hr)
 *
 * Groq Whisper models:
 * - whisper-large-v3: Best quality, multilingual
 * - distil-whisper-large-v3-en: Faster, English only
 */

import Groq from 'groq-sdk'
import { logger } from './logger'

export type GroqTranscriptionOptions = {
  model?: 'whisper-large-v3' | 'distil-whisper-large-v3-en'
  language?: string
  temperature?: number
  responseFormat?: 'json' | 'text' | 'verbose_json'
}

/**
 * Transcribe audio using Groq Whisper API
 * Cost: ~$0.05/hour (vs OpenAI $0.36/hour)
 */
export async function transcribeWithGroq(
  audioFile: File,
  options?: GroqTranscriptionOptions
): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY

  if (!groqKey) {
    throw new Error('GROQ_API_KEY not configured')
  }

  const groq = new Groq({ apiKey: groqKey })

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: options?.model || 'whisper-large-v3',
      language: options?.language || 'es', // Spanish by default
      temperature: options?.temperature || 0.0,
      response_format: options?.responseFormat || 'text',
    })

    // Extract text from response
    let text: string
    if (typeof transcription === 'string') {
      text = transcription
    } else if ('text' in transcription) {
      text = transcription.text
    } else {
      throw new Error('Unexpected Groq response format')
    }

    if (!text.trim()) {
      throw new Error('Groq returned empty transcription')
    }

    logger.info('Groq transcription successful', {
      metadata: {
        model: options?.model || 'whisper-large-v3',
        textLength: text.length,
      },
    })

    return text.trim()
  } catch (error: any) {
    logger.error('Groq transcription failed', error, {
      metadata: { model: options?.model },
    })
    throw error
  }
}

/**
 * Convert audio buffer to File for Groq API
 */
export function bufferToFile(
  buffer: Buffer | Uint8Array,
  filename: string,
  mimeType: string
): File {
  // Convert to plain array to ensure compatibility with Blob
  const array = Array.from(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer)
  const blob = new Blob([new Uint8Array(array)], { type: mimeType })
  return new File([blob], filename, { type: mimeType })
}

/**
 * Estimate transcription cost (Groq pricing)
 * $0.05 per hour of audio
 */
export function estimateGroqCost(durationSeconds: number): number {
  const hours = durationSeconds / 3600
  return hours * 0.05
}
