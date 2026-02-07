/**
 * @file gateway.ts
 * @description AI Gateway health utilities
 * @module lib/ai
 * @exports isProviderHealthy, getHealthyProviders
 * @date 2026-02-02 10:50
 * @updated 2026-02-02 10:50
 */

export function isProviderHealthy(): boolean {
  return !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_OIDC_TOKEN
}

/**
 * Get AI Gateway health status
 */
export function getHealthyProviders(): Array<'gateway'> {
  return isProviderHealthy() ? ['gateway'] : []
}
