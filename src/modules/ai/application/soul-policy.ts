export type SoulStyle = 'friend_close' | 'warm_professional' | 'executive'

export type LocaleEmojiPolicy = 'low' | 'natural' | 'high'

function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value || value.trim().length === 0) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parseSoulStyle(value: string | undefined): SoulStyle {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'warm_professional') return 'warm_professional'
  if (normalized === 'executive') return 'executive'
  return 'friend_close'
}

export function isSoulEnabled(): boolean {
  return parseBoolEnv(process.env.SOUL_ENABLED, true)
}

export function isSoulStrictGuardrailsEnabled(): boolean {
  return parseBoolEnv(process.env.SOUL_STRICT_GUARDRAILS, true)
}

export function isSoulLocalStyleEnabled(): boolean {
  return parseBoolEnv(process.env.SOUL_LOCAL_STYLE_ENABLED, true)
}

export function getSoulStyle(): SoulStyle {
  return parseSoulStyle(process.env.SOUL_STYLE)
}

export function resolveEmojiLimit(policy: LocaleEmojiPolicy): number {
  if (policy === 'low') return 1
  if (policy === 'high') return 4
  return 2
}

export function enforceEmojiLimit(text: string, limit: number): string {
  if (limit <= 0) return text.replace(/\p{Extended_Pictographic}/gu, '').trim()
  const emojiMatches = Array.from(text.matchAll(/\p{Extended_Pictographic}/gu))
  if (emojiMatches.length <= limit) return text

  let kept = 0
  return text.replace(/\p{Extended_Pictographic}/gu, (match) => {
    kept += 1
    return kept <= limit ? match : ''
  }).replace(/\s{2,}/g, ' ').trim()
}

export function rewriteRoboticFallback(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return 'Te leo. ¿Qué hacemos ahora?'

  const roboticPatterns = [
    /estoy aqui para ayudarte/gi,
    /en que te puedo ayudar hoy\??/gi,
    /como asistente virtual/gi,
    /no puedo ayudarte con eso/gi,
  ]

  const hasRoboticPattern = roboticPatterns.some((pattern) => pattern.test(trimmed))
  if (!hasRoboticPattern) return trimmed

  return trimmed
    .replace(/estoy aqui para ayudarte/gi, 'te acompaño en esto')
    .replace(/en que te puedo ayudar hoy\??/gi, '¿qué necesitas ahora mismo?')
    .replace(/como asistente virtual/gi, 'como tu asistente')
    .replace(/no puedo ayudarte con eso/gi, 'ahora no me da para resolverlo directo, pero te propongo otra vía')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
