/**
 * @file Agent Events Processor Cron
 * @description Drains pending agent_events and records runs/steps in ledger.
 */

export const runtime = 'edge'
export const maxDuration = 10

import { getEnv } from '../../../../src/shared/config/env'
import { logger } from '../../../../src/shared/observability/logger'
import { processPendingAgentEvents } from '../../../../src/modules/agent/application/event-processor'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

function getRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(req: Request): Promise<Response> {
  const requestId = getRequestId()
  const env = getEnv()

  const userAgent = req.headers.get('user-agent')
  const isVercelCron = userAgent?.startsWith('vercel-cron/')

  if (!isVercelCron) {
    if (!env.CRON_SECRET) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
  }

  if (env.AGENT_EVENT_LEDGER_ENABLED !== 'true') {
    return jsonResponse({
      skipped: true,
      reason: 'AGENT_EVENT_LEDGER_ENABLED is not true',
      request_id: requestId,
    })
  }

  try {
    const limitParam = new URL(req.url).searchParams.get('limit')
    const parsedLimit = limitParam ? Number(limitParam) : undefined
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : undefined

    const summary = await processPendingAgentEvents({
      requestId,
      ...(limit !== undefined ? { limit } : {}),
    })

    logger.info('[agent-cron] Batch processed', {
      requestId,
      metadata: { ...summary },
    })

    return jsonResponse({
      success: true,
      request_id: requestId,
      ...summary,
    })
  } catch (error: any) {
    logger.error('[agent-cron] Processing failed', error instanceof Error ? error : new Error(String(error)), {
      requestId,
    })

    return jsonResponse({
      success: false,
      request_id: requestId,
      error: error?.message ?? 'unknown error',
    }, 500)
  }
}
