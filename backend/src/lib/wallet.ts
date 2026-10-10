import { supabase } from '../db/supabase.js';
import { childLogger } from './logger.js';

const log = childLogger('wallet');

export type WalletResult =
  | { ok: true; balance: number }
  | { ok: false; reason: 'insufficient_funds' | 'error' };

/**
 * Charge a user's wallet atomically (see debit_wallet in the 20261010 migration).
 * Passing a reference makes the charge idempotent.
 */
export async function debitWallet(userId: string, amount: number, product: string, reference?: string): Promise<WalletResult> {
  const { data, error } = await supabase.rpc('debit_wallet', {
    p_user_id: userId,
    p_amount: amount,
    p_product: product,
    p_reference: reference ?? null,
  });

  if (error) {
    if (error.message.includes('insufficient_funds')) return { ok: false, reason: 'insufficient_funds' };
    log.error({ err: error.message, userId, product }, 'Wallet debit failed');
    return { ok: false, reason: 'error' };
  }
  return { ok: true, balance: Number(data) };
}

/** Credit a wallet and record the transaction. Idempotent per reference (used for refunds). */
export async function creditWallet(userId: string, amount: number, product: string, reference?: string): Promise<WalletResult> {
  const { data, error } = await supabase.rpc('credit_wallet', {
    p_user_id: userId,
    p_amount: amount,
    p_product: product,
    p_reference: reference ?? null,
  });

  if (error) {
    log.error({ err: error.message, userId, product, reference }, 'Wallet credit failed');
    return { ok: false, reason: 'error' };
  }
  return { ok: true, balance: Number(data) };
}

/** Add to a balance when the transaction row already exists (e.g. a confirmed top-up). */
export async function incrementWalletBalance(userId: string, amount: number): Promise<WalletResult> {
  const { data, error } = await supabase.rpc('increment_wallet_balance', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    log.error({ err: error.message, userId }, 'Wallet increment failed');
    return { ok: false, reason: 'error' };
  }
  return { ok: true, balance: Number(data) };
}

export const paperChargeReference = (paperId: string) => `paper:${paperId}`;

/**
 * Refund a full paper's fee, but only if that paper was actually charged.
 * Safe to call more than once for the same paper.
 */
export async function refundPaperFee(paperId: string): Promise<'refunded' | 'not_charged' | 'error'> {
  const { data: charge, error } = await supabase
    .from('transactions')
    .select('user_id, amount_ghs')
    .eq('reference', paperChargeReference(paperId))
    .eq('type', 'debit')
    .eq('status', 'success')
    .maybeSingle();

  if (error) {
    log.error({ err: error.message, paperId }, 'Could not look up paper charge');
    return 'error';
  }
  if (!charge) return 'not_charged';

  const result = await creditWallet(charge.user_id, Number(charge.amount_ghs), 'full_paper_refund', `refund:paper:${paperId}`);
  if (!result.ok) return 'error';
  log.info({ paperId, amount: charge.amount_ghs }, 'Paper fee refunded');
  return 'refunded';
}
