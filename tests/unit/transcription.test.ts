import { describe, it, expect, jest } from '@jest/globals'
import { transcribeWhatsAppAudio } from '../../lib/transcription'
import type { AudioTranscriptionDeps } from '../../lib/transcription'

const buildDeps = () => {
  const downloadMedia = jest.fn().mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: 'audio/ogg',
  })
  const saveAudio = jest.fn().mockResolvedValue({
    bucket: 'audio-files',
    path: 'user-123/media-456.ogg',
    extension: 'ogg',
    storageUri: 'storage://audio-files/user-123/media-456.ogg',
  })
  const runTranscription = jest.fn().mockResolvedValue('hola mundo')
  return { downloadMedia, saveAudio, runTranscription } as unknown as AudioTranscriptionDeps
}

describe('transcribeWhatsAppAudio', () => {
  it('pipes media through download, storage, and transcription', async () => {
    const deps = buildDeps()
    const result = await transcribeWhatsAppAudio('media-456', 'user-123', deps)

    expect(deps.downloadMedia).toHaveBeenCalledWith('media-456')
    expect(deps.saveAudio).toHaveBeenCalledWith('user-123', 'media-456', expect.any(Uint8Array), 'audio/ogg')
    expect(deps.runTranscription).toHaveBeenCalledWith(expect.any(Uint8Array), {
      mimeType: 'audio/ogg',
      fileName: 'media-456.ogg',
      language: 'es',
    })
    expect(result).toEqual({
      transcript: 'hola mundo',
      storageUri: 'storage://audio-files/user-123/media-456.ogg',
      mimeType: 'audio/ogg',
    })
  })

  it('bubbles up transcription failures', async () => {
    const deps = buildDeps()
    deps.runTranscription = jest.fn().mockRejectedValue(new Error('timeout')) as any

    await expect(transcribeWhatsAppAudio('media-789', 'user-789', deps)).rejects.toThrow('timeout')
  })
})
