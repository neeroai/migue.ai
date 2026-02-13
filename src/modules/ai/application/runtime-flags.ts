export function parseBoolEnv(value: string | undefined): boolean {
  if (!value) return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

/**
 * Legacy routing keeps regex-driven intent shortcuts in router/agent.
 * Default false to prioritize LLM-first behavior.
 */
export function isLegacyRoutingEnabled(): boolean {
  return parseBoolEnv(process.env.LEGACY_ROUTING_ENABLED)
}

/**
 * Enables web search tool exposure in agent runtime.
 * Default true to keep live internet retrieval enabled.
 * Set WEB_SEARCH_ENABLED=false to disable quickly.
 */
export function isWebSearchEnabled(): boolean {
  const rawValue = process.env.WEB_SEARCH_ENABLED
  if (rawValue === undefined) return true
  return parseBoolEnv(rawValue)
}

export const _testOnly = {
  parseBoolEnv,
}
