import { getSupabaseServerClient } from './supabase'

const AUDIO_BUCKET = 'audio-files'

const EXTENSIONS: Record<string, string> = {
  'audio/ogg': 'ogg',
  'audio/ogg; codecs=opus': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/aac': 'aac',
}

export function extensionFromMime(mimeType?: string | null): string {
  if (!mimeType) return 'bin'
  return EXTENSIONS[mimeType.toLowerCase()] ?? mimeType.split('/')[1]?.split(';')[0] ?? 'bin'
}

export async function saveAudioToStorage(
  userId: string,
  mediaId: string,
  bytes: Uint8Array,
  mimeType?: string
) {
  const supabase = getSupabaseServerClient()
  const extension = extensionFromMime(mimeType)
  const path = `${userId}/${mediaId}.${extension}`
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, body, {
      contentType: mimeType ?? 'application/octet-stream',
      upsert: true,
    })
  if (error) {
    throw error
  }
  return {
    bucket: AUDIO_BUCKET,
    path,
    extension,
    storageUri: `storage://${AUDIO_BUCKET}/${path}`,
  }
}
