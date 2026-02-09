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

export const runtime = 'nodejs';
export const maxDuration = 10;

import {
  handleFlowDataExchange,
  completeFlowSession,
  completeFlowSessionOnce,
  sendPostSignupWelcome,
  validateFlowSignature,
} from '../../../../src/shared/infra/whatsapp/flows';
import {
  decryptFlowRequest,
  encryptFlowResponse,
  isEncryptedFlowEnvelope,
} from '../../../../src/shared/infra/whatsapp/flow-crypto';
import { logger } from '../../../../src/shared/observability/logger';
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
    const parsedBody = JSON.parse(rawBody) as any;

    if (isEncryptedFlowEnvelope(parsedBody)) {
      const decrypted = decryptFlowRequest(parsedBody);
      const body = decrypted.payload as FlowDataExchangeRequest;

      let responsePayload: any
      if (body.action === 'ping') {
        responsePayload = {
          version: body.version || '3.0',
          screen: body.screen || 'SUCCESS',
          data: { status: 'active' },
        }
      } else {
        if (!body.flow_token || !body.action || !body.screen) {
          responsePayload = {
            version: body.version || '3.0',
            screen: body.screen || 'SUCCESS',
            data: { status: 'ok' },
          }
        } else {
          const routedResponse = await handleFlowDataExchange(body)
          responsePayload = routedResponse ?? {
            version: body.version || '3.0',
            screen: body.screen || 'SUCCESS',
            data: { status: 'ok' },
          }
          if (
            body.flow_token &&
            (responsePayload.screen === 'SUCCESS' ||
              responsePayload.screen === 'THANK_YOU' ||
              responsePayload.screen === 'APPOINTMENT_CONFIRMED')
          ) {
            await completeFlowSessionOnce(body.flow_token)
              .then(async (completion) => {
                if (completion.completed && completion.flowId === 'user_signup_flow' && completion.userId) {
                  await sendPostSignupWelcome(completion.userId)
                }
              })
              .catch((err) => {
              logger.error(
                '[Flow Endpoint] Error completing flow session',
                err instanceof Error ? err : new Error(String(err)),
                {
                  metadata: { flow_token: body.flow_token, screen: responsePayload.screen },
                }
              )
            })
          }
        }
      }

      const encryptedResponse = encryptFlowResponse(responsePayload, decrypted.aesKey, decrypted.iv)
      return new Response(encryptedResponse, {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      })
    }

    const body = parsedBody as FlowDataExchangeRequest;

    // Meta health checks may send ping payloads without all runtime fields.
    if (body.action === 'ping') {
      return new Response(
        JSON.stringify({
          version: body.version || '3.0',
          screen: body.screen || 'SUCCESS',
          data: { status: 'pong' },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      );
    }

    // Meta health checks can hit this endpoint with partial payloads.
    // Return 200 to keep endpoint active if signature is valid.
    if (!body.flow_token || !body.action || !body.screen) {
      return new Response(
        JSON.stringify({
          version: body.version || '3.0',
          screen: body.screen || 'SUCCESS',
          data: { status: 'ok' },
        }),
        {
          status: 200,
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
      await completeFlowSessionOnce(body.flow_token)
        .then(async (completion) => {
          if (completion.completed && completion.flowId === 'user_signup_flow' && completion.userId) {
            await sendPostSignupWelcome(completion.userId)
          } else if (!completion.completed) {
            // Backward compatibility for old sessions already marked as completed.
            await completeFlowSession(body.flow_token).catch(() => undefined)
          }
        })
        .catch((err) => {
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
