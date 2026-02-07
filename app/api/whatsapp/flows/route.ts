/**
 * @file WhatsApp Flows Data Exchange
 * @description Handles encrypted data exchange for WhatsApp Flows with signature validation and session completion
 * @module app/api/whatsapp/flows
 * @exports runtime, maxDuration, POST
 * @runtime edge
 * @see https://developers.facebook.com/docs/whatsapp/flows
 * @date 2026-02-07 19:00
 * @updated 2026-02-07 19:00
 */

export const runtime = 'edge';
export const maxDuration = 10;

import { handleFlowDataExchange, completeFlowSession, validateFlowSignature } from '../../../../lib/whatsapp-flows';
import { logger } from '../../../../lib/logger';
import type { FlowDataExchangeRequest } from '../../../../types/whatsapp';

/**
 * WhatsApp Flows Data Exchange Endpoint
 * Handles encrypted data exchange for WhatsApp Flows
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // CRITICAL: Validate signature before processing to prevent spoofing
    const rawBody = await req.text();
    const isValid = await validateFlowSignature(req, rawBody);

    if (!isValid) {
      logger.error('[Flow Endpoint] Invalid flow signature - potential spoofing attempt', new Error('Invalid signature'), {
        metadata: { headers: Object.fromEntries(req.headers.entries()) }
      });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body = JSON.parse(rawBody) as FlowDataExchangeRequest;

    // Validate required fields
    if (!body.flow_token || !body.action || !body.screen) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Handle the data exchange
    const response = await handleFlowDataExchange(body);

    if (!response) {
      return new Response(
        JSON.stringify({ error: 'Failed to process flow request' }),
        {
          status: 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // If this is a completion screen, mark the session as completed
    if (response.screen === 'SUCCESS' ||
        response.screen === 'THANK_YOU' ||
        response.screen === 'APPOINTMENT_CONFIRMED') {
      await completeFlowSession(body.flow_token).catch((err) => {
        logger.error('[Flow Endpoint] Error completing flow session', err instanceof Error ? err : new Error(String(err)), {
          metadata: { flow_token: body.flow_token, screen: response.screen }
        });
      });
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    logger.error('[Flow Endpoint] Error processing flow request', error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}