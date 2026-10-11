import { supabase } from '../../db/supabase.js';
import { CONFIG } from '../../config/index.js';
import { childLogger } from '../../lib/logger.js';
import { creditWallet, debitWallet } from '../../lib/wallet.js';
import { toGhanaMsisdn } from '../../lib/phone.js';
import { isArkeselConfigured, sendSms } from '../sms/arkesel.service.js';

const log = childLogger('reviews');

export const RUBRIC = [
  { key: 'structure', label: 'Structure & flow' },
  { key: 'objectives', label: 'Objectives match findings' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'citations', label: 'Citations & APA' },
  { key: 'writing', label: 'Academic writing' },
  { key: 'context', label: 'Ghana context' },
] as const;

const MAX_SNAPSHOT_CHARS = 2_000_000;
const MIN_WORDS = 80;

export class ReviewError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const reviewChargeReference = (id: string) => `review:${id}`;
const refundReference = (id: string) => `review-refund:${id}`;

export function priceFor(scope: 'excerpt' | 'full'): number {
  return scope === 'full' ? CONFIG.PRICING.REVIEW.FULL_GHS : CONFIG.PRICING.REVIEW.EXCERPT_GHS;
}

export function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').split(/\s+/).filter(Boolean).length;
}

export async function isActiveReviewer(userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data } = await supabase.from('reviewers').select('user_id').eq('user_id', userId).eq('active', true).maybeSingle();
  return Boolean(data);
}

// ── Student ───────────────────────────────────────────────────────────────

/** Snapshot the document, charge the wallet, and queue the request. */
export async function createRequest(
  userId: string,
  input: { sessionId: string; scope: 'excerpt' | 'full'; excerptHtml?: string; notes?: string },
) {
  const { data: session } = await supabase
    .from('workspace_sessions')
    .select('id, title, content')
    .eq('id', input.sessionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!session) throw new ReviewError('Document not found.', 404);

  const snapshot = (input.scope === 'excerpt' ? input.excerptHtml : session.content) ?? '';
  if (snapshot.length > MAX_SNAPSHOT_CHARS) throw new ReviewError('That document is too large to submit for review.');
  const words = countWords(snapshot);
  if (words < MIN_WORDS) throw new ReviewError(`Reviews need at least ${MIN_WORDS} words.`);

  const { data: profile } = await supabase.from('users').select('institution_type, programme').eq('id', userId).maybeSingle();
  const price = priceFor(input.scope);

  const { data: request, error } = await supabase
    .from('review_requests')
    .insert({
      user_id: userId,
      session_id: session.id,
      title: session.title || 'Untitled document',
      scope: input.scope,
      notes: input.notes?.trim().slice(0, 2_000) || null,
      content_snapshot: snapshot,
      word_count: words,
      price_ghs: price,
      institution_type: profile?.institution_type ?? null,
      programme: profile?.programme ?? null,
    })
    .select('id, title, scope, status, price_ghs, word_count, created_at')
    .single();
  if (error || !request) throw new ReviewError('Could not create the review request.', 500);

  const charge = await debitWallet(userId, price, 'human_review', reviewChargeReference(request.id));
  if (!charge.ok) {
    await supabase.from('review_requests').delete().eq('id', request.id);
    throw charge.reason === 'insufficient_funds'
      ? new ReviewError(`Your wallet needs GHS ${price.toFixed(2)} for this review. Top up and try again.`, 402)
      : new ReviewError('Payment failed. You were not charged.', 500);
  }
  return request;
}

export async function listMine(userId: string, sessionId?: string) {
  let query = supabase
    .from('review_requests')
    .select('id, session_id, title, scope, status, price_ghs, word_count, due_at, returned_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (sessionId) query = query.eq('session_id', sessionId);
  const { data, error } = await query;
  if (error) throw new ReviewError('Could not load your reviews.', 500);
  return data ?? [];
}

/** A returned review with its comments (the reviewer's identity is reduced to a display name). */
export async function getMine(userId: string, id: string) {
  const { data: request } = await supabase
    .from('review_requests')
    .select('id, session_id, title, scope, notes, status, price_ghs, word_count, due_at, returned_at, summary, scores, created_at, reviewer_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!request) throw new ReviewError('Review not found.', 404);

  const [comments, reviewer] = await Promise.all([
    request.status === 'returned'
      ? supabase.from('review_comments').select('id, anchor_text, occurrence, comment, suggestion, status, created_at').eq('request_id', id).order('created_at')
      : Promise.resolve({ data: [] }),
    request.reviewer_id
      ? supabase.from('reviewers').select('display_name').eq('user_id', request.reviewer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { reviewer_id: _hidden, ...rest } = request;
  return {
    ...rest,
    summary: request.status === 'returned' ? request.summary : null,
    scores: request.status === 'returned' ? request.scores : null,
    reviewer_name: (reviewer.data as { display_name?: string } | null)?.display_name ?? null,
    comments: comments.data ?? [],
    rubric: RUBRIC,
  };
}

export async function setCommentStatus(userId: string, requestId: string, commentId: string, status: unknown) {
  if (status !== 'accepted' && status !== 'dismissed' && status !== 'open') throw new ReviewError('Invalid status.');
  const { data: request } = await supabase.from('review_requests').select('id').eq('id', requestId).eq('user_id', userId).maybeSingle();
  if (!request) throw new ReviewError('Review not found.', 404);
  const { error } = await supabase.from('review_comments').update({ status }).eq('id', commentId).eq('request_id', requestId);
  if (error) throw new ReviewError('Could not update the comment.', 500);
}

async function refund(request: { id: string; user_id: string; price_ghs: number | string }) {
  const result = await creditWallet(request.user_id, Number(request.price_ghs), 'human_review_refund', refundReference(request.id));
  if (!result.ok) throw new ReviewError('Refund failed. Please contact support.', 500);
}

/** Students can cancel (with a full refund) until a reviewer picks the request up. */
export async function cancelMine(userId: string, id: string) {
  const { data: request } = await supabase
    .from('review_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .select('id, user_id, price_ghs')
    .maybeSingle();
  if (!request) throw new ReviewError('Only requests that no reviewer has started can be cancelled.', 409);
  await refund(request);
}

// ── Reviewer ──────────────────────────────────────────────────────────────

const DESK_COLUMNS = 'id, title, scope, notes, status, word_count, price_ghs, institution_type, programme, claimed_at, due_at, returned_at, created_at';

export async function reviewerQueue(reviewerId: string) {
  const [open, mine] = await Promise.all([
    supabase.from('review_requests').select(DESK_COLUMNS).eq('status', 'pending').is('reviewer_id', null).order('created_at').limit(50),
    supabase.from('review_requests').select(DESK_COLUMNS).eq('reviewer_id', reviewerId).in('status', ['in_review', 'returned']).order('created_at', { ascending: false }).limit(50),
  ]);
  const share = CONFIG.PRICING.REVIEW.REVIEWER_SHARE;
  const withPay = (rows: any[] | null) => (rows ?? []).map((r) => ({ ...r, reviewer_pay_ghs: Math.round(Number(r.price_ghs) * share * 100) / 100 }));
  return { open: withPay(open.data), mine: withPay(mine.data) };
}

export async function claim(reviewerId: string, id: string) {
  const { data, error } = await supabase.rpc('claim_review', {
    p_request: id,
    p_reviewer: reviewerId,
    p_hours: CONFIG.PRICING.REVIEW.TURNAROUND_HOURS,
  });
  if (error) throw new ReviewError('Could not claim the request.', 500);
  if (!Array.isArray(data) || !data.length) throw new ReviewError('Another reviewer has already taken this request.', 409);
}

export async function release(reviewerId: string, id: string) {
  const { data } = await supabase
    .from('review_requests')
    .update({ status: 'pending', reviewer_id: null, claimed_at: null, due_at: null })
    .eq('id', id)
    .eq('reviewer_id', reviewerId)
    .eq('status', 'in_review')
    .select('id')
    .maybeSingle();
  if (!data) throw new ReviewError('Only requests you are reviewing can be released.', 409);
  await supabase.from('review_comments').delete().eq('request_id', id);
}

/** The work itself, for the assigned reviewer only. */
export async function getForReviewer(reviewerId: string, id: string) {
  const { data: request } = await supabase
    .from('review_requests')
    .select(`${DESK_COLUMNS}, content_snapshot, summary, scores`)
    .eq('id', id)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();
  if (!request) throw new ReviewError('Review not found or not assigned to you.', 404);
  const { data: comments } = await supabase
    .from('review_comments')
    .select('id, anchor_text, occurrence, comment, suggestion, status, created_at')
    .eq('request_id', id)
    .order('created_at');
  const reviewerPay = Math.round(Number(request.price_ghs) * CONFIG.PRICING.REVIEW.REVIEWER_SHARE * 100) / 100;
  return { ...request, reviewer_pay_ghs: reviewerPay, comments: comments ?? [], rubric: RUBRIC };
}

async function assertReviewing(reviewerId: string, id: string) {
  const { data } = await supabase.from('review_requests').select('id').eq('id', id).eq('reviewer_id', reviewerId).eq('status', 'in_review').maybeSingle();
  if (!data) throw new ReviewError('This review is not open for comments.', 409);
}

export async function addComment(
  reviewerId: string,
  id: string,
  input: { anchorText?: unknown; occurrence?: unknown; comment?: unknown; suggestion?: unknown },
) {
  await assertReviewing(reviewerId, id);
  const anchor = typeof input.anchorText === 'string' ? input.anchorText.trim().slice(0, 2_000) : '';
  const comment = typeof input.comment === 'string' ? input.comment.trim().slice(0, 4_000) : '';
  if (!anchor) throw new ReviewError('Select the text you are commenting on.');
  if (!comment) throw new ReviewError('Write a comment.');
  const suggestion = typeof input.suggestion === 'string' && input.suggestion.trim() ? input.suggestion.trim().slice(0, 4_000) : null;
  const occurrence = Number.isInteger(input.occurrence) && Number(input.occurrence) >= 0 ? Number(input.occurrence) : 0;

  const { data, error } = await supabase
    .from('review_comments')
    .insert({ request_id: id, reviewer_id: reviewerId, anchor_text: anchor, occurrence, comment, suggestion })
    .select('id, anchor_text, occurrence, comment, suggestion, status, created_at')
    .single();
  if (error || !data) throw new ReviewError('Could not save the comment.', 500);
  return data;
}

export async function deleteComment(reviewerId: string, id: string, commentId: string) {
  await assertReviewing(reviewerId, id);
  await supabase.from('review_comments').delete().eq('id', commentId).eq('request_id', id);
}

export async function returnReview(reviewerId: string, id: string, input: { summary?: unknown; scores?: unknown }) {
  await assertReviewing(reviewerId, id);
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 8_000) : '';
  if (summary.length < 40) throw new ReviewError('Write an overall summary for the student (at least a few sentences).');

  const scores: Record<string, number> = {};
  const given = (input.scores ?? {}) as Record<string, unknown>;
  for (const { key } of RUBRIC) {
    const value = Number(given[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) throw new ReviewError('Score every checklist item from 1 to 5.');
    scores[key] = value;
  }

  const { data: request } = await supabase
    .from('review_requests')
    .update({ status: 'returned', summary, scores, returned_at: new Date().toISOString() })
    .eq('id', id)
    .eq('reviewer_id', reviewerId)
    .eq('status', 'in_review')
    .select('id, user_id, title')
    .maybeSingle();
  if (!request) throw new ReviewError('This review is not open.', 409);

  void notifyStudent(request.user_id, request.title);
}

async function notifyStudent(userId: string, title: string) {
  try {
    if (!isArkeselConfigured()) return;
    const { data: user } = await supabase.from('users').select('phone').eq('id', userId).maybeSingle();
    const msisdn = user?.phone ? toGhanaMsisdn(user.phone) : null;
    if (!msisdn) return;
    const short = title.length > 50 ? `${title.slice(0, 47)}…` : title;
    await sendSms(msisdn, `ResearchPadi: your supervisor review of "${short}" is ready. Open your document to see the feedback.`);
  } catch (err: any) {
    log.warn({ err: err?.message }, 'Review-ready SMS failed');
  }
}

// ── Admin ─────────────────────────────────────────────────────────────────

export async function adminList(status?: string) {
  let query = supabase
    .from('review_requests')
    .select('id, title, scope, status, price_ghs, word_count, reviewer_id, claimed_at, due_at, returned_at, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw new ReviewError('Could not load reviews.', 500);
  return data ?? [];
}

export async function adminReviewers() {
  const { data, error } = await supabase
    .from('reviewers')
    .select('user_id, display_name, bio, active, created_at, users(phone)')
    .order('created_at');
  if (error) throw new ReviewError('Could not load reviewers.', 500);
  return data ?? [];
}

export async function adminAddReviewer(phone: string, displayName: string, bio?: string) {
  const msisdn = toGhanaMsisdn(phone);
  if (!msisdn) throw new ReviewError('Enter a valid Ghanaian phone number.');
  const { data: user } = await supabase.from('users').select('id').eq('phone', `+${msisdn}`).maybeSingle();
  if (!user) throw new ReviewError('No account uses that phone number yet. The reviewer must sign up first.', 404);
  if (!displayName.trim()) throw new ReviewError('Enter the name students will see.');
  const { error } = await supabase
    .from('reviewers')
    .upsert({ user_id: user.id, display_name: displayName.trim().slice(0, 120), bio: bio?.trim().slice(0, 500) || null, active: true });
  if (error) throw new ReviewError('Could not save the reviewer.', 500);
}

export async function adminSetReviewerActive(userId: string, active: boolean) {
  const { error } = await supabase.from('reviewers').update({ active }).eq('user_id', userId);
  if (error) throw new ReviewError('Could not update the reviewer.', 500);
}

export async function adminAssign(id: string, reviewerId: string | null) {
  const update = reviewerId
    ? { reviewer_id: reviewerId, status: 'in_review', claimed_at: new Date().toISOString(), due_at: new Date(Date.now() + CONFIG.PRICING.REVIEW.TURNAROUND_HOURS * 3_600_000).toISOString() }
    : { reviewer_id: null, status: 'pending', claimed_at: null, due_at: null };
  if (reviewerId && !(await isActiveReviewer(reviewerId))) throw new ReviewError('That reviewer is not active.');
  const { data } = await supabase.from('review_requests').update(update).eq('id', id).in('status', ['pending', 'in_review']).select('id').maybeSingle();
  if (!data) throw new ReviewError('Only open requests can be reassigned.', 409);
}

export async function adminCancel(id: string) {
  const { data: request } = await supabase
    .from('review_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['pending', 'in_review'])
    .select('id, user_id, price_ghs')
    .maybeSingle();
  if (!request) throw new ReviewError('Only open requests can be cancelled.', 409);
  await refund(request);
}
