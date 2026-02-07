import type {
  CTAButtonOptions,
  LocationRequestOptions,
  CallPermissionOptions,
  LocationData,
} from '@/types/whatsapp';
import { logger } from '../../observability/logger';
import { ButtonMessage, ListMessage } from './message-builders';
import { sendWhatsAppRequest, type WhatsAppPayload } from './http';

export interface InteractiveButtonOptions {
  header?: string;
  footer?: string;
  replyToMessageId?: string;
}

export interface InteractiveListOptions {
  header?: string;
  footer?: string;
  sectionTitle?: string;
  replyToMessageId?: string;
}

export async function sendWhatsAppText(to: string, body: string) {
  const result = await sendWhatsAppRequest({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  });
  return result?.messages?.[0]?.id ?? null;
}

export async function sendInteractiveButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  options: InteractiveButtonOptions = {}
) {
  try {
    const messageOptions: any = {};
    if (options.header) messageOptions.header = options.header;
    if (options.footer) messageOptions.footer = options.footer;

    const message = new ButtonMessage(body, buttons, messageOptions);
    const payload = message.toPayload(to);

    if (options.replyToMessageId) {
      payload.context = { message_id: options.replyToMessageId };
    }

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending interactive buttons', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, buttonsCount: buttons.length },
    });
    return null;
  }
}

export async function sendInteractiveList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: Array<{ id: string; title: string; description?: string }>,
  optionsOrSectionTitle?: InteractiveListOptions | string
) {
  try {
    const options: InteractiveListOptions =
      typeof optionsOrSectionTitle === 'string'
        ? { sectionTitle: optionsOrSectionTitle }
        : (optionsOrSectionTitle || {});

    const messageOptions: any = {};
    if (options.header) messageOptions.header = options.header;
    if (options.footer) messageOptions.footer = options.footer;
    if (options.sectionTitle) messageOptions.sectionTitle = options.sectionTitle;
    else messageOptions.sectionTitle = 'Opciones';

    const message = new ListMessage(body, buttonLabel, rows, messageOptions);
    const payload = message.toPayload(to);

    if (options.replyToMessageId) {
      payload.context = { message_id: options.replyToMessageId };
    }

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending interactive list', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, rowsCount: rows.length },
    });
    return null;
  }
}

export async function sendCTAButton(
  to: string,
  bodyText: string,
  buttonText: string,
  url: string,
  options?: CTAButtonOptions
): Promise<string | null> {
  try {
    if (buttonText.length > 20) {
      logger.error('[WhatsApp] CTA button text exceeds 20 characters', new Error('Validation failed'), {
        metadata: { buttonTextLength: buttonText.length, maxLength: 20 },
      });
      return null;
    }

    try {
      new URL(url);
    } catch {
      logger.error('[WhatsApp] Invalid URL format for CTA button', new Error('URL validation failed'), {
        metadata: { url },
      });
      return null;
    }

    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: bodyText },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: buttonText,
            url,
          },
        },
        ...(options?.header && {
          header: { type: 'text', text: options.header },
        }),
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending CTA button', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, buttonText, url },
    });
    return null;
  }
}

export async function requestLocation(
  to: string,
  bodyText: string,
  options?: LocationRequestOptions
): Promise<string | null> {
  try {
    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'location_request_message',
        body: { text: bodyText },
        action: {
          name: 'send_location',
        },
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error requesting location', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to },
    });
    return null;
  }
}

export async function sendLocation(to: string, location: LocationData): Promise<string | null> {
  try {
    const result = await sendWhatsAppRequest({
      messaging_product: 'whatsapp',
      to,
      type: 'location',
      location,
    });
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error sending location', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to, location },
    });
    return null;
  }
}

export async function requestCallPermission(
  to: string,
  bodyText: string,
  options?: CallPermissionOptions
): Promise<string | null> {
  try {
    const payload: WhatsAppPayload = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'call_permission_request',
        body: { text: bodyText },
        action: {
          name: 'request_call_permission',
        },
        ...(options?.footer && {
          footer: { text: options.footer },
        }),
      },
      ...(options?.replyToMessageId && {
        context: { message_id: options.replyToMessageId },
      }),
    };

    const result = await sendWhatsAppRequest(payload);
    return result?.messages?.[0]?.id ?? null;
  } catch (error) {
    logger.error('[WhatsApp] Error requesting call permission', error instanceof Error ? error : new Error(String(error)), {
      metadata: { to },
    });
    return null;
  }
}
