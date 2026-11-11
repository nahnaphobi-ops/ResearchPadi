import axios from 'axios';
import { CONFIG } from '../../config/index.js';
import { childLogger } from '../../lib/logger.js';

const log = childLogger('paystack');

const PAYSTACK_BASE = 'https://api.paystack.co';

/** Paystack's own explanation when it gave one, else the network error. */
const reason = (error: any): string => error.response?.data?.message || error.message;

const headers = () => ({
  Authorization: `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

export const initializeTransaction = async (email: string, amount: number, reference: string, callbackUrl?: string) => {
  if (!CONFIG.PAYSTACK_SECRET_KEY) {
    log.error('Paystack secret key missing; top-ups cannot start');
    return null;
  }

  try {
    const response = await axios.post(
      `${PAYSTACK_BASE}/transaction/initialize`,
      {
        email,
        amount: Math.round(amount * 100), // Convert GHS to pesewas
        reference,
        currency: 'GHS',
        callback_url: callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/verify`,
        metadata: { reference },
      },
      { headers: headers() }
    );
    return response.data;
  } catch (error: any) {
    log.error({ err: reason(error), status: error.response?.status }, 'Paystack could not start a payment');
    return null;
  }
};

export const verifyTransaction = async (reference: string) => {
  if (!CONFIG.PAYSTACK_SECRET_KEY) return null;

  try {
    const response = await axios.get(
      `${PAYSTACK_BASE}/transaction/verify/${reference}`,
      { headers: headers() }
    );
    return response.data;
  } catch (error: any) {
    // Asking about a reference Paystack never saw is expected (a checkout that never
    // opened), so that case is a warning; anything else means verification is broken.
    if (error.response?.status === 400 || error.response?.status === 404) {
      log.warn({ err: reason(error) }, 'Paystack does not know this payment reference');
    } else {
      log.error({ err: reason(error), status: error.response?.status }, 'Paystack could not verify a payment');
    }
    return null;
  }
};
