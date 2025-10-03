const GRAPH_BASE_URL = 'https://graph.facebook.com/v19.0'

export type WhatsAppMediaDownload = {
  bytes: Uint8Array
  mimeType: string
}

async function fetchGraphResource(path: string, token: string) {
  const url = `${GRAPH_BASE_URL}/${path}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`WhatsApp media fetch failed with ${res.status}`)
  }
  return res
}

function asUint8Array(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

export async function resolveMediaUrl(mediaId: string, token: string) {
  const res = await fetchGraphResource(mediaId, token)
  const body = (await res.json()) as { url?: string; mime_type?: string }
  if (!body?.url) {
    throw new Error('WhatsApp media metadata missing url')
  }
  return { url: body.url, mimeType: body.mime_type }
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<WhatsAppMediaDownload> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    throw new Error('WHATSAPP_TOKEN is not configured')
  }
  const { url, mimeType } = await resolveMediaUrl(mediaId, token)
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!mediaRes.ok) {
    throw new Error(`WhatsApp media content fetch failed with ${mediaRes.status}`)
  }
  const buffer = await mediaRes.arrayBuffer()
  const contentType = mediaRes.headers.get('content-type') ?? mimeType ?? 'application/octet-stream'
  return { bytes: asUint8Array(buffer), mimeType: contentType }
}
