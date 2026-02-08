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

export const _testOnly = {
  parseBoolEnv,
}
