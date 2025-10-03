import { downloadWhatsAppMedia } from './whatsapp-media'
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
