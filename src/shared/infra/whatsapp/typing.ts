import { GRAPH_BASE_URL } from './http';
import { logger } from '../../observability/logger';

export async function markAsReadWithTyping(to: string, messageId: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }

  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: {
        type: 'text',
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }

  return res.json();
}

export function createTypingManager(to: string, messageId: string) {
  let active = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  function clearDurationTimeout() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function clearRefreshInterval() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  async function sendTypingSignal() {
    if (inFlight || !active) return;
    inFlight = true;
    try {
      await markAsReadWithTyping(to, messageId);
    } catch (err: any) {
      logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
        metadata: { to, messageId },
      });
    } finally {
      inFlight = false;
    }
  }

  function startRefreshLoop(refreshIntervalSeconds: number) {
    clearRefreshInterval();

    const refreshMs = Math.max(5, refreshIntervalSeconds) * 1000;
    intervalId = setInterval(() => {
      void sendTypingSignal();
    }, refreshMs);

    if (typeof (intervalId as NodeJS.Timeout).unref === 'function') {
      (intervalId as NodeJS.Timeout).unref();
    }
  }

  return {
    async start() {
      if (active) return;
      active = true;
      try {
        await markAsReadWithTyping(to, messageId);
        startRefreshLoop(20);
      } catch (err: any) {
        active = false;
        logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
          metadata: { to, messageId },
        });
      }
    },
    async startPersistent(refreshIntervalSeconds = 20) {
      if (active) return;
      active = true;
      try {
        await markAsReadWithTyping(to, messageId);
        startRefreshLoop(refreshIntervalSeconds);
      } catch (err: any) {
        active = false;
        logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
          metadata: { to, messageId, refreshIntervalSeconds },
        });
      }
    },
    async stop() {
      active = false;
      clearDurationTimeout();
      clearRefreshInterval();
    },
    async startWithDuration(durationSeconds: number) {
      const duration = Math.min(durationSeconds, 25);

      if (!active) {
        active = true;
        try {
          await markAsReadWithTyping(to, messageId);
          startRefreshLoop(20);
        } catch (err: any) {
          active = false;
          logger.error('[WhatsApp Typing] Indicator error', err instanceof Error ? err : new Error(String(err)), {
            metadata: { to, messageId, durationSeconds },
          });
          return;
        }
      }

      clearDurationTimeout();

      timeoutId = setTimeout(() => {
        active = false;
        clearDurationTimeout();
        clearRefreshInterval();
      }, duration * 1000);
      if (typeof (timeoutId as NodeJS.Timeout).unref === 'function') {
        (timeoutId as NodeJS.Timeout).unref();
      }
    },
    isActive() {
      return active;
    },
  };
}

export async function markAsRead(messageId: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    throw new Error('Missing WhatsApp credentials');
  }

  const url = `${GRAPH_BASE_URL}/${phoneId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`WhatsApp API error ${res.status}: ${detail}`);
  }

  return res.json();
}
