/**
 * Audio Transcription - DEPRECATED
 *
 * ⚠️ IMPORTANT: This module is deprecated in favor of direct Groq integration.
 * Use transcribeWithGroq() from groq-client.ts instead (93% cost savings).
 *
 * Cost comparison:
 * - Groq Whisper: $0.05/hour (RECOMMENDED)
 * - OpenAI Whisper: $0.36/hour (FALLBACK via this module)
 *
 * This file is kept for backwards compatibility during migration.
 * Will be removed in Phase 3 (Oct 20, 2025).
 *
 * @deprecated Use transcribeWithGroq() from groq-client.ts directly
 */

import { downloadWhatsAppMedia } from './whatsapp'
import { saveAudioToStorage } from './storage'
import { transcribeAudio } from './openai'

export type AudioTranscriptionDeps = {
  downloadMedia: typeof downloadWhatsAppMedia
  saveAudio: typeof saveAudioToStorage
  runTranscription: typeof transcribeAudio
}

export type AudioTranscriptionResult = {
  transcript: string
  storageUri: string
  mimeType: string
}

const DEFAULT_DEPS: AudioTranscriptionDeps = {
  downloadMedia: downloadWhatsAppMedia,
  saveAudio: saveAudioToStorage,
  runTranscription: transcribeAudio,
}

const DEFAULT_LANGUAGE = 'es'

/**
 * @deprecated Use transcribeWithGroq() from groq-client.ts (93% cheaper)
 */
export async function transcribeWhatsAppAudio(
  mediaId: string,
  userId: string,
  overrides?: Partial<AudioTranscriptionDeps>
): Promise<AudioTranscriptionResult> {
  const deps = { ...DEFAULT_DEPS, ...overrides }
  const media = await deps.downloadMedia(mediaId)
  const bytes = media.bytes instanceof Uint8Array ? media.bytes : new Uint8Array(media.bytes)
  const saved = await deps.saveAudio(userId, mediaId, bytes, media.mimeType)
  const transcript = await deps.runTranscription(bytes, {
    mimeType: media.mimeType,
    fileName: `${mediaId}.${saved.extension}`,
    language: DEFAULT_LANGUAGE,
  })
  return {
    transcript,
    storageUri: saved.storageUri,
    mimeType: media.mimeType,
  }
}
