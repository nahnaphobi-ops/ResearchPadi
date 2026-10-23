import { Request, Response } from 'express';
import crypto from 'crypto';
import { supabase } from '../db/supabase.js';
import { CONFIG } from '../config/index.js';
import { debitWallet, creditWallet } from '../lib/wallet.js';
import { asPlan, devPlan, limitsJson } from '../lib/workspace-plans.js';

// Plans are sold as "30 days" on the pricing page, so add exactly that (a calendar month is 28–31).
const PLAN_DAYS = 30;
const addPlanDays = (from: Date) => new Date(from.getTime() + PLAN_DAYS * 86_400_000);

const PLANS: Record<string, { price: number; features: string[] }> = {
  standard: { price: CONFIG.PRICING.PLANS.standard, features: ['5 workspace sessions', 'AI writing assistance', 'Citation search'] },
  premium: { price: CONFIG.PRICING.PLANS.premium, features: ['Unlimited sessions', 'Advanced AI tools', 'Full RAG citations', 'Export to DOCX', 'Priority support'] },
};

export const subscribe = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const { plan } = req.body;

  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
  if (!plan || !PLANS[plan]) return res.status(400).json({ error: 'Invalid plan. Choose "standard" or "premium".' });

  const price = PLANS[plan].price;
  const expiresAt = addPlanDays(new Date());

  // Charge the wallet atomically; refunded below if the subscription can't be saved.
  const chargeRef = `subscription:${crypto.randomUUID()}`;
  const charge = await debitWallet(userId, price, `workspace_${plan}`, chargeRef);
  if (!charge.ok) {
    if (charge.reason === 'insufficient_funds') {
      return res.status(402).json({ error: `Insufficient balance. You need GHS ${price}. Please top up your wallet.` });
    }
    return res.status(500).json({ error: 'Could not process payment. You have not been charged.' });
  }
  const refund = () => creditWallet(userId, price, `workspace_${plan}_refund`, `refund:${chargeRef}`);

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

    const { data: updated, error: upErr } = await supabase
      .from('subscriptions')
      .update({ plan, expires_at: addPlanDays(baseDate).toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (upErr) {
      await refund();
      return res.status(500).json({ error: 'Could not update your subscription. You have been refunded.' });
    }
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

  if (subError) {
    await refund();
    return res.status(500).json({ error: 'Could not start your subscription. You have been refunded.' });
  }

  res.json({ subscription: sub, message: `Subscribed to ${plan} plan` });
};

/**
 * The user's paid subscription (if any), plus their Workspace plan and its
 * limits (null = unlimited), so the app can show what the Free plan includes.
 */
export const getActiveSubscription = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });

  // Development: everyone is Premium unless DEV_PLAN says otherwise.
  const dev = devPlan();
  if (dev) {
    const subscription = dev === 'free' ? null : { plan: dev, status: 'active', expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
    return res.json({
      subscription,
      plan: subscription ? PLANS[dev] : null,
      isActive: !!subscription,
      workspacePlan: dev,
      limits: limitsJson(dev),
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
  const workspacePlan = data ? asPlan(data.plan) : 'free';

  res.json({
    subscription: data || null,
    plan: planInfo || null,
    isActive: !!data,
    workspacePlan,
    limits: limitsJson(workspacePlan),
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
