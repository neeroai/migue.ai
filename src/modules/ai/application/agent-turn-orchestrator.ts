import { logger } from '../../../shared/observability/logger'
import { createProactiveAgent } from './proactive-agent'
import { buildAgentContext } from './agent-context-builder'
import type { TextPathway } from './memory-policy'

const proactiveAgent = createProactiveAgent()

type ExecuteAgentTurnParams = {
  conversationId: string
  userId: string
  userMessage: string
  messageId: string
  pathway: TextPathway
}

export type AgentTurnResult = {
  responseText: string
  raw: {
    usage: { inputTokens: number; outputTokens: number; totalTokens: number }
    cost: { input: number; output: number; total: number }
    finishReason: string
    toolCalls: number
  }
}

/**
 * Single LLM-first entrypoint for a conversational turn:
 * 1) Build full agent context
 * 2) Execute model turn with tools/governance
 * 3) Normalize final user-facing response text
 */
export async function executeAgentTurn(
  params: ExecuteAgentTurnParams
): Promise<AgentTurnResult> {
  logger.debug('[AgentTurn] Building context', {
    conversationId: params.conversationId,
    userId: params.userId,
    metadata: { pathway: params.pathway },
  })

  const agentContext = await buildAgentContext({
    conversationId: params.conversationId,
    userId: params.userId,
    userMessage: params.userMessage,
    pathway: params.pathway,
    requestId: params.messageId,
  })

  logger.debug('[AgentTurn] Executing proactive agent', {
    conversationId: params.conversationId,
    userId: params.userId,
    metadata: {
      pathway: params.pathway,
      historyLength: agentContext.modelHistory.length,
    },
  })

  const aiResponse = await proactiveAgent.respond(
    params.userMessage,
    params.userId,
    agentContext.modelHistory,
    {
      conversationId: params.conversationId,
      messageId: params.messageId,
      pathway: params.pathway,
      agentContext,
    }
  )

  const responseText = (aiResponse.text ?? '').trim() ||
    (aiResponse.toolCalls > 0 ? 'Listo. Ya ejecuté tu solicitud.' : 'Listo.')

  return {
    responseText,
    raw: {
      usage: aiResponse.usage,
      cost: aiResponse.cost,
      finishReason: aiResponse.finishReason,
      toolCalls: aiResponse.toolCalls,
    },
  }
}
