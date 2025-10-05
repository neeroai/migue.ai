export const runtime = 'edge';

import { handleFlowDataExchange, completeFlowSession } from '../../../../lib/whatsapp-flows';
import type { FlowDataExchangeRequest } from '../../../../types/whatsapp';

/**
 * WhatsApp Flows Data Exchange Endpoint
 * Handles encrypted data exchange for WhatsApp Flows
 */
export async function POST(req: Request): Promise<Response> {
  try {
    // Parse request body
    const body = await req.json() as FlowDataExchangeRequest;

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
      await completeFlowSession(body.flow_token).catch(console.error);
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Flow endpoint error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
}