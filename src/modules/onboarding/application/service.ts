import { getSupabaseServerClient } from '../../../shared/infra/db/supabase'
import { sendFlow } from '../../../shared/infra/whatsapp'
import { logger } from '../../../shared/observability/logger'

const DEFAULT_SIGNUP_FLOW_ID = 'user_signup_flow'

type EnsureSignupParams = {
  userId: string
  phoneNumber: string
  conversationId?: string
  requestId?: string
}

type EnsureSignupResult = {
  blocked: boolean
  reason: 'disabled' | 'already_completed' | 'already_in_progress' | 'flow_sent' | 'flow_send_failed'
}

function isSignupEnabled(): boolean {
  return process.env.SIGNUP_FLOW_ENABLED !== 'false'
}

function getSignupFlowId(): string {
  return process.env.SIGNUP_FLOW_ID?.trim() || DEFAULT_SIGNUP_FLOW_ID
}

function needsSignup(user: {
  name: string | null
  email?: string | null
  onboarding_completed_at?: string | null
}): boolean {
  const hasName = typeof user.name === 'string' && user.name.trim().length >= 2
  const hasEmail = typeof user.email === 'string' && user.email.trim().length > 3
  // Backward compatibility: legacy users may have name/email populated
  // without onboarding_completed_at; they should not be blocked.
  return !(hasName && hasEmail)
}

async function hasHistoricalAssistantReplies(supabase: ReturnType<typeof getSupabaseServerClient>, userId: string): Promise<boolean> {
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .limit(50)

  if (convError) throw convError
  const conversationIds = (conversations ?? []).map((c: any) => c.id).filter(Boolean)
  if (conversationIds.length === 0) return false

  const { data: outbound, error: outboundError } = await supabase
    .from('messages_v2')
    .select('id')
    .in('conversation_id', conversationIds)
    .eq('direction', 'outbound')
    .limit(1)

  if (outboundError) throw outboundError
  return Array.isArray(outbound) && outbound.length > 0
}

export async function ensureSignupOnFirstContact({
  userId,
  phoneNumber,
  conversationId,
  requestId,
}: EnsureSignupParams): Promise<EnsureSignupResult> {
  if (!isSignupEnabled()) {
    return { blocked: false, reason: 'disabled' }
  }

  const supabase = getSupabaseServerClient()
  const flowId = getSignupFlowId()

  let userRow: { name: string | null; email?: string | null; onboarding_completed_at?: string | null } | null = null
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name,email,onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      throw error
    }
    userRow = data
  } catch (error: any) {
    const mayBeColumnMissing = typeof error?.message === 'string' && error.message.includes('column')
    logger.warn('[onboarding] Unable to evaluate signup status, skipping guard', {
      ...(requestId ? { requestId } : {}),
      ...(conversationId ? { conversationId } : {}),
      userId,
      metadata: {
        phoneNumber: phoneNumber.slice(0, 8) + '***',
        errorMessage: error?.message,
        schemaMismatch: mayBeColumnMissing,
      },
    })
    return { blocked: false, reason: 'already_completed' }
  }

  if (!userRow || !needsSignup(userRow)) {
    return { blocked: false, reason: 'already_completed' }
  }

  // Do not hard-block established users due to incomplete signup fields.
  // If the assistant has already replied historically, treat as completed.
  try {
    const hasHistory = await hasHistoricalAssistantReplies(supabase, userId)
    if (hasHistory) {
      logger.info('[onboarding] Skipping signup gate for existing user with assistant history', {
        ...(requestId ? { requestId } : {}),
        ...(conversationId ? { conversationId } : {}),
        userId,
      })
      return { blocked: false, reason: 'already_completed' }
    }
  } catch (historyError: any) {
    logger.warn('[onboarding] Failed to evaluate assistant history, skipping guard', {
      ...(requestId ? { requestId } : {}),
      ...(conversationId ? { conversationId } : {}),
      userId,
      metadata: { errorMessage: historyError?.message },
    })
    return { blocked: false, reason: 'already_completed' }
  }

  const { data: activeSession, error: activeSessionError } = await supabase
    .from('flow_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('flow_id', flowId)
    .in('status', ['pending', 'in_progress'])
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  if (activeSessionError) {
    logger.warn('[onboarding] Failed checking active signup flow session', {
      ...(requestId ? { requestId } : {}),
      ...(conversationId ? { conversationId } : {}),
      userId,
      metadata: { errorMessage: activeSessionError.message, flowId },
    })
  }

  if (activeSession?.id) {
    return { blocked: true, reason: 'already_in_progress' }
  }

  const sentMessageId = await sendFlow(
    phoneNumber,
    flowId,
    'Completar registro',
    'Antes de continuar, completa tu registro básico para personalizar tu asistente (nombre y email).',
    {
      userId,
      flowType: 'navigate',
      initialScreen: 'WELCOME',
      expiresInMinutes: 60,
    }
  )

  if (!sentMessageId) {
    logger.warn('[onboarding] Failed to send signup flow', {
      ...(requestId ? { requestId } : {}),
      ...(conversationId ? { conversationId } : {}),
      userId,
      metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***', flowId },
    })
    return { blocked: false, reason: 'flow_send_failed' }
  }

  logger.info('[onboarding] Signup flow triggered', {
    ...(requestId ? { requestId } : {}),
    ...(conversationId ? { conversationId } : {}),
    userId,
    metadata: { flowId, signupFlowMessageId: sentMessageId },
  })

  return { blocked: true, reason: 'flow_sent' }
}
