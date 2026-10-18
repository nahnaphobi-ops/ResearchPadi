import { supabase } from '../../db/supabase.js';
import { CONFIG } from '../../config/index.js';
import { childLogger } from '../../lib/logger.js';
import { creditWallet, debitWallet } from '../../lib/wallet.js';
import { toGhanaMsisdn } from '../../lib/phone.js';
import { isArkeselConfigured, sendSms } from '../sms/arkesel.service.js';
import { getTemplate } from '../care-study/template.service.js';
import { collectText, redactFullNames, scanPrivacy } from '../care-study/privacy.js';
import {
  RUBRIC, careStudyParts, careStudySnapshot, cleanSpecialties, paperChapters, paperParts, reviewerCanTake, rubricFor, specialtyLabel, textToHtml,
  type ReviewPart, type SourceType,
} from './review-sources.js';

export { RUBRIC };

const log = childLogger('reviews');

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

export interface CreateInput {
  sourceType?: SourceType;
  /** Workspace document. */
  sessionId?: string;
  /** Paper or care study. */
  sourceId?: string;
  scope: 'excerpt' | 'full';
  /** Workspace excerpt (the selected HTML). */
  excerptHtml?: string;
  /** A paper's chapter number or a care study's section key, for scope "excerpt". */
  part?: string;
  notes?: string;
}

interface ResolvedSource {
  title: string;
  snapshot: string;
  sessionId: string | null;
  sourceId: string | null;
  specialty: string | null;
}

async function loadCareStudy(userId: string, id: string) {
  const { data: study } = await supabase.from('care_studies').select('id, template_id, pseudonym, focus').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!study) throw new ReviewError('Care study not found.', 404);
  const template = getTemplate(study.template_id);
  if (!template) throw new ReviewError('This care study uses a template that is no longer available.', 409);
  const { data: rows } = await supabase.from('care_study_sections').select('section_key, entries, draft').eq('care_study_id', id);
  const sections = Object.fromEntries((rows ?? []).map((r) => [r.section_key, r]));
  return { study, template, sections };
}

async function loadPaper(userId: string, id: string) {
  const { data: paper } = await supabase.from('papers').select('id, topic, status, final_content').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!paper) throw new ReviewError('Paper not found.', 404);
  if (paper.status !== 'completed' || !paper.final_content) throw new ReviewError('A paper can be reviewed once it has finished generating.', 409);
  return paper as { id: string; topic: string; final_content: string };
}

/** What a student can pick to have reviewed for a paper or care study. */
export async function sourceOptions(userId: string, sourceType: SourceType, sourceId: string): Promise<{ title: string; parts: ReviewPart[] }> {
  if (sourceType === 'paper') {
    const paper = await loadPaper(userId, sourceId);
    return { title: paper.topic, parts: paperParts(paper.final_content) };
  }
  if (sourceType === 'care_study') {
    const { study, template, sections } = await loadCareStudy(userId, sourceId);
    return { title: `${template.name} — ${study.pseudonym}`, parts: careStudyParts(template, sections) };
  }
  throw new ReviewError('Choose a paper or a care study.');
}

async function resolveSource(userId: string, input: CreateInput): Promise<ResolvedSource> {
  const type: SourceType = input.sourceType ?? 'workspace';

  if (type === 'workspace') {
    const { data: session } = await supabase
      .from('workspace_sessions')
      .select('id, title, content')
      .eq('id', input.sessionId ?? '')
      .eq('user_id', userId)
      .maybeSingle();
    if (!session) throw new ReviewError('Document not found.', 404);
    return {
      title: session.title || 'Untitled document',
      snapshot: (input.scope === 'excerpt' ? input.excerptHtml : session.content) ?? '',
      sessionId: session.id,
      sourceId: null,
      specialty: null,
    };
  }

  if (type === 'paper') {
    const paper = await loadPaper(userId, input.sourceId ?? '');
    let text = paper.final_content;
    let title = paper.topic;
    if (input.scope === 'excerpt') {
      const chapter = paperChapters(paper.final_content).find((c) => c.key === input.part);
      if (!chapter) throw new ReviewError('Choose a chapter to review.');
      text = chapter.text;
      title = `${paper.topic} — ${chapter.label}`;
    }
    return { title, snapshot: textToHtml(text), sessionId: null, sourceId: paper.id, specialty: null };
  }

  const { study, template, sections } = await loadCareStudy(userId, input.sourceId ?? '');
  let only: string | undefined;
  let title = `${template.name} — ${study.pseudonym}`;
  if (input.scope === 'excerpt') {
    const section = template.sections.find((s) => s.key === input.part);
    if (!section) throw new ReviewError('Choose a section to review.');
    only = section.key;
    title = `${title} — ${section.title}`;
  }
  // Reviewers see initials for anyone named in full (the student was warned about these when saving).
  const snapshot = redactFullNames(careStudySnapshot(template, study, sections, only));
  // A reviewer must never be sent a client's contact details or ID numbers.
  const blocked = scanPrivacy(collectText(Object.values(sections).map((s: any) => [s.entries, s.draft]))).filter((i) => i.severity === 'block');
  if (blocked.length) {
    throw new ReviewError(`Remove personal details from your care study before sending it for review: ${blocked[0].message}`, 422);
  }
  const specialty = template.review_specialty && cleanSpecialties([template.review_specialty]).length ? template.review_specialty : null;
  return { title, snapshot, sessionId: null, sourceId: study.id, specialty };
}

/** Snapshot the work, charge the wallet, and queue the request. */
export async function createRequest(userId: string, input: CreateInput) {
  const sourceType: SourceType = input.sourceType ?? 'workspace';
  const source = await resolveSource(userId, input);
  if (sourceType === 'care_study') {
    // The reviewer reads these notes too, so the same privacy rules apply.
    const blocked = scanPrivacy(input.notes ?? '').filter((i) => i.severity === 'block');
    if (blocked.length) throw new ReviewError(`Remove personal details from your note to the reviewer: ${blocked[0].message}`, 422);
  }

  const snapshot = source.snapshot;
  if (snapshot.length > MAX_SNAPSHOT_CHARS) throw new ReviewError('That is too large to submit for review.');
  const words = countWords(snapshot);
  if (words < MIN_WORDS) throw new ReviewError(`Reviews need at least ${MIN_WORDS} words.`);

  const { data: profile } = await supabase.from('users').select('institution_type, programme').eq('id', userId).maybeSingle();
  const price = priceFor(input.scope);

  const { data: request, error } = await supabase
    .from('review_requests')
    .insert({
      user_id: userId,
      session_id: source.sessionId,
      source_type: sourceType,
      source_id: source.sourceId,
      specialty: source.specialty,
      title: source.title,
      scope: input.scope,
      notes: (sourceType === 'care_study' ? redactFullNames(input.notes ?? '') : input.notes ?? '').trim().slice(0, 2_000) || null,
      content_snapshot: snapshot,
      word_count: words,
      price_ghs: price,
      institution_type: profile?.institution_type ?? null,
      programme: profile?.programme ?? null,
    })
    .select('id, title, scope, status, price_ghs, word_count, source_type, source_id, created_at')
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
    .select('id, session_id, source_type, source_id, title, scope, status, price_ghs, word_count, due_at, returned_at, created_at')
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
    .select('id, session_id, source_type, source_id, title, scope, notes, status, price_ghs, word_count, due_at, returned_at, summary, scores, created_at, reviewer_id, content_snapshot')
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
  const { reviewer_id: _hidden, content_snapshot, ...rest } = request;
  return {
    ...rest,
    // Workspace reviews are read inside the document; other work is shown from the snapshot the reviewer saw.
    content_snapshot: request.source_type === 'workspace' ? null : content_snapshot,
    summary: request.status === 'returned' ? request.summary : null,
    scores: request.status === 'returned' ? request.scores : null,
    reviewer_name: (reviewer.data as { display_name?: string } | null)?.display_name ?? null,
    comments: comments.data ?? [],
    rubric: rubricFor(request.source_type),
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

const DESK_COLUMNS = 'id, title, source_type, specialty, scope, notes, status, word_count, price_ghs, institution_type, programme, claimed_at, due_at, returned_at, created_at';

async function reviewerSpecialties(reviewerId: string): Promise<string[]> {
  const { data } = await supabase.from('reviewers').select('specialties').eq('user_id', reviewerId).maybeSingle();
  return (data?.specialties as string[] | null) ?? [];
}

/** Open requests this reviewer is vetted to take: no specialty needed, or one of theirs. */
export async function reviewerQueue(reviewerId: string) {
  const specialties = await reviewerSpecialties(reviewerId);
  let openQuery = supabase.from('review_requests').select(DESK_COLUMNS).eq('status', 'pending').is('reviewer_id', null);
  openQuery = specialties.length
    ? openQuery.or(`specialty.is.null,specialty.in.(${specialties.join(',')})`)
    : openQuery.is('specialty', null);
  const [open, mine] = await Promise.all([
    openQuery.order('created_at').limit(50),
    supabase.from('review_requests').select(DESK_COLUMNS).eq('reviewer_id', reviewerId).in('status', ['in_review', 'returned']).order('created_at', { ascending: false }).limit(50),
  ]);
  const share = CONFIG.PRICING.REVIEW.REVIEWER_SHARE;
  const withPay = (rows: any[] | null) => (rows ?? []).map((r) => ({ ...r, reviewer_pay_ghs: Math.round(Number(r.price_ghs) * share * 100) / 100 }));
  return { open: withPay(open.data), mine: withPay(mine.data) };
}

export async function claim(reviewerId: string, id: string) {
  const { data: request } = await supabase.from('review_requests').select('specialty').eq('id', id).maybeSingle();
  if (!request) throw new ReviewError('Request not found.', 404);
  if (!reviewerCanTake(await reviewerSpecialties(reviewerId), request.specialty)) {
    throw new ReviewError(`This request needs a reviewer vetted for ${specialtyLabel(request.specialty)}.`, 403);
  }
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
  return { ...request, reviewer_pay_ghs: reviewerPay, comments: comments ?? [], rubric: rubricFor(request.source_type) };
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
  const { data: source } = await supabase.from('review_requests').select('source_type').eq('id', id).maybeSingle();
  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 8_000) : '';
  if (summary.length < 40) throw new ReviewError('Write an overall summary for the student (at least a few sentences).');

  const scores: Record<string, number> = {};
  const given = (input.scores ?? {}) as Record<string, unknown>;
  for (const { key } of rubricFor(source?.source_type)) {
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
    .select('id, title, source_type, specialty, scope, status, price_ghs, word_count, reviewer_id, claimed_at, due_at, returned_at, created_at, user_id')
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
    .select('user_id, display_name, bio, active, created_at, specialties, institution, qualification, years_experience, vetted_at, vetting_notes, users!reviewers_user_id_fkey(phone)')
    .order('created_at');
  if (error) throw new ReviewError('Could not load reviewers.', 500);
  return data ?? [];
}

export async function adminAddReviewer(phone: string, displayName: string, bio?: string, adminId?: string, specialties?: unknown) {
  const msisdn = toGhanaMsisdn(phone);
  if (!msisdn) throw new ReviewError('Enter a valid Ghanaian phone number.');
  const { data: user } = await supabase.from('users').select('id').eq('phone', `+${msisdn}`).maybeSingle();
  if (!user) throw new ReviewError('No account uses that phone number yet. The reviewer must sign up first.', 404);
  if (!displayName.trim()) throw new ReviewError('Enter the name students will see.');
  const { error } = await supabase
    .from('reviewers')
    .upsert({
      user_id: user.id,
      display_name: displayName.trim().slice(0, 120),
      bio: bio?.trim().slice(0, 500) || null,
      active: true,
      specialties: cleanSpecialties(specialties),
      vetted_by: adminId ?? null,
      vetted_at: new Date().toISOString(),
      vetting_notes: 'Added by an admin without an application.',
    });
  if (error) throw new ReviewError('Could not save the reviewer.', 500);
}

export async function adminSetReviewerSpecialties(userId: string, specialties: unknown) {
  const { error } = await supabase.from('reviewers').update({ specialties: cleanSpecialties(specialties) }).eq('user_id', userId);
  if (error) throw new ReviewError('Could not update the reviewer.', 500);
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
