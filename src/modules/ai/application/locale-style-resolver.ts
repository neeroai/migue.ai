import type { LocaleEmojiPolicy } from './soul-policy'

export type SupportedCity = 'barranquilla' | 'bogota' | 'medellin' | 'unknown'

export type LocaleStyleResolution = {
  city: SupportedCity
  confidence: number
  variant: 'caribe_expresivo' | 'rolo_practico' | 'paisa_cercano' | 'base'
  emojiPolicy: LocaleEmojiPolicy
}

type ResolveLocaleParams = {
  userMessage: string
  historySnippets?: string[]
}

const CITY_SIGNAL_MAP: Record<Exclude<SupportedCity, 'unknown'>, string[]> = {
  barranquilla: [
    'barranquilla',
    'quilla',
    'curramba',
    'soledad',
    'malec',
    'junior',
    'transmetro',
    'carnaval',
    'barranquillero',
  ],
  bogota: [
    'bogota',
    'bogotá',
    'rolo',
    'chapinero',
    'usaquen',
    'transmilenio',
    'ciclovia',
    'monserrate',
    'cachaco',
  ],
  medellin: [
    'medellin',
    'medellín',
    'medallo',
    'paisa',
    'envigado',
    'poblado',
    'sabaneta',
    'metrocable',
    'antioquia',
  ],
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function scoreCity(text: string, city: Exclude<SupportedCity, 'unknown'>): number {
  const normalized = normalize(text)
  let score = 0

  if (normalized.includes(city)) score += 0.65
  const signals = CITY_SIGNAL_MAP[city]
  for (const signal of signals) {
    if (normalized.includes(normalize(signal))) {
      score += 0.12
    }
  }

  return Math.min(1, score)
}

function resolveVariant(city: SupportedCity): LocaleStyleResolution['variant'] {
  if (city === 'barranquilla') return 'caribe_expresivo'
  if (city === 'bogota') return 'rolo_practico'
  if (city === 'medellin') return 'paisa_cercano'
  return 'base'
}

export function resolveLocaleStyle(params: ResolveLocaleParams): LocaleStyleResolution {
  const corpus = [params.userMessage, ...(params.historySnippets ?? [])].join('\n')

  const barranquillaScore = scoreCity(corpus, 'barranquilla')
  const bogotaScore = scoreCity(corpus, 'bogota')
  const medellinScore = scoreCity(corpus, 'medellin')

  const scored: Array<{ city: Exclude<SupportedCity, 'unknown'>; score: number }> = [
    { city: 'barranquilla', score: barranquillaScore },
    { city: 'bogota', score: bogotaScore },
    { city: 'medellin', score: medellinScore },
  ]
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  const second = scored[1]
  if (!best || !second || best.score < 0.45 || best.score - second.score < 0.1) {
    return {
      city: 'unknown',
      confidence: Math.max(0, best?.score ?? 0),
      variant: 'base',
      emojiPolicy: 'natural',
    }
  }

  return {
    city: best.city,
    confidence: Number(best.score.toFixed(2)),
    variant: resolveVariant(best.city),
    emojiPolicy: 'natural',
  }
}
