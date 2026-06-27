import axios from 'axios';
import { CONFIG } from '../../config';

export const initiatePayment = async (amount: number, phone: string, reference: string) => {
  if (!CONFIG.HUBTEL.CLIENT_ID || !CONFIG.HUBTEL.CLIENT_SECRET) {
    console.warn('Hubtel credentials missing');
    return null;
  }

  try {
    const response = await axios.post(
      'https://api-proxy.hubtel.com/v2/payment/initiate',
      {
        amount,
        customerName: 'ResearchPadi User',
        customerMsisdn: phone,
        customerEmail: '',
        channel: 'mobilemoney',
        description: 'Wallet Top-up',
        primaryCallbackUrl: `${process.env.BACKEND_URL}/api/payments/callback`,
        secondaryCallbackUrl: '',
        returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
        cancellationUrl: `${process.env.FRONTEND_URL}/payment/failed`,
        clientReference: reference
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${CONFIG.HUBTEL.CLIENT_ID}:${CONFIG.HUBTEL.CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Hubtel Initiation Error:', error);
    return null;
  }
};
