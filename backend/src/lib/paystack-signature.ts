import crypto from 'crypto';

export function verifyPaystackSignature(
  rawBody: Buffer | string,
  signature: string | string[] | undefined,
  secret: string | undefined
): boolean {
  if (!secret || !signature || Array.isArray(signature) || signature.length === 0) {
    return false;
  }

  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto.createHmac('sha512', secret).update(payload).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function paystackAmountToGhs(amountPesewas: number): number {
  return Math.round(amountPesewas) / 100;
}

export type PaystackOutcome = 'paid' | 'failed' | 'in_progress';

/**
 * What a Paystack transaction status means for a top-up. A mobile money payment stays
 * "ongoing" or "pending" until the customer approves it on their phone, and an "abandoned"
 * checkout can still be completed, so only a definite failure counts as failed.
 */
export function paystackOutcome(status: unknown): PaystackOutcome {
  if (status === 'success') return 'paid';
  if (status === 'failed' || status === 'reversed') return 'failed';
  return 'in_progress';
}
