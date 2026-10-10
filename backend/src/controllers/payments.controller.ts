import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import * as paystackService from '../services/payments/paystack.service.js';
import { CONFIG } from '../config/index.js';
import { childLogger } from '../lib/logger.js';
import { verifyPaystackSignature, paystackAmountToGhs } from '../lib/paystack-signature.js';
import { incrementWalletBalance } from '../lib/wallet.js';

const log = childLogger('payments');

async function creditPendingTransaction(reference: string, paidGhs: number, paystackReference: string, expectedUserId?: string) {
  let query = supabase
    .from('transactions')
    .update({
      status: 'success',
      paystack_reference: paystackReference,
      amount_ghs: paidGhs,
    })
    .eq('reference', reference)
    .eq('status', 'pending');

  if (expectedUserId) {
    query = query.eq('user_id', expectedUserId);
  }

  const { data: transaction, error } = await query.select().maybeSingle();

  if (error) {
    log.error({ err: error.message, reference }, 'Failed to mark transaction success');
    return { error: 'Failed to update transaction', transaction: null, alreadyPaid: false };
  }

  if (!transaction) {
    const { data: existing } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (existing?.status === 'success') {
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance_ghs')
        .eq('user_id', existing.user_id)
        .maybeSingle();
      return { error: null, transaction: existing, alreadyPaid: true, balance: wallet?.balance_ghs || 0 };
    }

    return { error: 'Transaction not found', transaction: null, alreadyPaid: false };
  }

  // The pending→success update above only succeeds once per reference, so this
  // runs exactly once per payment; the increment itself is atomic.
  const credited = await incrementWalletBalance(transaction.user_id, Number(transaction.amount_ghs));
  if (!credited.ok) {
    log.error({ reference }, 'Payment marked successful but wallet credit failed — needs manual credit');
    return { error: 'Payment received but your wallet could not be updated. Contact support.', transaction, alreadyPaid: false };
  }

  return { error: null, transaction, alreadyPaid: false, balance: credited.balance };
}

export const initiatePayment = async (req: Request, res: Response) => {
  const { amount, email } = req.body;
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!email) return res.status(400).json({ error: 'Email is required for Paystack' });

  const reference = `RP-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'credit',
    amount_ghs: amount,
    reference,
    product: 'wallet_topup',
    status: 'pending',
  });
  if (error) {
    log.error({ err: error.message }, 'Failed to create pending transaction');
    return res.status(500).json({ error: 'Failed to initiate payment' });
  }

  const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/wallet`;
  const result = await paystackService.initializeTransaction(email, amount, reference, callbackUrl);

  if (!result) return res.status(500).json({ error: 'Failed to initiate payment' });

  res.json({
    authorizationUrl: result.data.authorization_url,
    reference: result.data.reference,
    accessCode: result.data.access_code,
  });
};

export const verifyPayment = async (req: Request, res: Response) => {
  const { reference } = req.params;
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!reference) return res.status(400).json({ error: 'Reference is required' });

  const result = await paystackService.verifyTransaction(reference as string);

  if (!result || !result.status) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  const txData = result.data;

  if (txData.status !== 'success') {
    await supabase
      .from('transactions')
      .update({ status: 'failed' })
      .eq('reference', reference)
      .eq('user_id', userId)
      .eq('status', 'pending');
    return res.status(400).json({ error: 'Payment was not successful' });
  }

  const paidGhs = paystackAmountToGhs(Number(txData.amount));
  if (!Number.isFinite(paidGhs) || paidGhs <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount' });
  }
  const credited = await creditPendingTransaction(reference as string, paidGhs, txData.reference, userId);

  if (credited.error && !credited.alreadyPaid) {
    const status = credited.error === 'Transaction not found' ? 404 : 500;
    return res.status(status).json({ error: credited.error });
  }

  res.json({
    status: 'success',
    amount: credited.transaction?.amount_ghs,
    balance: credited.balance,
  });
};

export const paystackWebhook = async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.headers['x-paystack-signature'];

  if (!verifyPaystackSignature(rawBody || Buffer.from(''), signature, CONFIG.PAYSTACK_SECRET_KEY)) {
    log.warn({ ip: req.ip }, 'Rejected Paystack webhook with invalid signature');
    return res.status(401).end();
  }

  const { event, data } = req.body || {};

  if (event === 'charge.success' && data?.reference) {
    const paidGhs = paystackAmountToGhs(Number(data.amount));
    if (!Number.isFinite(paidGhs) || paidGhs <= 0) {
      log.warn({ reference: data.reference }, 'Webhook ignored due to invalid amount');
    } else {
      const credited = await creditPendingTransaction(data.reference, paidGhs, data.reference);
      if (credited.error && !credited.alreadyPaid) {
        log.error({ reference: data.reference, err: credited.error }, 'Webhook credit failed');
      }
    }
  }

  res.status(200).end();
};

export const getWalletBalance = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { data, error } = await supabase.from('wallets').select('balance_ghs').eq('user_id', userId).maybeSingle();
  if (error) return res.status(500).json({ error: 'Failed to load wallet' });
  res.json({ balance: data?.balance_ghs || 0 });
};

export const getTransactionHistory = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { data, error } = await supabase
    .from('transactions')
    .select('id, type, amount_ghs, reference, product, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'Failed to load transactions' });
  res.json(data);
};
