import { hasToolIntent } from '../../ai/domain/intent'
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
  if (normalized.type === 'sticker') {
    return {
      inputClass: 'STICKER_STANDBY',
      reason: 'sticker processing is disabled by policy',
    }
  }

  if (normalized.type === 'text') {
    if (hasToolIntent(normalized.content)) {
      return { inputClass: 'TEXT_TOOL_INTENT', reason: 'tool intent detected in text' }
    }
    return { inputClass: 'TEXT_SIMPLE', reason: 'plain text conversation' }
  }

  if (RICH_INPUT_TYPES.has(normalized.type)) {
    if (hasToolIntent(normalized.content)) {
      return { inputClass: 'RICH_INPUT_TOOL_INTENT', reason: 'rich input with tool hint in caption/context' }
    }
    return { inputClass: 'RICH_INPUT', reason: 'rich media requires delegated processing' }
  }

  if (UNSUPPORTED_TYPES.has(normalized.type)) {
    return { inputClass: 'UNSUPPORTED', reason: `unsupported type: ${normalized.type}` }
  }

  return { inputClass: 'UNSUPPORTED', reason: `unsupported type: ${normalized.type}` }
}
