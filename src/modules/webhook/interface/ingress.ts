import { logger } from '../../../shared/observability/logger';
import { validateSignature } from './validation';
import { safeValidateWebhookPayload, extractFirstMessage } from '@/types/schemas';
import { whatsAppMessageToNormalized, type NormalizedMessage } from '../domain/message-normalization';
import { checkRateLimit, getRateLimitWaitTime } from '../domain/rate-limiter';

type ResponseResult = {
  kind: 'response';
  status: number;
  body: unknown;
};

type RateLimitedResult = {
  kind: 'rate_limited';
  phoneNumber: string;
  waitSeconds: number;
  body: {
    success: false;
    reason: 'rate_limited';
    request_id: string;
    retry_after_seconds: number;
  };
};

type ProcessResult = {
  kind: 'process';
  normalized: NormalizedMessage;
};

export type WebhookIngressResult = ResponseResult | RateLimitedResult | ProcessResult;

export async function processWebhookIngress(req: Request, requestId: string): Promise<WebhookIngressResult> {
  const rawBody = await req.text();
  logger.debug('[webhook] Request body received', {
    requestId,
    metadata: { bodyLength: rawBody.length },
  });

  const signatureOk = await validateSignature(req, rawBody);
  if (!signatureOk) {
    logger.warn('[webhook] Invalid signature', { requestId });
    return {
      kind: 'response',
      status: 401,
      body: { error: 'Invalid signature', request_id: requestId },
    };
  }
  logger.debug('[webhook] Signature validated successfully', { requestId });

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
    logger.debug('[webhook] JSON parsed successfully', {
      requestId,
      metadata: { object: (jsonBody as any)?.object },
    });
  } catch (parseErr: any) {
    logger.warn('[webhook] JSON parse failed', {
      requestId,
      metadata: { error: parseErr.message },
    });
    return {
      kind: 'response',
      status: 400,
      body: { error: 'Invalid JSON body', request_id: requestId },
    };
  }

  const validationResult = safeValidateWebhookPayload(jsonBody);
  if (!validationResult.success) {
    logger.debug('[webhook] Zod validation result', {
      requestId,
      metadata: {
        success: validationResult.success,
        errorCount: validationResult.error?.issues.length,
      },
    });
    logger.warn('[webhook] Validation failed', {
      requestId,
      metadata: { issues: validationResult.error.issues.slice(0, 3) },
    });
    return {
      kind: 'response',
      status: 400,
      body: {
        error: 'Invalid webhook payload',
        request_id: requestId,
        issues: validationResult.error.issues.slice(0, 3),
      },
    };
  }

  const payload = validationResult.data;
  logger.debug('[webhook] Payload validated, extracting message', {
    requestId,
    metadata: {
      entryCount: payload.entry.length,
    },
  });

  const message = extractFirstMessage(payload);
  if (!message) {
    logger.debug('[webhook] No message found in payload', { requestId });
    if (payload.entry.length > 0) {
      const entry = payload.entry[0]!;
      if (entry.changes.length > 0) {
        const change = entry.changes[0]!;

        if (change.field === 'flows') {
          logger.info('[webhook] Flow event received (acknowledged, not processed)', {
            requestId,
            metadata: {
              field: change.field,
              eventType: 'value' in change ? (change.value as any)?.event : 'unknown',
              flowId: 'value' in change ? (change.value as any)?.flow_id : undefined,
            },
          });
          return {
            kind: 'response',
            status: 200,
            body: {
              status: 'acknowledged',
              reason: 'flow monitoring event',
              request_id: requestId,
            },
          };
        }

        if (change.field !== 'messages' && change.field !== 'call_events') {
          const valueKeys =
            'value' in change && typeof change.value === 'object' && change.value !== null
              ? Object.keys(change.value)
              : [];
          logger.info('[webhook] Unknown webhook field type (acknowledged, not processed)', {
            requestId,
            metadata: {
              field: change.field,
              valueKeys,
            },
          });
          return {
            kind: 'response',
            status: 200,
            body: {
              status: 'acknowledged',
              reason: `unsupported field: ${change.field}`,
              request_id: requestId,
            },
          };
        }
      }
    }

    return {
      kind: 'response',
      status: 200,
      body: { status: 'ignored', reason: 'no message or recognized event', request_id: requestId },
    };
  }

  logger.debug('[webhook] Normalizing message', {
    requestId,
    metadata: { messageType: message.type, from: message.from },
  });
  const normalized = whatsAppMessageToNormalized(message);

  const isAllowed = checkRateLimit(normalized.from);
  if (!isAllowed) {
    const waitTime = getRateLimitWaitTime(normalized.from);
    const waitSeconds = Math.ceil(waitTime / 1000);

    logger.warn('[webhook] User rate limited - message rejected', {
      requestId,
      metadata: {
        phoneNumber: normalized.from.slice(0, 8) + '***',
        waitTimeMs: waitTime,
        waitSeconds,
      },
    });

    return {
      kind: 'rate_limited',
      phoneNumber: normalized.from,
      waitSeconds,
      body: {
        success: false,
        reason: 'rate_limited',
        request_id: requestId,
        retry_after_seconds: waitSeconds,
      },
    };
  }

  return {
    kind: 'process',
    normalized,
  };
}
