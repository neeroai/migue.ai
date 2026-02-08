export type TextPathway = 'default' | 'text_fast_path' | 'tool_intent' | 'rich_input'

export type MemoryReadPolicy = {
  historyLimit: number
  semanticEnabled: boolean
  semanticTopK: number
  semanticThreshold: number
  includeProfile: boolean
}

const POLICY_BY_PATHWAY: Record<TextPathway, MemoryReadPolicy> = {
  default: {
    historyLimit: 12,
    semanticEnabled: true,
    semanticTopK: 3,
    semanticThreshold: 0.35,
    includeProfile: true,
  },
  text_fast_path: {
    historyLimit: 8,
    semanticEnabled: false,
    semanticTopK: 0,
    semanticThreshold: 0.4,
    includeProfile: true,
  },
  tool_intent: {
    historyLimit: 12,
    semanticEnabled: true,
    semanticTopK: 3,
    semanticThreshold: 0.35,
    includeProfile: true,
  },
  rich_input: {
    historyLimit: 8,
    semanticEnabled: false,
    semanticTopK: 0,
    semanticThreshold: 0.4,
    includeProfile: true,
  },
}

export function resolveMemoryReadPolicy(pathway: TextPathway): MemoryReadPolicy {
  return POLICY_BY_PATHWAY[pathway] ?? POLICY_BY_PATHWAY.default
}

export function isMemoryRecallQuestion(message: string): boolean {
  const normalized = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return /(que sabes de mi|que recuerdas de mi|que mensajes te he enviado|mi historial|nuestras interacciones)/i.test(
    normalized
  )
}

export function shouldWriteMemory(
  userMessage: string,
  hasPersonalFact: boolean,
  toolCalls: number
): boolean {
  const normalized = userMessage.trim().toLowerCase()

  // Ignore ephemeral acknowledgements.
  if (/^(ok|listo|dale|gracias|perfecto|👍|👌|✅)$/i.test(normalized)) {
    return false
  }

  if (toolCalls > 0) return true
  return hasPersonalFact
}

export function sanitizeMemoryContractResponse(
  text: string,
  hasContext: boolean,
  summary: string
): string {
  const lower = text.toLowerCase()
  const deniesHistory =
    lower.includes('no tengo acceso al historial') ||
    lower.includes('no puedo ver mensajes anteriores') ||
    lower.includes('no tengo historial') ||
    lower.includes('no tengo acceso a los mensajes anteriores')

  if (!hasContext || !deniesHistory) {
    return text
  }

  const safeSummary = summary.trim() || 'sí tengo contexto reciente y preferencias guardadas.'
  return `Sí tengo contexto de nuestra conversación. ${safeSummary}`.trim()
}
