import axios from 'axios';
import { CONFIG } from '../../config/index.js';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('arkesel');

const ARKESEL_SEND_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const REQUEST_TIMEOUT_MS = 10_000;

export function isArkeselConfigured(): boolean {
  return Boolean(CONFIG.ARKESEL.API_KEY && CONFIG.ARKESEL.SENDER_ID);
}

/**
 * Send one SMS through Arkesel's v2 API.
 * `recipient` must already be in 233XXXXXXXXX format (see lib/phone.ts).
 * Returns true only when Arkesel accepted the message.
 */
export async function sendSms(recipient: string, message: string): Promise<boolean> {
  if (!isArkeselConfigured()) {
    log.error('Arkesel is not configured (ARKESEL_API_KEY / ARKESEL_SENDER_ID)');
    return false;
  }

  try {
    const response = await axios.post(
      ARKESEL_SEND_URL,
      {
        sender: CONFIG.ARKESEL.SENDER_ID,
        message,
        recipients: [recipient],
        ...(CONFIG.ARKESEL.SANDBOX ? { sandbox: true } : {}),
      },
      {
        headers: {
          'api-key': CONFIG.ARKESEL.API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: REQUEST_TIMEOUT_MS,
      }
    );

    if (response.data?.status !== 'success') {
      log.error({ status: response.data?.status, message: response.data?.message }, 'Arkesel rejected SMS');
      return false;
    }

    log.info({ recipient: maskMsisdn(recipient), sandbox: CONFIG.ARKESEL.SANDBOX }, 'SMS sent via Arkesel');
    return true;
  } catch (err) {
    const detail = axios.isAxiosError(err)
      ? { httpStatus: err.response?.status, body: err.response?.data, code: err.code }
      : { err: String(err) };
    log.error({ recipient: maskMsisdn(recipient), ...detail }, 'Arkesel SMS request failed');
    return false;
  }
}

function maskMsisdn(msisdn: string): string {
  return msisdn.length > 6 ? `${msisdn.slice(0, 5)}****${msisdn.slice(-3)}` : '****';
}
