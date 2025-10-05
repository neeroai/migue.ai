/**
 * Groq Audio Transcription Client - Best Practices 2025
 * 89-92% cheaper than OpenAI Whisper
 *
 * Pricing (Jan 2025):
 * - Groq Whisper Large V3: $0.03/hour
 * - Groq Whisper Large V3 Turbo: $0.04/hour (216x real-time speed)
 * - OpenAI Whisper: $0.36/hour
 *
 * Best practices:
 * - Supply language hint (ISO-639-1) for better accuracy + latency
 * - Use verbose_json for quality monitoring metadata
 * - Audio is auto-downsampled to 16KHz mono (optimal for speech)
 * - 25MB file limit (use URL parameter if larger)
 * - Batch processing available for 50% discount
 */

import Groq from 'groq-sdk'
import { logger } from './logger'

export type GroqTranscriptionOptions = {
  model?: 'whisper-large-v3' | 'whisper-large-v3-turbo' | 'distil-whisper-large-v3-en'
  language?: string // ISO-639-1 code (e.g., 'es', 'en', 'fr')
  temperature?: number
  responseFormat?: 'json' | 'text' | 'verbose_json'
}

/**
 * Transcribe audio using Groq Whisper API
 * Best practice: Use whisper-large-v3-turbo for 216x real-time speed
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
    const model = options?.model || 'whisper-large-v3-turbo' // Best practice: use turbo
    const language = options?.language || 'es' // ISO-639-1 code improves accuracy
    const responseFormat = options?.responseFormat || 'verbose_json' // Best practice: get metadata

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model,
      language, // Improves accuracy and latency
      temperature: options?.temperature || 0.0,
      response_format: responseFormat,
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

    // Log quality metrics (verbose_json metadata)
    if (responseFormat === 'verbose_json' && typeof transcription === 'object') {
      const metadata = transcription as any
      logger.info('Groq transcription with quality metrics', {
        metadata: {
          model,
          language,
          textLength: text.length,
          duration: metadata.duration || null,
          // Quality indicators
          avg_logprob: metadata.avg_logprob || null, // Lower is better (more negative = worse)
          compression_ratio: metadata.compression_ratio || null, // ~1.5-3.0 is good
          no_speech_prob: metadata.no_speech_prob || null, // High value = likely silence
        },
      })

      // Warn if quality issues detected
      if (metadata.avg_logprob && metadata.avg_logprob < -0.8) {
        logger.warn('Low transcription confidence detected', {
          metadata: { avg_logprob: metadata.avg_logprob }
        })
      }

      if (metadata.no_speech_prob && metadata.no_speech_prob > 0.6) {
        logger.warn('Possible silence or non-speech audio detected', {
          metadata: { no_speech_prob: metadata.no_speech_prob }
        })
      }
    } else {
      logger.info('Groq transcription successful', {
        metadata: {
          model,
          language,
          textLength: text.length,
        },
      })
    }

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
 * Estimate transcription cost (Groq pricing - Jan 2025)
 * - whisper-large-v3: $0.03 per hour
 * - whisper-large-v3-turbo: $0.04 per hour (216x real-time speed)
 * - Batch processing: 50% discount
 */
export function estimateGroqCost(
  durationSeconds: number,
  model: 'whisper-large-v3' | 'whisper-large-v3-turbo' = 'whisper-large-v3-turbo',
  batch = false
): number {
  const hours = durationSeconds / 3600

  // Pricing per model
  const pricing = {
    'whisper-large-v3': 0.03,
    'whisper-large-v3-turbo': 0.04,
  }

  let cost = hours * pricing[model]

  // Apply batch discount
  if (batch) {
    cost *= 0.5 // 50% discount
  }

  return cost
}

/**
 * Batch transcription for 50% discount
 * TODO: Implement when Groq batch API is available
 */
export async function transcribeAudioBatch(
  audioFiles: File[],
  options?: GroqTranscriptionOptions
): Promise<string[]> {
  // For now, process sequentially
  // In future, use Groq batch API for 50% discount
  const results: string[] = []

  for (const file of audioFiles) {
    const text = await transcribeWithGroq(file, options)
    results.push(text)
  }

  logger.info('Batch transcription completed', {
    metadata: { count: audioFiles.length }
  })

  return results
}
