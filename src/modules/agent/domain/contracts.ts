/**
 * @file Agent Ledger Contracts
 * @description Type contracts for agent event queue and run ledger.
 */

import type { Json } from '@/src/shared/infra/db/database.types'

export const AGENT_EVENT_STATUSES = ['pending', 'processing', 'done', 'failed'] as const
export type AgentEventStatus = typeof AGENT_EVENT_STATUSES[number]

export const AGENT_RUN_STATUSES = [
  'queued',
  'running',
  'waiting_confirmation',
  'completed',
  'failed',
  'dead_letter',
] as const
export type AgentRunStatus = typeof AGENT_RUN_STATUSES[number]

export const AGENT_STEP_STATUSES = ['started', 'ok', 'error', 'skipped'] as const
export type AgentStepStatus = typeof AGENT_STEP_STATUSES[number]

export const TOOL_CALL_STATUSES = ['started', 'ok', 'error', 'timeout', 'blocked'] as const
export type ToolCallStatus = typeof TOOL_CALL_STATUSES[number]

export const TOOL_RISK_LEVELS = ['low', 'medium', 'high'] as const
export type ToolRiskLevel = typeof TOOL_RISK_LEVELS[number]

export interface AgentEvent {
  id: string
  conversationId: string
  userId: string
  source: 'whatsapp_webhook'
  inputType: string
  payload: Json
  idempotencyKey: string
  status: AgentEventStatus
  attemptCount: number
  availableAt: string
  createdAt: string
  updatedAt: string
}

export interface AgentRun {
  id: string
  eventId: string
  conversationId: string
  userId: string
  status: AgentRunStatus
  graphVersion: string
  inputClass: string
  startedAt?: string | null
  endedAt?: string | null
  failureReason?: string | null
  createdAt: string
}

export interface AgentStep {
  id: string
  runId: string
  node: string
  status: AgentStepStatus
  inputSnapshot?: Json | null
  outputSnapshot?: Json | null
  latencyMs?: number | null
  createdAt: string
}

export interface AgentToolCall {
  id: string
  runId: string
  toolName: string
  riskLevel: ToolRiskLevel
  input: Json
  output?: Json | null
  status: ToolCallStatus
  error?: string | null
  startedAt?: string | null
  endedAt?: string | null
}

export interface AgentCheckpoint {
  id: string
  runId: string
  node: string
  state: Json
  createdAt: string
}
