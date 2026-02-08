/**
 * @file Agent Feature Flags
 * @description Lightweight runtime flags for progressive rollout.
 */

function parseBoolEnv(raw: string | undefined): boolean {
  if (!raw) return false
  const normalized = raw.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

export function isAgentEventLedgerEnabled(): boolean {
  return parseBoolEnv(process.env.AGENT_EVENT_LEDGER_ENABLED)
}

export const _testOnly = {
  parseBoolEnv,
}
