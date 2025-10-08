/**
 * Dead Letter Queue (DLQ) utilities
 *
 * Tracks failed webhook messages for manual review and retry
 * Created: 2025-10-06
 */

import { getSupabaseServerClient } from './supabase';
import { logger } from './logger';

export interface WebhookFailure {
  requestId: string;
  waMessageId?: string;
  phoneNumber: string;
  rawPayload: unknown;
  errorMessage: string;
  errorCode?: string;
}

/**
 * Add failed webhook message to Dead Letter Queue
 *
 * @param failure - Webhook failure details
 * @returns Promise<void>
 *
 * @example
 * ```typescript
 * await addToWebhookDLQ({
 *   requestId: 'abc123',
 *   phoneNumber: '+16315551234',
 *   rawPayload: normalizedMessage,
 *   errorMessage: 'DB constraint violation',
 *   errorCode: '23514'
 * });
 * ```
 */
export async function addToWebhookDLQ(failure: WebhookFailure): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from('webhook_failures').insert({
      request_id: failure.requestId,
      wa_message_id: failure.waMessageId || null,
      phone_number: failure.phoneNumber,
      raw_payload: failure.rawPayload as any, // Cast unknown to Json for Supabase
      error_message: failure.errorMessage,
      error_code: failure.errorCode || null,
      retry_count: 0,
      status: 'pending',
    });

    if (error) {
      // Log but don't throw - DLQ insertion failure shouldn't crash processing
      logger.error('[DLQ] Failed to insert into DLQ', error, {
        requestId: failure.requestId,
        metadata: {
          phoneNumber: failure.phoneNumber.slice(0, 8) + '***',
          errorCode: failure.errorCode,
        },
      });
      return;
    }

    logger.info('[DLQ] Message added to DLQ', {
      requestId: failure.requestId,
      metadata: {
        phoneNumber: failure.phoneNumber.slice(0, 8) + '***',
        errorMessage: failure.errorMessage,
        errorCode: failure.errorCode,
      },
    });
  } catch (err: any) {
    // Catch all errors to prevent DLQ issues from breaking webhook
    logger.error('[DLQ] Unexpected error adding to DLQ', err, {
      requestId: failure.requestId,
    });
  }
}

/**
 * Get pending webhook failures from DLQ
 *
 * @param limit - Maximum number of failures to retrieve (default: 100)
 * @returns Promise<Array> - Array of pending failures
 */
export async function getPendingFailures(limit = 100) {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from('webhook_failures')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('[DLQ] Failed to fetch pending failures', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Mark DLQ failure as resolved
 *
 * @param id - UUID of the webhook_failures record
 */
export async function markFailureResolved(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from('webhook_failures')
    .update({ status: 'resolved', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    logger.error('[DLQ] Failed to mark failure as resolved', error, {
      metadata: { failureId: id },
    });
    throw error;
  }

  logger.info('[DLQ] Failure marked as resolved', { metadata: { failureId: id } });
}

/**
 * Increment retry count for a failed message
 *
 * @param id - UUID of the webhook_failures record
 */
export async function incrementRetryCount(id: string): Promise<void> {
  const supabase = getSupabaseServerClient();

  // Manual increment (RPC not needed for now)
  const { data: current } = await supabase
    .from('webhook_failures')
    .select('retry_count')
    .eq('id', id)
    .single();

  if (current) {
    await supabase
      .from('webhook_failures')
      .update({
        retry_count: ((current as any).retry_count || 0) + 1,
        status: 'retrying',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  }
}
