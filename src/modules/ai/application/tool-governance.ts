import { logger } from '../../../shared/observability/logger'
import type { TextPathway } from './memory-policy'

export type ToolName =
  | 'create_reminder'
  | 'schedule_meeting'
  | 'track_expense'
  | 'web_search'
  | 'send_whatsapp_message'
  | 'memory_query'
  | 'memory_upsert'

export type ToolPolicyDecision = 'allow' | 'confirm' | 'deny'

type RiskLevel = 'low' | 'medium' | 'high'

type ToolContract = {
  toolName: ToolName
  schemaVersion: 'v1'
  riskLevel: RiskLevel
  timeoutMs: number
  retries: number
  idempotencyStrategy: 'none' | 'keyed'
}

export const TOOL_CATALOG: Record<ToolName, ToolContract> = {
  web_search: {
    toolName: 'web_search',
    schemaVersion: 'v1',
    riskLevel: 'low',
    timeoutMs: 6000,
    retries: 1,
    idempotencyStrategy: 'none',
  },
  send_whatsapp_message: {
    toolName: 'send_whatsapp_message',
    schemaVersion: 'v1',
    riskLevel: 'high',
    timeoutMs: 5000,
    retries: 2,
    idempotencyStrategy: 'keyed',
  },
  memory_query: {
    toolName: 'memory_query',
    schemaVersion: 'v1',
    riskLevel: 'low',
    timeoutMs: 2000,
    retries: 1,
    idempotencyStrategy: 'none',
  },
  memory_upsert: {
    toolName: 'memory_upsert',
    schemaVersion: 'v1',
    riskLevel: 'medium',
    timeoutMs: 2000,
    retries: 1,
    idempotencyStrategy: 'keyed',
  },
  create_reminder: {
    toolName: 'create_reminder',
    schemaVersion: 'v1',
    riskLevel: 'medium',
    timeoutMs: 5000,
    retries: 1,
    idempotencyStrategy: 'keyed',
  },
  schedule_meeting: {
    toolName: 'schedule_meeting',
    schemaVersion: 'v1',
    riskLevel: 'medium',
    timeoutMs: 5000,
    retries: 1,
    idempotencyStrategy: 'keyed',
  },
  track_expense: {
    toolName: 'track_expense',
    schemaVersion: 'v1',
    riskLevel: 'medium',
    timeoutMs: 5000,
    retries: 1,
    idempotencyStrategy: 'keyed',
  },
}

export type ToolPolicyContext = {
  userId: string
  pathway: TextPathway
  explicitConsent?: boolean
  allowlistedRecipient?: boolean
}

export type ToolPolicyResult = {
  decision: ToolPolicyDecision
  reason: string
  contract: ToolContract
}

export function evaluateToolPolicy(toolName: ToolName, context: ToolPolicyContext): ToolPolicyResult {
  const contract = TOOL_CATALOG[toolName]

  if (toolName === 'send_whatsapp_message') {
    if (!context.allowlistedRecipient) {
      return {
        decision: 'deny',
        reason: 'outbound destination not in allowlist',
        contract,
      }
    }
    if (!context.explicitConsent) {
      return {
        decision: 'confirm',
        reason: 'high-risk outbound messaging requires explicit confirmation',
        contract,
      }
    }
    return {
      decision: 'allow',
      reason: 'allowlisted destination with explicit confirmation',
      contract,
    }
  }

  if (context.pathway === 'rich_input' && contract.riskLevel !== 'low') {
    if (context.explicitConsent) {
      return {
        decision: 'allow',
        reason: 'explicit user consent provided for rich input tool execution',
        contract,
      }
    }
    return {
      decision: 'confirm',
      reason: 'medium/high risk tool inferred from rich input requires confirmation',
      contract,
    }
  }

  return {
    decision: 'allow',
    reason: 'policy default for current context',
    contract,
  }
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`tool timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    }),
  ])
}

export async function executeGovernedTool<TInput, TOutput>(params: {
  toolName: ToolName
  context: ToolPolicyContext
  input: TInput
  execute: (input: TInput) => Promise<TOutput>
}): Promise<
  | { status: 'ok'; output: TOutput; policy: ToolPolicyResult; attempts: number; latencyMs: number }
  | { status: 'blocked'; policy: ToolPolicyResult; userMessage: string }
  | { status: 'error'; policy: ToolPolicyResult; error: string; userMessage: string }
> {
  const policy = evaluateToolPolicy(params.toolName, params.context)

  if (policy.decision === 'deny') {
    logger.warn('[ToolPolicy] Tool denied', {
      userId: params.context.userId,
      metadata: { toolName: params.toolName, decision: policy.decision, reason: policy.reason },
    })
    return {
      status: 'blocked',
      policy,
      userMessage: 'No pude ejecutar esa acción por política de seguridad.',
    }
  }

  if (policy.decision === 'confirm') {
    logger.info('[ToolPolicy] Tool requires confirmation', {
      userId: params.context.userId,
      metadata: { toolName: params.toolName, decision: policy.decision, reason: policy.reason },
    })
    return {
      status: 'blocked',
      policy,
      userMessage: 'Antes de ejecutarlo, necesito tu confirmación explícita.',
    }
  }

  const startedAt = Date.now()
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= policy.contract.retries + 1; attempt++) {
    try {
      const output = await runWithTimeout(params.execute(params.input), policy.contract.timeoutMs)
      const latencyMs = Date.now() - startedAt

      logger.info('[ToolPolicy] Tool executed', {
        userId: params.context.userId,
        metadata: {
          toolName: params.toolName,
          decision: policy.decision,
          reason: policy.reason,
          attempts: attempt,
          latencyMs,
          timeoutMs: policy.contract.timeoutMs,
        },
      })

      return {
        status: 'ok',
        output,
        policy,
        attempts: attempt,
        latencyMs,
      }
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  const finalError = lastError ?? new Error('tool execution failed')
  const errorMessage = finalError.message
  logger.error('[ToolPolicy] Tool execution failed', finalError, {
    userId: params.context.userId,
    metadata: {
      toolName: params.toolName,
      decision: policy.decision,
      retries: policy.contract.retries,
      error: errorMessage,
    },
  })

  return {
    status: 'error',
    policy,
    error: errorMessage,
    userMessage: 'No logré completar esa acción en este momento. ¿Intentamos de nuevo?',
  }
}
