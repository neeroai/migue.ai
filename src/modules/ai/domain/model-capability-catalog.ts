export type Provider = 'openai' | 'gemini'

export type TaskProfile =
  | 'default_chat'
  | 'tool_execution'
  | 'long_context'
  | 'rich_vision'

export type Capability = {
  provider: Provider
  modelName: string
  maxTokens: number
  contextWindow: number
  costPer1MTokens: { input: number; output: number }
  toolCalling: boolean
  vision: boolean
  bestFor: TaskProfile[]
}

export const MODEL_CAPABILITY_CATALOG_VERSION = 'v1.0.0'

export const MODEL_CAPABILITIES: Record<string, Capability> = {
  'openai/gpt-4o-mini': {
    provider: 'openai',
    modelName: 'openai/gpt-4o-mini',
    maxTokens: 4000,
    contextWindow: 128_000,
    costPer1MTokens: { input: 0.15, output: 0.60 },
    toolCalling: true,
    vision: true,
    bestFor: ['default_chat', 'tool_execution', 'rich_vision'],
  },
  'google/gemini-2.5-flash-lite': {
    provider: 'gemini',
    modelName: 'google/gemini-2.5-flash-lite',
    maxTokens: 4000,
    contextWindow: 1_000_000,
    costPer1MTokens: { input: 0.10, output: 0.40 },
    toolCalling: true,
    vision: true,
    bestFor: ['default_chat', 'long_context', 'rich_vision'],
  },
}

export const ROUTING_PROFILE_PRIORITY: Record<TaskProfile, string[]> = {
  default_chat: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash-lite'],
  tool_execution: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash-lite'],
  long_context: ['google/gemini-2.5-flash-lite', 'openai/gpt-4o-mini'],
  rich_vision: ['openai/gpt-4o-mini', 'google/gemini-2.5-flash-lite'],
}

export function getCapability(modelName: string): Capability | null {
  return MODEL_CAPABILITIES[modelName] ?? null
}

export function getRoutingPriority(profile: TaskProfile): Capability[] {
  const ordered = ROUTING_PROFILE_PRIORITY[profile] ?? ROUTING_PROFILE_PRIORITY.default_chat
  return ordered
    .map(name => MODEL_CAPABILITIES[name])
    .filter((capability): capability is Capability => !!capability)
}
