import axios from 'axios';
import { CONFIG } from '../../config/index.js';

const PAYSTACK_BASE = 'https://api.paystack.co';

const headers = () => ({
  Authorization: `Bearer ${CONFIG.PAYSTACK_SECRET_KEY}`,
  'Content-Type': 'application/json',
});

export const initializeTransaction = async (email: string, amount: number, reference: string, callbackUrl?: string) => {
  if (!CONFIG.PAYSTACK_SECRET_KEY) {
    console.warn('Paystack secret key missing');
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
    console.error('Paystack Init Error:', error.response?.data || error.message);
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
    console.error('Paystack Verify Error:', error.response?.data || error.message);
    return null;
  }
};
