import { logger } from '../../observability/logger';
import { GRAPH_BASE_URL } from './http';

export async function blockPhoneNumber(phoneNumber: string): Promise<boolean> {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      throw new Error('Missing WhatsApp credentials');
    }

    const url = `${GRAPH_BASE_URL}/${phoneId}/block`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        phone_number: phoneNumber,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error('[WhatsApp Block API] Request failed', new Error(`Status ${res.status}`), {
        metadata: { status: res.status, detail, phoneNumber },
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[WhatsApp] Error blocking phone number', error instanceof Error ? error : new Error(String(error)), {
      metadata: { phoneNumber },
    });
    return false;
  }
}

export async function unblockPhoneNumber(phoneNumber: string): Promise<boolean> {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      throw new Error('Missing WhatsApp credentials');
    }

    const url = `${GRAPH_BASE_URL}/${phoneId}/block/${encodeURIComponent(phoneNumber)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.error('[WhatsApp Unblock API] Request failed', new Error(`Status ${res.status}`), {
        metadata: { status: res.status, detail, phoneNumber },
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[WhatsApp] Error unblocking phone number', error instanceof Error ? error : new Error(String(error)), {
      metadata: { phoneNumber },
    });
    return false;
  }
}
