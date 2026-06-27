import { Request, Response } from 'express';
import { supabase } from '../db/supabase';

const PLANS: Record<string, { price: number; features: string[] }> = {
  standard: { price: 120, features: ['5 workspace sessions', 'GPT-4o AI assistance', 'Citation search'] },
  premium: { price: 200, features: ['Unlimited sessions', 'Claude Sonnet AI', 'Full RAG citations', 'Export to DOCX', 'Priority support'] },
};

export const subscribe = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { plan } = req.body;

  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!plan || !PLANS[plan]) return res.status(400).json({ error: 'Invalid plan. Choose "standard" or "premium".' });

  const price = PLANS[plan].price;
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1);

  // Check wallet balance
  const { data: wallet, error: wErr } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (wErr && wErr.code !== 'PGRST116') return res.status(500).json({ error: wErr.message });
  if (!wallet || (wallet.balance_ghs || 0) < price) {
    return res.status(400).json({ error: `Insufficient balance. You need GHS ${price}. Please top up your wallet.` });
  }

  // Deduct from wallet
  const newBalance = wallet.balance_ghs - price;
  const { error: deductError } = await supabase
    .from('wallets')
    .update({ balance_ghs: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id);

  if (deductError) return res.status(500).json({ error: deductError.message });

  // Record transaction
  await supabase.from('transactions').insert({
    user_id: userId,
    type: 'debit',
    amount_ghs: price,
    product: `workspace_${plan}`,
    status: 'success',
  });

  // Check for existing active subscription
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Upgrade: extend from current expiry or now (whichever later)
    const baseDate = new Date(existing.expires_at) > new Date() ? new Date(existing.expires_at) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 1);

    const { data: updated, error: upErr } = await supabase
      .from('subscriptions')
      .update({ plan, expires_at: baseDate.toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({ subscription: updated, message: `Upgraded to ${plan}` });
  }

  // Create new subscription
  const { data: sub, error: subError } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (subError) return res.status(500).json({ error: subError.message });

  res.json({ subscription: sub, message: `Subscribed to ${plan} plan` });
};

export const getActiveSubscription = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  // DEV OVERRIDE: skip subscription check
  if (process.env.NODE_ENV !== 'production') {
    return res.json({
      subscription: { plan: 'premium', status: 'active', expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      plan: PLANS.premium,
      isActive: true,
    });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });

  const planInfo = data ? PLANS[data.plan] : null;

  res.json({
    subscription: data || null,
    plan: planInfo || null,
    isActive: !!data,
  });
};

export const cancelSubscription = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: 'cancelled' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'No active subscription found' });

  res.json({ message: 'Subscription cancelled', subscription: data });
};
