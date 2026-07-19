import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import * as paystackService from '../services/payments/paystack.service.js';

export const initiatePayment = async (req: Request, res: Response) => {
  const { amount, email } = req.body;
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!email) return res.status(400).json({ error: 'Email is required for Paystack' });

  const reference = `RP-${Date.now()}`;

  // 1. Create pending transaction
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'credit',
    amount_ghs: amount,
    reference,
    product: 'wallet_topup',
    status: 'pending',
  });
  if (error) return res.status(500).json({ error: error.message });

  // 2. Initialize Paystack
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
  if (!reference) return res.status(400).json({ error: 'Reference is required' });

  const result = await paystackService.verifyTransaction(reference as string);

  if (!result || !result.status) {
    return res.status(400).json({ error: 'Verification failed' });
  }

  const txData = result.data;

  if (txData.status === 'success') {
    // 1. Update transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .update({ status: 'success', hubtel_reference: txData.reference })
      .eq('reference', reference)
      .select()
      .single();

    if (txError) return res.status(500).json({ error: txError.message });

    // 2. Update wallet
    const { data: wallet } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', transaction.user_id)
      .maybeSingle();

    const newBalance = (wallet?.balance_ghs || 0) + transaction.amount_ghs;

    if (!wallet) {
      await supabase.from('wallets').insert({ user_id: transaction.user_id, balance_ghs: newBalance });
    } else {
      await supabase.from('wallets').update({ balance_ghs: newBalance, updated_at: new Date().toISOString() }).eq('id', wallet.id);
    }

    res.json({ status: 'success', amount: transaction.amount_ghs, balance: newBalance });
  } else {
    await supabase.from('transactions').update({ status: 'failed' }).eq('reference', reference);
    res.status(400).json({ error: 'Payment was not successful' });
  }
};

export const paystackWebhook = async (req: Request, res: Response) => {
  // Paystack webhook handler (optional - for server-to-server notifications)
  const { event, data } = req.body;

  if (event === 'charge.success') {
    const reference = data.reference;
    const { data: transaction } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .eq('status', 'pending')
      .maybeSingle();

    if (transaction) {
      await supabase.from('transactions').update({ status: 'success', hubtel_reference: reference }).eq('id', transaction.id);

      const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', transaction.user_id).maybeSingle();
      const newBalance = (wallet?.balance_ghs || 0) + transaction.amount_ghs;
      if (!wallet) {
        await supabase.from('wallets').insert({ user_id: transaction.user_id, balance_ghs: newBalance });
      } else {
        await supabase.from('wallets').update({ balance_ghs: newBalance }).eq('id', wallet.id);
      }
    }
  }

  res.status(200).end();
};

export const getWalletBalance = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { data, error } = await supabase.from('wallets').select('*').eq('user_id', userId).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ balance: data?.balance_ghs || 0 });
};

export const getTransactionHistory = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  const { data, error } = await supabase.from('transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
};
