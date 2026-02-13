import type { TextPathway } from './memory-policy'
import type { LocaleStyleResolution } from './locale-style-resolver'
import { SOUL_BASE } from './soul-template'
import { getSoulStyle, isSoulEnabled, isSoulLocalStyleEnabled } from './soul-policy'

type ComposeSoulPromptParams = {
  pathway: TextPathway
  userMessage: string
  useShortPrompt: boolean
  memoryContext: string
  recallQuestion: boolean
  profileSummary: string
  localeStyle: LocaleStyleResolution
  nowIsoUtc: string
  nowBogotaText: string
}

function resolveStyleDirective(): string {
  const style = getSoulStyle()
  if (style === 'executive') {
    return 'Mantén un tono sobrio, directo y orientado a resultados.'
  }
  if (style === 'warm_professional') {
    return 'Mantén un tono cálido profesional, cercano y claro.'
  }
  return 'Mantén un tono de amigo cercano: humano, empático y práctico.'
}

function resolveLocalDirective(localeStyle: LocaleStyleResolution): string {
  if (!isSoulLocalStyleEnabled()) return ''
  if (localeStyle.city === 'unknown' || localeStyle.confidence < 0.72) {
    return 'No hay ciudad confirmada con alta confianza. Mantén español colombiano neutro-cercano.'
  }

  if (localeStyle.city === 'barranquilla') {
    return 'Usuario con señales de Barranquilla: adopta estilo caribe expresivo, cálido y alegre sin caricaturizar.'
  }
  if (localeStyle.city === 'bogota') {
    return 'Usuario con señales de Bogotá: adopta estilo claro, práctico y cordial.'
  }
  return 'Usuario con señales de Medellín: adopta estilo cercano, colaborativo y directo-amable.'
}

export function composeSoulSystemPrompt(params: ComposeSoulPromptParams): string {
  const timeContext = `# CURRENT TIME CONTEXT
UTC: ${params.nowIsoUtc}
Bogotá (UTC-5): ${params.nowBogotaText}
Usa zona horaria America/Bogota para fechas relativas (hoy, mañana, en 2 horas).`

  const operationalRules = `# OPERATIONAL RULES
- Responde al mensaje real del usuario, no a una plantilla.
- Sé breve y útil (ideal 2-5 frases, máximo 1200 caracteres).
- Evita repetir saludos dentro de una conversación activa.
- Si usas una herramienta, confirma con un mensaje claro.
- Pathway actual: ${params.pathway}.`

  const memoryContract = params.recallQuestion
    ? '# MEMORY CONTRACT\nSi el usuario pregunta por memoria/historial, responde con lo que sí sabes por conversación, perfil y memoria. No digas que no tienes historial cuando sí hay contexto.'
    : ''

  const localDirective = resolveLocalDirective(params.localeStyle)
  const soulEnabledDirective = isSoulEnabled()
    ? SOUL_BASE
    : 'SOUL desactivado: mantén tono profesional, claro y humano.'

  const profileDirective = params.profileSummary
    ? `# USER PROFILE SUMMARY\n${params.profileSummary}`
    : '# USER PROFILE SUMMARY\nNo hay perfil estable aún. Haz una pregunta útil para personalizar mejor.'

  const brevityRule = params.useShortPrompt
    ? 'Mensaje de usuario corto: responde aún más directo y natural.'
    : 'Mensaje de usuario con más contexto: responde útil y personalizado.'

  return [
    timeContext,
    soulEnabledDirective,
    `# STYLE DIRECTIVE\n${resolveStyleDirective()}`,
    `# LOCAL STYLE\n${localDirective || 'Aplica estilo base sin regionalismo fuerte.'}`,
    operationalRules,
    profileDirective,
    params.memoryContext,
    `# TURN DIRECTIVE\n${brevityRule}\nMensaje actual: ${params.userMessage}`,
    memoryContract,
  ]
    .filter((block) => block && block.trim().length > 0)
    .join('\n\n')
}
