import { hasToolIntent } from '../../ai/domain/intent'
import { isLegacyRoutingEnabled } from '../../ai/application/runtime-flags'
import type { NormalizedMessage } from '../domain/message-normalization'

export type InputClass =
  | 'TEXT_SIMPLE'
  | 'TEXT_TOOL_INTENT'
  | 'RICH_INPUT'
  | 'RICH_INPUT_TOOL_INTENT'
  | 'STICKER_STANDBY'
  | 'UNSUPPORTED'

export type RoutedInput = {
  inputClass: InputClass
  reason: string
}

const RICH_INPUT_TYPES = new Set(['audio', 'image', 'document'])
const UNSUPPORTED_TYPES = new Set(['video', 'location'])

export function classifyInput(normalized: NormalizedMessage): RoutedInput {
  const legacyRouting = isLegacyRoutingEnabled()

  if (normalized.type === 'sticker') {
    return {
      inputClass: 'STICKER_STANDBY',
      reason: 'sticker processing is disabled by policy',
    }
  }

  if (normalized.type === 'text') {
    if (legacyRouting && hasToolIntent(normalized.content)) {
      return { inputClass: 'TEXT_TOOL_INTENT', reason: 'tool intent detected in text' }
    }
    return {
      inputClass: 'TEXT_SIMPLE',
      reason: legacyRouting ? 'plain text conversation' : 'llm-first text routing (legacy intent split disabled)',
    }
  }

  if (RICH_INPUT_TYPES.has(normalized.type)) {
    if (legacyRouting && hasToolIntent(normalized.content)) {
      return { inputClass: 'RICH_INPUT_TOOL_INTENT', reason: 'rich input with tool hint in caption/context' }
    }
    return {
      inputClass: 'RICH_INPUT',
      reason: legacyRouting
        ? 'rich media requires delegated processing'
        : 'llm-first rich routing (legacy tool-intent split disabled)',
    }
  }

  if (UNSUPPORTED_TYPES.has(normalized.type)) {
    return { inputClass: 'UNSUPPORTED', reason: `unsupported type: ${normalized.type}` }
  }

  return { inputClass: 'UNSUPPORTED', reason: `unsupported type: ${normalized.type}` }
}
