import { getSupabaseServerClient } from './supabase'
import { logger } from './logger'
import { getConversationHistory } from './conversation-utils'

/**
 * WhatsApp 24-hour messaging window management
 *
 * Official WhatsApp API rules:
 * - Window opens when user sends message or makes call
 * - Lasts 24 hours
 * - All messages within window are FREE
 * - Free entry point: 72 hours free after first contact
 * - Outside window: only template messages (paid)
 *
 * Reference: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
 */

// Constants
export const COLOMBIA_TZ = 'America/Bogota'
export const BUSINESS_HOURS = { start: 7, end: 20 } // 7am-8pm
export const MAX_PROACTIVE_PER_DAY = 4
export const MIN_INTERVAL_HOURS = 4
export const WINDOW_DURATION_HOURS = 24
export const FREE_ENTRY_DURATION_HOURS = 72
export const WINDOW_MAINTENANCE_THRESHOLD_HOURS = 4 // Send maintenance message when < 4h remaining

// Types
export interface MessagingWindow {
  isOpen: boolean
  isFreeEntry: boolean
  expiresAt: Date | null
  hoursRemaining: number
  canSendProactive: boolean
  messagesRemainingToday: number
  lastProactiveSentAt: Date | null
}

export interface ProactiveMessageDecision {
  allowed: boolean
  reason?: string
  nextAvailableTime?: Date
}

interface WindowRow {
  user_id: string
  phone_number: string
  window_opened_at: string
  window_expires_at: string
  last_user_message_id: string | null
  proactive_messages_sent_today: number
  last_proactive_sent_at: string | null
  free_entry_point_expires_at: string | null
}

type SupabaseClient = ReturnType<typeof getSupabaseServerClient>

/**
 * Update messaging window when a message is sent/received
 * Call this from webhook for every inbound/outbound message
 */
export async function updateMessagingWindow(
  phoneNumber: string,
  messageId: string,
  isUserMessage: boolean
): Promise<void> {
  const supabase = getSupabaseServerClient()

  // Get or create user
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone_number', phoneNumber)
    .single()

  if (!user) {
    logger.warn('[MessagingWindow] User not found, skipping window update', {
      metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' },
    })
    return
  }

  const now = new Date()
  const windowExpiration = new Date(now.getTime() + WINDOW_DURATION_HOURS * 60 * 60 * 1000)

  if (isUserMessage) {
    // User message: reset 24h window AND set free entry point if new
    const { data: existing } = await supabase
      .from('messaging_windows')
      .select('free_entry_point_expires_at')
      .eq('phone_number', phoneNumber)
      .single()

    const freeEntryExpiration =
      (existing as any)?.free_entry_point_expires_at
        ? new Date((existing as any).free_entry_point_expires_at)
        : new Date(now.getTime() + FREE_ENTRY_DURATION_HOURS * 60 * 60 * 1000)

    await supabase.from('messaging_windows').upsert(
      {
        user_id: user.id,
        phone_number: phoneNumber,
        window_opened_at: now.toISOString(),
        window_expires_at: windowExpiration.toISOString(),
        last_user_message_id: messageId,
        free_entry_point_expires_at: freeEntryExpiration.toISOString(),
        updated_at: now.toISOString(),
      },
      { onConflict: 'phone_number' }
    )

    logger.debug('[MessagingWindow] Window reset by user message', {
      metadata: {
        phoneNumber: phoneNumber.slice(0, 8) + '***',
        expiresAt: windowExpiration.toISOString(),
        freeEntryExpiresAt: freeEntryExpiration.toISOString(),
      },
    })
  } else {
    // Outbound message: just update timestamp, don't reset window
    const { error } = await supabase.from('messaging_windows').update({
      updated_at: now.toISOString(),
    }).eq('phone_number', phoneNumber)

    if (error) {
      logger.error('[MessagingWindow] Failed to update timestamp for outbound message', error, {
        metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' },
      })
    }
  }
}

/**
 * Get current messaging window status for a phone number
 */
export async function getMessagingWindow(
  phoneNumber: string,
  supabase: SupabaseClient = getSupabaseServerClient()
): Promise<MessagingWindow> {

  const { data, error } = await supabase.from('messaging_windows')
    .select('*')
    .eq('phone_number', phoneNumber)
    .single()

  if (error || !data) {
    return {
      isOpen: false,
      isFreeEntry: false,
      expiresAt: null,
      hoursRemaining: 0,
      canSendProactive: false,
      messagesRemainingToday: 0,
      lastProactiveSentAt: null,
    }
  }

  const window: WindowRow = data as any
  const now = new Date()
  const expiresAt = new Date(window.window_expires_at)
  const freeEntryExpiresAt = window.free_entry_point_expires_at
    ? new Date(window.free_entry_point_expires_at)
    : null

  const isOpen = expiresAt > now
  const isFreeEntry = freeEntryExpiresAt ? freeEntryExpiresAt > now : false
  const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))

  const messagesRemainingToday = Math.max(0, MAX_PROACTIVE_PER_DAY - window.proactive_messages_sent_today)

  // Can send proactive if: window open + within business hours + not at daily limit
  const canSendProactive = isOpen && messagesRemainingToday > 0

  return {
    isOpen,
    isFreeEntry,
    expiresAt,
    hoursRemaining,
    canSendProactive,
    messagesRemainingToday,
    lastProactiveSentAt: window.last_proactive_sent_at ? new Date(window.last_proactive_sent_at) : null,
  }
}

/**
 * Check if current time is within business hours (7am-8pm) for a timezone
 */
export async function isWithinBusinessHours(timezone: string = COLOMBIA_TZ): Promise<boolean> {
  const now = new Date()

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })

  const currentHour = parseInt(formatter.format(now))

  return currentHour >= BUSINESS_HOURS.start && currentHour < BUSINESS_HOURS.end
}

/**
 * Get current hour in a specific timezone
 */
export function getCurrentHour(timezone: string = COLOMBIA_TZ): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  })

  return parseInt(formatter.format(new Date()))
}

/**
 * Check if user has been active recently (< 30 minutes)
 */
async function isUserActiveRecently(userId: string, conversationId: string): Promise<boolean> {
  const history = await getConversationHistory(conversationId, 5)

  if (history.length === 0) return false

  const lastMessage = history[history.length - 1]
  if (!lastMessage) return false

  const timeSinceLastMessage = Date.now() - new Date(lastMessage.timestamp).getTime()
  const thirtyMinutes = 30 * 60 * 1000

  return timeSinceLastMessage < thirtyMinutes
}

/**
 * Decide if we should send a proactive message to a user
 * Considers: window status, business hours, daily limit, user activity, rate limiting
 */
export async function shouldSendProactiveMessage(
  userId: string,
  phoneNumber: string,
  conversationId?: string,
  supabase: SupabaseClient = getSupabaseServerClient(),
  snapshot?: {
    proactive_messages_sent_today: number
    last_proactive_sent_at: string | null
    window_expires_at: string
    free_entry_point_expires_at: string | null
  } | null
): Promise<ProactiveMessageDecision> {
  // 1. Check if within business hours
  const withinHours = await isWithinBusinessHours()
  if (!withinHours) {
    return {
      allowed: false,
      reason: 'Outside business hours (7am-8pm Bogotá)',
    }
  }

  // 2. Check messaging window status
  const window = snapshot
    ? (() => {
        const now = new Date()
        const expiresAt = new Date(snapshot.window_expires_at)
        const freeEntryExpiresAt = snapshot.free_entry_point_expires_at
          ? new Date(snapshot.free_entry_point_expires_at)
          : null
        const isOpen = expiresAt > now
        const isFreeEntry = freeEntryExpiresAt ? freeEntryExpiresAt > now : false
        const hoursRemaining = Math.max(0, (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60))
        const messagesRemainingToday = Math.max(0, MAX_PROACTIVE_PER_DAY - snapshot.proactive_messages_sent_today)
        const canSendProactive = isOpen && messagesRemainingToday > 0

        return {
          isOpen,
          isFreeEntry,
          expiresAt,
          hoursRemaining,
          canSendProactive,
          messagesRemainingToday,
          lastProactiveSentAt: snapshot.last_proactive_sent_at
            ? new Date(snapshot.last_proactive_sent_at)
            : null,
        }
      })()
    : await getMessagingWindow(phoneNumber, supabase)

  if (!window.isOpen && !window.isFreeEntry) {
    return {
      allowed: false,
      reason: 'Messaging window closed and free entry expired',
    }
  }

  // 3. Check daily limit
  if (window.messagesRemainingToday <= 0) {
    const nextDay = new Date()
    nextDay.setHours(BUSINESS_HOURS.start, 0, 0, 0)
    nextDay.setDate(nextDay.getDate() + 1)

    return {
      allowed: false,
      reason: `Daily limit reached (${MAX_PROACTIVE_PER_DAY} messages/day)`,
      nextAvailableTime: nextDay,
    }
  }

  // 4. Check rate limiting (min interval between proactive messages)
  if (window.lastProactiveSentAt) {
    const hoursSinceLastProactive =
      (Date.now() - window.lastProactiveSentAt.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastProactive < MIN_INTERVAL_HOURS) {
      const nextAvailable = new Date(
        window.lastProactiveSentAt.getTime() + MIN_INTERVAL_HOURS * 60 * 60 * 1000
      )

      return {
        allowed: false,
        reason: `Rate limit: min ${MIN_INTERVAL_HOURS}h between messages`,
        nextAvailableTime: nextAvailable,
      }
    }
  }

  // 5. Check if user is currently active (avoid interrupting)
  if (conversationId) {
    const isActive = await isUserActiveRecently(userId, conversationId)
    if (isActive) {
      return {
        allowed: false,
        reason: 'User is currently active (< 30 min since last message)',
      }
    }
  }

  // All checks passed
  return { allowed: true }
}

/**
 * Increment proactive message counter after sending
 */
export async function incrementProactiveCounter(
  phoneNumber: string,
  supabase: SupabaseClient = getSupabaseServerClient()
): Promise<void> {

  // First get current count
  const { data: current } = await supabase.from('messaging_windows')
    .select('proactive_messages_sent_today')
    .eq('phone_number', phoneNumber)
    .single()

  if (!current) {
    logger.warn('[MessagingWindow] Window not found for counter increment', {
      metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' },
    })
    return
  }

  // Update with incremented count
  const { error } = await supabase.from('messaging_windows')
    .update({
      proactive_messages_sent_today: (current as any).proactive_messages_sent_today + 1,
      last_proactive_sent_at: new Date().toISOString(),
    })
    .eq('phone_number', phoneNumber)

  if (error) {
    logger.error('[MessagingWindow] Failed to increment proactive counter', error, {
      metadata: { phoneNumber: phoneNumber.slice(0, 8) + '***' },
    })
  }
}

/**
 * Find users with messaging windows near expiration
 * Used by cron job to send maintenance messages
 */
export async function findWindowsNearExpiration(
  hoursThreshold: number = WINDOW_MAINTENANCE_THRESHOLD_HOURS
): Promise<
  Array<{
    user_id: string
    phone_number: string
    window_expires_at: string
    hours_remaining: number
    proactive_messages_sent_today: number
  }>
> {
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase.rpc('find_windows_near_expiration', {
    hours_threshold: hoursThreshold,
  })

  if (error) {
    logger.error('[MessagingWindow] Failed to find windows near expiration', error)
    return []
  }

  return data ?? []
}

/**
 * Schedule a follow-up message to maintain the messaging window
 * This should be called proactively before window expires
 */
export async function scheduleWindowMaintenance(
  userId: string,
  conversationId: string,
  windowExpiresAt: Date
): Promise<void> {
  // Import here to avoid circular dependency
  const { scheduleFollowUp } = await import('./followups')

  // Schedule maintenance message 4 hours before window expires
  const maintenanceTime = new Date(
    windowExpiresAt.getTime() - WINDOW_MAINTENANCE_THRESHOLD_HOURS * 60 * 60 * 1000
  )

  const delayMinutes = Math.max(0, (maintenanceTime.getTime() - Date.now()) / (1000 * 60))

  if (delayMinutes > 0) {
    await scheduleFollowUp({
      userId,
      conversationId,
      category: 'custom',
      delayMinutes,
      payload: {
        type: 'window_maintenance',
        windowExpiresAt: windowExpiresAt.toISOString(),
      },
    })

    logger.debug('[MessagingWindow] Scheduled maintenance message', {
      metadata: {
        userId,
        conversationId,
        scheduledFor: maintenanceTime.toISOString(),
        windowExpiresAt: windowExpiresAt.toISOString(),
      },
    })
  }
}
