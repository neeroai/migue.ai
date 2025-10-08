import { getSupabaseServerClient } from './supabase';
import { logger } from './logger';

/**
 * Metrics and monitoring for WhatsApp messaging windows
 *
 * Tracks:
 * - Active messaging windows
 * - Window expiration events
 * - Proactive message delivery
 * - Cost savings (free vs paid messages)
 */

export interface WindowMetrics {
  totalActiveWindows: number;
  windowsNearExpiration: number; // < 4h remaining
  freeEntryPointActive: number; // Within 72h free entry
  proactiveMessagesSentToday: number;
  avgProactivePerActiveUser: number;
  estimatedCostSavings: number; // USD
  totalUsers: number;
  activeConversations: number;
}

export interface CostMetrics {
  conversationsWithinWindow: number; // Free
  conversationsTemplateRequired: number; // Paid
  estimatedTemplatesSaved: number; // Templates not sent due to window
  monthlySavings: number; // USD
  dailySavings: number; // USD
}

export type WindowEvent = 'opened' | 'closed' | 'maintained' | 'expired' | 'template_sent';

// Pricing constants (LATAM - Mexico/Colombia)
const PRICING = {
  userInitiatedConversation: 0.0364, // $0.0364 per 24h conversation
  businessInitiatedTemplate: 0.0667, // $0.0667 per template message
  region: 'LATAM',
} as const;

/**
 * Get current messaging window metrics
 */
export async function trackWindowMetrics(): Promise<WindowMetrics> {
  const supabase = getSupabaseServerClient();

  try {
    // Use the messaging_windows_stats view created in migration
    const { data: stats, error } = await supabase
      .from('messaging_windows_stats')
      .select('*')
      .single();

    if (error) {
      logger.error('[metrics] Failed to fetch window stats', error);
      throw error;
    }

    // Count total users and active conversations
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    const { count: activeConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Calculate estimated cost savings
    const avgProactivePerUser = (stats as any)?.avg_proactive_per_active_user ?? 0;
    const totalProactiveToday = (stats as any)?.total_proactive_today ?? 0;

    // Savings = messages sent within free window instead of paid templates
    // Each message within window = $0 vs $0.0667 template
    const estimatedCostSavings = totalProactiveToday * PRICING.businessInitiatedTemplate;

    return {
      totalActiveWindows: (stats as any)?.active_windows ?? 0,
      windowsNearExpiration: (stats as any)?.windows_near_expiration ?? 0,
      freeEntryPointActive: (stats as any)?.free_entry_active ?? 0,
      proactiveMessagesSentToday: totalProactiveToday,
      avgProactivePerActiveUser: avgProactivePerUser,
      estimatedCostSavings,
      totalUsers: totalUsers ?? 0,
      activeConversations: activeConversations ?? 0,
    };
  } catch (error: any) {
    logger.error('[metrics] Failed to track window metrics', error);
    throw error;
  }
}

/**
 * Calculate cost savings from using messaging windows vs templates
 */
export async function calculateCostSavings(days: number = 30): Promise<CostMetrics> {
  const supabase = getSupabaseServerClient();

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Count proactive messages sent within windows (free)
    const { count: proactiveWithinWindow } = await supabase
      .from('messaging_windows')
      .select('*', { count: 'exact', head: true })
      .gte('last_proactive_sent_at', since.toISOString());

    // Estimate templates that would have been needed if no window system
    // Assumption: without window maintenance, 50% of proactive messages
    // would have been sent outside window (requiring templates)
    const estimatedTemplatesSaved = Math.floor((proactiveWithinWindow ?? 0) * 0.5);

    // Calculate savings
    const dailySavings = estimatedTemplatesSaved * PRICING.businessInitiatedTemplate / days;
    const monthlySavings = dailySavings * 30;

    return {
      conversationsWithinWindow: proactiveWithinWindow ?? 0,
      conversationsTemplateRequired: 0, // Would need tracking of actual template sends
      estimatedTemplatesSaved,
      monthlySavings,
      dailySavings,
    };
  } catch (error: any) {
    logger.error('[metrics] Failed to calculate cost savings', error);
    throw error;
  }
}

/**
 * Log a window event for analytics
 */
export async function logWindowEvent(
  event: WindowEvent,
  phoneNumber: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  logger.info(`[metrics] Window event: ${event}`, {
    metadata: {
      event,
      phoneNumber: phoneNumber.slice(0, 8) + '***',
      ...metadata,
    },
  });

  // Future: Store events in dedicated analytics table for reporting
  // For now, events are logged to application logs
}

/**
 * Generate daily metrics report
 */
export async function generateDailyReport(): Promise<{
  metrics: WindowMetrics;
  costSavings: CostMetrics;
  timestamp: string;
}> {
  const metrics = await trackWindowMetrics();
  const costSavings = await calculateCostSavings(1); // Last 24 hours

  return {
    metrics,
    costSavings,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if metrics are within acceptable ranges
 * Used for monitoring and alerting
 */
export async function validateMetricsHealth(): Promise<{
  healthy: boolean;
  issues: string[];
}> {
  const metrics = await trackWindowMetrics();
  const issues: string[] = [];

  // Check 1: At least 50% of users should have active windows
  const windowUtilization = metrics.totalUsers > 0
    ? metrics.totalActiveWindows / metrics.totalUsers
    : 0;

  if (windowUtilization < 0.5) {
    issues.push(
      `Low window utilization: ${(windowUtilization * 100).toFixed(1)}% (target: >50%)`
    );
  }

  // Check 2: Average proactive messages should be reasonable (1-4 per user)
  if (metrics.avgProactivePerActiveUser > 4) {
    issues.push(
      `High proactive message rate: ${metrics.avgProactivePerActiveUser.toFixed(1)} per user (max: 4)`
    );
  }

  // Check 3: Check for windows near expiration (should have maintenance scheduled)
  if (metrics.windowsNearExpiration > metrics.totalActiveWindows * 0.3) {
    issues.push(
      `Many windows near expiration: ${metrics.windowsNearExpiration} windows (${((metrics.windowsNearExpiration / metrics.totalActiveWindows) * 100).toFixed(1)}%)`
    );
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

/**
 * Get metrics summary for API endpoint
 */
export async function getMetricsSummary(): Promise<{
  windows: WindowMetrics;
  costs: CostMetrics;
  health: { healthy: boolean; issues: string[] };
  pricing: typeof PRICING;
}> {
  const [windows, costs, health] = await Promise.all([
    trackWindowMetrics(),
    calculateCostSavings(30),
    validateMetricsHealth(),
  ]);

  return {
    windows,
    costs,
    health,
    pricing: PRICING,
  };
}
