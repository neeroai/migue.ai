export function normalizePhoneNumber(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return trimmed

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return trimmed

  return `+${digits}`
}

